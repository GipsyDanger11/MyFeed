"""
Worker logic. For a single user:

  1. Load the encrypted Instagram session from Supabase.
  2. Decrypt it and build an instagrapi client.
  3. Read the boost topics. Skip if none.
  4. For each boost hashtag, perform:
       - a small number of likes
       - 0-1 follows
       - a single feed browse
  5. Cap to MAX_LIKES_PER_DAY and MAX_FOLLOWS_PER_DAY (per user, per day).
  6. Log every action to Supabase.
  7. On any challenge / captcha, mark the user as errored and stop.

Returns a small summary dict used by the FastAPI route.
"""
from __future__ import annotations

import logging
import random
import time
from typing import Any

from . import groq_client
from . import instagrapi_client as ig
from . import supabase_client as db
from .config import SETTINGS

ChallengeRequired = ig.ChallengeRequired
FeedbackRequired = ig.FeedbackRequired
RateLimitError = ig.RateLimitError
PleaseWaitFewMinutes = ig.PleaseWaitFewMinutes

log = logging.getLogger(__name__)


def _human_delay() -> None:
    delay = random.randint(SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    log.debug("Sleeping %ds between actions", delay)
    time.sleep(delay)


def run_for_user(user_id: str) -> dict[str, Any]:
    """Run one automation pass for a single user."""
    summary = {
        "user_id": user_id,
        "actions_planned": 0,
        "actions_completed": 0,
        "actions_failed": 0,
        "skipped": None,
        "errors": [],
    }

    # 1. Profile gate
    profile = db.get_profile(user_id)
    if not profile:
        summary["skipped"] = "no profile"
        return summary
    if profile.get("automation_paused"):
        summary["skipped"] = "paused"
        return summary

    # 2. Connection gate
    conn = db.get_connection(user_id)
    if not conn or not conn.get("encrypted_session"):
        summary["skipped"] = "no instagram connection"
        return summary
    if conn.get("status") == "error":
        # Don't keep banging on a blocked account.
        summary["skipped"] = "connection in error state"
        return summary

    # 3. Boost topics
    boost = db.get_boost_hashtags(user_id)
    if not boost:
        summary["skipped"] = "no boost topics"
        return summary

    # 4. Daily cap
    counts = db.count_actions_today(user_id)
    likes_remaining = max(0, SETTINGS.max_likes_per_day - counts.get("like", 0))
    follows_remaining = max(0, SETTINGS.max_follows_per_day - counts.get("follow", 0))
    if likes_remaining == 0 and follows_remaining == 0:
        summary["skipped"] = "daily cap reached"
        return summary

    # 5. Build client from saved session (reuse, not fresh login)
    try:
        settings_dict = ig.decrypt_session(conn["encrypted_session"])
        cl = ig.build_client(settings_dict)
    except ig.InstagrapiUnavailable as exc:
        summary["errors"].append(str(exc))
        return summary
    except Exception as exc:  # noqa: BLE001
        log.exception("Failed to build instagrapi client for %s", user_id)
        summary["skipped"] = f"session invalid: {exc}"
        db.set_status(user_id, "error", f"Session invalid: {exc}")
        return summary

    db.set_status(user_id, "connecting")

    # 6. Per-hashtag plan — Feature 1: AI-expanded hashtags
    # The user gave us a short list of boost topics. Groq widens that to
    # a long list of relevant Instagram hashtags so the worker has more
    # surface to act on. Falls back to a hardcoded map if Groq is down.
    expanded = groq_client.generate_hashtags(boost)
    # Flatten into a single list of unique hashtags.
    hashtag_pool: list[str] = []
    for topic, tags in expanded.items():
        for t in tags:
            tag = t.lstrip("#").strip()
            if tag and tag not in hashtag_pool:
                hashtag_pool.append(tag)
    if not hashtag_pool:
        # No AI, no fallback map match — use the topics as raw hashtags.
        hashtag_pool = [t.lower().replace(" ", "") for t in boost]
    hashtags = random.sample(hashtag_pool, k=min(len(hashtag_pool), 6))
    planned_actions = min(
        likes_remaining + follows_remaining,
        6,  # hard cap per run
    )
    summary["actions_planned"] = planned_actions

    try:
        for hashtag in hashtags:
            if likes_remaining <= 0 and follows_remaining <= 0:
                break

            # 6a. Browse the feed (pure signal, no quota, no scoring needed)
            if ig.browse_hashtag(cl, hashtag):
                db.log_action(user_id, "browse", target=f"#{hashtag}", success=True)
                summary["actions_completed"] += 1
            else:
                db.log_action(
                    user_id, "browse", target=f"#{hashtag}", success=False,
                    error="browse failed",
                )
                summary["actions_failed"] += 1
            _human_delay()

            # 6b. Likes — Feature 2: score each post caption with Groq
            if likes_remaining > 0:
                like_target = min(3, likes_remaining)
                # Pull top posts and score each before liking.
                try:
                    candidates = cl.hashtag_medias_top(hashtag, amount=like_target)
                except (ChallengeRequired, FeedbackRequired, RateLimitError, PleaseWaitFewMinutes) as exc:
                    log.warning("Like blocked for #%s: %s", hashtag, exc)
                    raise
                for m in candidates:
                    if likes_remaining <= 0:
                        break
                    caption = (getattr(m, "caption_text", "") or "").strip()
                    score = groq_client.score_relevance(boost, caption)
                    if not score["relevant"] or score["score"] < 60:
                        db.log_action(
                            user_id, "skip", target=f"#{hashtag}/{m.pk}",
                            success=True, relevance_score=score["score"],
                            error=f"low relevance: {score['reason']}",
                        )
                        log.info(
                            "Skipping %s for #%s — score %d (%s)",
                            m.pk, hashtag, score["score"], score["reason"],
                        )
                        continue
                    try:
                        if cl.media_like(m.pk):
                            db.log_action(
                                user_id, "like", target=f"#{hashtag}/{m.pk}",
                                success=True, relevance_score=score["score"],
                            )
                            summary["actions_completed"] += 1
                            likes_remaining -= 1
                    except Exception as exc:  # noqa: BLE001
                        log.warning("Failed to like %s: %s", m.pk, exc)
                _human_delay()

            # 6c. Follows (0 or 1 per hashtag)
            if follows_remaining > 0 and random.random() < 0.5:
                followed = ig.follow_from_hashtag(cl, hashtag, amount=1)
                for tgt in followed:
                    db.log_action(user_id, "follow", target=tgt, success=True)
                    summary["actions_completed"] += 1
                if followed:
                    follows_remaining -= len(followed)
                    _human_delay()

    except Exception as exc:  # noqa: BLE001
        if ig.is_challenge(exc):
            db.set_status(user_id, "error", "Instagram challenge required.")
            summary["errors"].append("challenge")
            log.warning("Challenge for user %s — pausing automation", user_id)
        elif ig.is_blocked(exc):
            db.set_status(user_id, "error", "Instagram rate-limit / feedback.")
            summary["errors"].append("rate-limited")
            log.warning("Rate-limited for user %s", user_id)
        else:
            db.set_status(user_id, "error", str(exc))
            summary["errors"].append(str(exc))
            log.exception("Worker error for user %s", user_id)
        return summary

    # 7. Persist refreshed session + last_sync + score
    try:
        new_encrypted = ig.encrypt_session(cl.get_settings())
        db.upsert_connection(user_id, conn["username"], new_encrypted)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not refresh session for %s: %s", user_id, exc)
    db.set_last_sync(user_id)

    # Bump personalization score: +1 per action, capped at 100.
    score = (profile.get("personalization_score") or 0) + summary["actions_completed"]
    db.update_personalization_score(user_id, score)

    return summary


def run_for_all_users() -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for profile in db.list_active_users():
        try:
            s = run_for_user(profile["id"])
            summaries.append(s)
        except Exception as exc:  # noqa: BLE001
            log.exception("run_for_user crashed for %s", profile.get("id"))
            summaries.append(
                {"user_id": profile.get("id"), "errors": [str(exc)]}
            )
    return summaries
