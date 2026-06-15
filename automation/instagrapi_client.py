"""
instagrapi wrapper. Centralises session load/save, challenge detection,
and the three actions we perform: like, follow, browse.

If instagrapi is not installed (e.g. in CI / lint env), the wrapper
falls back to a no-op stub so the rest of the app still imports.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Iterable

from . import crypto
from .config import SETTINGS

log = logging.getLogger(__name__)

try:
    from instagrapi import Client  # type: ignore
    from instagrapi.exceptions import (  # type: ignore
        ChallengeRequired,
        FeedbackRequired,
        LoginRequired,
        PleaseWaitFewMinutes,
        RateLimitError,
    )

    _HAS_INSTAGRAPI = True
except Exception:  # pragma: no cover - import guard
    _HAS_INSTAGRAPI = False
    Client = None  # type: ignore

    class _StubError(Exception):  # type: ignore[no-redef]
        pass

    ChallengeRequired = _StubError  # type: ignore
    FeedbackRequired = _StubError  # type: ignore
    LoginRequired = _StubError  # type: ignore
    PleaseWaitFewMinutes = _StubError  # type: ignore
    RateLimitError = _StubError  # type: ignore


class InstagrapiUnavailable(RuntimeError):
    """Raised when the instagrapi package is missing."""


def is_available() -> bool:
    return _HAS_INSTAGRAPI


def decrypt_session(encrypted_b64: str) -> dict[str, Any]:
    return json.loads(crypto.decrypt(encrypted_b64, SETTINGS.encryption_key))


def encrypt_session(settings_dict: dict[str, Any]) -> str:
    return crypto.encrypt(json.dumps(settings_dict), SETTINGS.encryption_key)


def build_client(settings_dict: dict[str, Any] | None = None) -> Any:
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable(
            "instagrapi is not installed. Add it to requirements.txt."
        )
    cl = Client()
    cl.delay_range = (SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    if settings_dict:
        cl.set_settings(settings_dict)
        # Validate the loaded session is still good; relogin silently if not.
        try:
            cl.get_timeline_feed()
        except (LoginRequired, Exception) as exc:  # type: ignore[misc]
            log.warning("Loaded session invalid, will need credentials: %s", exc)
    return cl


def login(username: str, password: str) -> tuple[Any, str]:
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable("instagrapi is not installed.")
    cl = Client()
    cl.delay_range = (SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    cl.login(username, password)
    encrypted = encrypt_session(cl.get_settings())
    return cl, encrypted


def like_top_posts(cl: Any, hashtag: str, amount: int) -> list[str]:
    """Like up to `amount` top posts for a hashtag. Returns the targets liked."""
    liked: list[str] = []
    try:
        medias = cl.hashtag_medias_top(hashtag, amount=amount)
    except (ChallengeRequired, FeedbackRequired, RateLimitError, PleaseWaitFewMinutes) as exc:
        log.warning("Like blocked for #%s: %s", hashtag, exc)
        raise
    for m in medias:
        try:
            if cl.media_like(m.pk):
                liked.append(f"#{hashtag}/{m.pk}")
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to like %s: %s", m.pk, exc)
    return liked


def follow_from_hashtag(cl: Any, hashtag: str, amount: int) -> list[str]:
    """Follow up to `amount` users from a hashtag's top posts."""
    followed: list[str] = []
    try:
        medias = cl.hashtag_medias_top(hashtag, amount=amount)
    except (ChallengeRequired, FeedbackRequired, RateLimitError, PleaseWaitFewMinutes) as exc:
        log.warning("Follow blocked for #%s: %s", hashtag, exc)
        raise
    for m in medias:
        try:
            user_id = m.user.pk
            if cl.user_follow(user_id):
                followed.append(str(user_id))
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to follow user of %s: %s", m.pk, exc)
    return followed


def browse_hashtag(cl: Any, hashtag: str) -> bool:
    """Open the hashtag feed — pure signal to the Instagram algorithm."""
    try:
        cl.hashtag_medias_recent(hashtag, amount=9)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("Browse failed for #%s: %s", hashtag, exc)
        return False


def is_blocked(exc: BaseException) -> bool:
    return isinstance(
        exc,
        (ChallengeRequired, FeedbackRequired, PleaseWaitFewMinutes, RateLimitError),
    )


def is_challenge(exc: BaseException) -> bool:
    return isinstance(exc, ChallengeRequired)


def all_targets(targets: Iterable[str]) -> list[str]:
    return list(targets)
