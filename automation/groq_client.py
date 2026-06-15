"""
Groq-powered helpers for the MyFeed worker.

Two features, both wrapped in try/except so a Groq outage can never
break the core automation loop:

  1. generate_hashtags(topics)   → expand a small set of boost topics
     into a wider list of relevant Instagram hashtags. Falls back to a
     hardcoded map if Groq is unavailable.

  2. score_relevance(topics, caption) → judge whether a post caption is
     a good match for the user's interests. Returns
     {relevant, score, reason}. If Groq is unavailable the caller
     should treat the post as relevant (we'd rather over-like than
     stop the loop on an AI hiccup).

The mobile app calls Groq directly for the "Suggest Topics" feature —
see src/lib/groq.ts. Both code paths share the same model + prompt
style so results stay consistent.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

log = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

# Used as a deterministic fallback when Groq is unavailable. Keys are
# matched case-insensitively against the user's boost topics.
FALLBACK_HASHTAGS: dict[str, list[str]] = {
    "technology": ["#tech", "#technology", "#innovation", "#gadgets", "#coding"],
    "artificial intelligence": ["#ai", "#artificialintelligence", "#machinelearning", "#ml", "#deeplearning"],
    "ai": ["#ai", "#artificialintelligence", "#machinelearning", "#ml"],
    "startups": ["#startup", "#startups", "#entrepreneur", "#founder", "#buildinpublic"],
    "business": ["#business", "#entrepreneur", "#smallbusiness", "#leadership", "#hustle"],
    "finance": ["#finance", "#investing", "#stocks", "#crypto", "#money"],
    "fitness": ["#fitness", "#gym", "#fitnessmotivation", "#workout", "#fitlife"],
    "health": ["#health", "#wellness", "#mentalhealth", "#healthy", "#selfcare"],
    "education": ["#education", "#learning", "#edtech", "#students", "#study"],
    "travel": ["#travel", "#wanderlust", "#travelgram", "#explore", "#adventure"],
    "gaming": ["#gaming", "#gamer", "#videogames", "#esports", "#twitch"],
    "science": ["#science", "#physics", "#biology", "#chemistry", "#research"],
    "music": ["#music", "#musician", "#producer", "#newmusic", "#livemusic"],
    "art": ["#art", "#artist", "#artwork", "#drawing", "#digitalart"],
    "food": ["#food", "#foodie", "#instafood", "#cooking", "#yummy"],
    "fashion": ["#fashion", "#style", "#ootd", "#streetwear", "#fashionblogger"],
    "crypto": ["#crypto", "#bitcoin", "#ethereum", "#defi", "#web3"],
    "design": ["#design", "#ui", "#ux", "#graphicdesign", "#designinspiration"],
    "photography": ["#photography", "#photo", "#photooftheday", "#nature", "#portrait"],
    "nature": ["#nature", "#naturelovers", "#outdoors", "#hiking", "#wildlife"],
    "sports": ["#sports", "#athlete", "#football", "#soccer", "#basketball"],
}


# ---------- transport ----------

def _groq_chat(prompt: str, max_tokens: int = 500) -> str | None:
    """Single low-level Groq call. Returns the raw assistant content or None."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        log.info("[GROQ] GROQ_API_KEY not set — skipping AI call")
        return None
    try:
        import httpx  # already in requirements.txt
    except ImportError:
        log.exception("[GROQ] httpx is required for Groq calls")
        return None
    try:
        resp = httpx.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": max_tokens,
            },
            timeout=10.0,
        )
        if resp.status_code != 200:
            log.warning("[GROQ ERROR] %s %s", resp.status_code, resp.text[:200])
            return None
        data = resp.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content")
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        log.warning("[GROQ ERROR] %s: %s", type(exc).__name__, exc)
        return None


def _strip_to_json(content: str | None) -> str | None:
    """Groq occasionally wraps the JSON in ```json ... ``` fences. Strip them."""
    if not content:
        return None
    s = content.strip()
    m = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", s, re.DOTALL)
    if m:
        return m.group(1)
    return s


# ---------- public API ----------

def generate_hashtags(topics: list[str]) -> dict[str, list[str]]:
    """
    For each input topic, return 5–10 highly relevant Instagram hashtags.
    Always returns a dict; falls back to FALLBACK_HASHTAGS on any failure.
    """
    if not topics:
        return {}
    topics_csv = ", ".join(topics)
    prompt = (
        f"Given these interest topics: {topics_csv}, generate 10 highly "
        f"relevant Instagram hashtags for each topic. Return ONLY a JSON "
        f"object like: "
        f"{{'{topics[0]}': ['#MachineLearning', '#DeepLearning', ...], "
        f"'{topics[1] if len(topics) > 1 else topics[0]}': ['#FitnessMotivation', '#GymLife', ...]}}. "
        f"No explanation, no markdown, just raw JSON."
    )
    raw = _strip_to_json(_groq_chat(prompt, max_tokens=600))
    if not raw:
        return _fallback_hashtags(topics)
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("expected object")
        # Normalise: strip the leading "#" off the topic keys for fuzzy match
        out: dict[str, list[str]] = {}
        for k, v in parsed.items():
            if not isinstance(v, list):
                continue
            tags = [str(t).strip() for t in v if isinstance(t, str) or isinstance(t, int)]
            tags = [t if t.startswith("#") else f"#{t}" for t in tags]
            if tags:
                out[k] = tags[:10]
        return out or _fallback_hashtags(topics)
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("[GROQ ERROR] generate_hashtags parse: %s", exc)
        return _fallback_hashtags(topics)


def score_relevance(boost_topics: list[str], caption: str) -> dict[str, Any]:
    """
    Returns {relevant: bool, score: int (0-100), reason: str}.
    On any failure returns {relevant: True, score: 100, reason: 'fallback'}
    so the caller can keep going (per the spec — never let AI failure
    break the core loop).
    """
    fallback = {"relevant": True, "score": 100, "reason": "fallback"}
    if not caption or not caption.strip():
        return fallback
    if not boost_topics:
        return {"relevant": True, "score": 50, "reason": "no boost topics"}
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return fallback
    topics_csv = ", ".join(boost_topics)
    prompt = (
        f"User interests: {topics_csv}\n"
        f"Post caption: {caption}\n\n"
        f"Is this post genuinely relevant to the user's interests? "
        f"Reply with ONLY a JSON object: "
        f"{{'relevant': true/false, 'score': 0-100, 'reason': 'one line reason'}}. "
        f"No explanation, no markdown, just raw JSON."
    )
    raw = _strip_to_json(_groq_chat(prompt, max_tokens=200))
    if not raw:
        return fallback
    try:
        parsed = json.loads(raw)
        relevant = bool(parsed.get("relevant", True))
        score = int(parsed.get("score", 100))
        score = max(0, min(100, score))
        reason = str(parsed.get("reason", ""))[:200]
        return {"relevant": relevant, "score": score, "reason": reason}
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        log.warning("[GROQ ERROR] score_relevance parse: %s", exc)
        return fallback


def _fallback_hashtags(topics: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for t in topics:
        key = t.strip().lower()
        if key in FALLBACK_HASHTAGS:
            out[t] = FALLBACK_HASHTAGS[key]
            continue
        # Try partial match ("AI" → "artificial intelligence" etc.)
        for known, tags in FALLBACK_HASHTAGS.items():
            if known in key or key in known:
                out[t] = tags
                break
        else:
            out[t] = [f"#{key.replace(' ', '')}", f"#{key.replace(' ', '_')}", "#explore"]
    return out
