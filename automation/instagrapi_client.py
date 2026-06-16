"""
instagrapi wrapper. Centralises session load/save, challenge detection,
and the three actions we perform: like, follow, browse.

If instagrapi is not installed (e.g. in CI / lint env), the wrapper
falls back to a no-op stub so the rest of the app still imports.
"""
from __future__ import annotations

import json
import logging
import random
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


# Real-device fingerprint so Instagram sees a OnePlus 6T instead of a server.
ONEPLUS_6T_DEVICE = {
    "app_version": "269.0.0.18.75",
    "android_version": 26,
    "android_release": "8.0.0",
    "dpi": "480dpi",
    "resolution": "1080x1920",
    "manufacturer": "OnePlus",
    "device": "devitron",
    "model": "6T Dev",
    "cpu": "qcom",
    "version_code": "314665256",
}


def is_available() -> bool:
    return _HAS_INSTAGRAPI


def _sync_cookies(settings_dict: dict[str, Any]) -> None:
    """Ensure cookies dict is populated, falling back to authorization_data.

    instagrapi's get_settings() serialises self.private.cookies via
    dict_from_cookiejar(), but after a login that hits 467 on the
    post-login check the cookiejar may be empty while the
    ig-set-authorization header was parsed into authorization_data.
    """
    if settings_dict.get("cookies"):
        return
    auth = settings_dict.get("authorization_data") or {}
    sessionid = auth.get("sessionid")
    ds_user_id = auth.get("ds_user_id") or ""
    if sessionid:
        settings_dict["cookies"] = {
            "sessionid": sessionid,
            "ds_user_id": ds_user_id,
        }


def decrypt_session(encrypted_b64: str) -> dict[str, Any]:
    settings = json.loads(crypto.decrypt(encrypted_b64, SETTINGS.encryption_key))
    _sync_cookies(settings)
    return settings


def encrypt_session(settings_dict: dict[str, Any]) -> str:
    _sync_cookies(settings_dict)
    plain = json.dumps(settings_dict)
    encrypted = crypto.encrypt(plain, SETTINGS.encryption_key)
    # Verify round-trip immediately
    decrypted = crypto.decrypt(encrypted, SETTINGS.encryption_key)
    if decrypted != plain:
        log.error("SESSION ROUND-TRIP FAILED! plain=%d encrypted=%d decrypted=%d match=%s",
                  len(plain), len(encrypted), len(decrypted), plain[:20] == decrypted[:20])
        log.error("encrypted[:50]=%s", encrypted[:50])
        log.error("decrypted[:50]=%s", decrypted[:50])
    else:
        log.info("Session round-trip OK (%d bytes -> %d chars)", len(plain), len(encrypted))
    return encrypted


def _patch_client(cl: Any) -> None:
    """Apply human-like device specs + user-agent + proxy in the correct order.

    Must be called *after* `set_settings()` so it overrides whatever
    device was saved in the session JSON.
    """
    cl.delay_range = (SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    cl.set_device(ONEPLUS_6T_DEVICE)
    cl.set_user_agent()
    if SETTINGS.proxy:
        proxies = [p.strip() for p in SETTINGS.proxy.split(",") if p.strip()]
        proxy = random.choice(proxies) if len(proxies) > 1 else proxies[0]
        log.info("Using proxy: %s", proxy.split("@")[-1] if "@" in proxy else proxy[:30])
        cl.set_proxy(proxy)


def build_client(settings_dict: dict[str, Any] | None = None) -> Any:
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable(
            "instagrapi is not installed. Add it to requirements.txt."
        )
    cl = Client()
    cl.delay_range = (SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    cl.handle_exception = lambda client, exc: (_ for _ in ()).throw(exc)
    if settings_dict:
        cl.set_settings(settings_dict)
        # Don't call _patch_client here — it would overwrite the saved
        # device/UA with freshly-generated values, which Instagram detects
        # as a mismatch and returns 400. The saved session already has the
        # correct device fingerprint from the original login.
        if SETTINGS.proxy:
            proxies = [p.strip() for p in SETTINGS.proxy.split(",") if p.strip()]
            proxy = random.choice(proxies) if len(proxies) > 1 else proxies[0]
            cl.set_proxy(proxy)
    return cl


class ChallengeState:
    """Returned when Instagram requires a security code (email/SMS)."""

    def __init__(self, settings: dict[str, Any], last_json: dict[str, Any], username: str, password: str) -> None:
        self.settings = settings
        self.last_json = last_json
        self.username = username
        self.password = password


def login(username: str, password: str) -> tuple[Any, str]:
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable("instagrapi is not installed.")
    cl = Client()
    _patch_client(cl)
    try:
        cl.login(username, password)
    except Exception as exc:
        if cl.user_id:
            log.warning("Login POST succeeded but post-login check failed: %s", exc)
        else:
            raise
    settings = cl.get_settings()
    log.info("Session user_id=%s, has_cookies=%s, has_auth=%s, auth_user=%s",
             settings.get("uuids",{}).get("uuid","?")[:8],
             bool(settings.get("cookies")),
             bool(settings.get("authorization_data")),
             settings.get("authorization_data",{}).get("ds_user_id","?"))
    encrypted = encrypt_session(settings)
    return cl, encrypted


def login_or_get_challenge(username: str, password: str) -> tuple[Any, str] | ChallengeState:
    """Try to login. Returns (client, encrypted_session) on success,
    or ChallengeState when Instagram wants a security code."""
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable("instagrapi is not installed.")
    cl = Client()
    _patch_client(cl)
    try:
        cl.login(username, password)
    except ChallengeRequired as exc:
        last_json = dict(cl.last_json) if isinstance(cl.last_json, dict) else {}
        log.info("Challenge required for %s — last_json keys: %s", username, list(last_json.keys()))
        return ChallengeState(cl.get_settings(), last_json, username, password)
    except Exception as exc:
        if cl.user_id:
            log.warning("Login POST succeeded but post-login check failed: %s", exc)
        else:
            raise
    settings = cl.get_settings()
    log.info("Session user_id=%s, has_cookies=%s, has_auth=%s",
             settings.get("authorization_data",{}).get("ds_user_id","?")[:8],
             bool(settings.get("cookies")),
             bool(settings.get("authorization_data")))
    encrypted = encrypt_session(settings)
    return cl, encrypted


def trigger_challenge_code(
    settings_dict: dict[str, Any],
    last_json: dict[str, Any],
    username: str,
    password: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Restore client from challenge state and make the initial challenge
    API calls that tell Instagram to send a verification email/SMS.

    Returns (updated_settings, updated_last_json) which must be saved and
    passed to `submit_challenge_code` when the user provides the code.
    """
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable("instagrapi is not installed.")
    cl = Client()
    cl.delay_range = (SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    cl.set_settings(settings_dict)
    _patch_client(cl)
    cl.handle_exception = lambda client, exc: (_ for _ in ()).throw(exc)

    log.info("=== trigger: initial last_json keys: %s", list(last_json.keys()))

    # Manually make the challenge URL request with proper params
    api_path = last_json.get("challenge", {}).get("api_path", "")
    challenge_url = cl._normalize_challenge_api_path(api_path)

    try:
        user_id, nonce_code = challenge_url.split("/")[2:4]
    except (ValueError, IndexError):
        nonce_code = ""
    challenge_context = last_json.get("challenge", {}).get("challenge_context")
    if not challenge_context and nonce_code:
        challenge_context = json.dumps({
            "step_name": "", "nonce_code": nonce_code,
            "user_id": 0, "is_stateless": False,
        })
    params = {"guid": cl.uuid, "device_id": cl.android_device_id}
    if challenge_context:
        params["challenge_context"] = challenge_context

    cl._send_private_request(challenge_url.lstrip("/"), params=params)
    log.info("=== trigger: GET done step=%s status=%s action=%s bloks=%s",
             cl.last_json.get("step_name"), cl.last_json.get("status"),
             cl.last_json.get("action"), cl.last_json.get("bloks_action"))
    log.info("=== trigger: keys=%s", list(cl.last_json.keys()))

    if cl.last_json.get("bloks_action"):
        log.info("=== trigger: bloks_action=%s type=%s",
                 cl.last_json.get("bloks_action"), cl.last_json.get("challenge_type_enum_str"))

    # Handle BLOKS redirect challenge
    BLOKS_REDIRECT_ACTION = "com.bloks.www.ig.challenge.redirect.async"
    if cl.last_json.get("bloks_action") == BLOKS_REDIRECT_ACTION:
        ctx = cl.last_json.get("challenge_context")
        if ctx:
            cl.bloks_challenge_take_challenge(challenge_context=ctx, choice=0)
            log.info("=== trigger: BLOKS done status=%s action=%s step=%s",
                     cl.last_json.get("status"), cl.last_json.get("action"),
                     cl.last_json.get("step_name"))
            log.info("=== trigger: BLOKS keys=%s", list(cl.last_json.keys()))

    # Check if there's a verify_email / verify_phone step
    step = cl.last_json.get("step_name", "")
    log.info("=== trigger: final step_name=%r status=%s action=%s", step,
             cl.last_json.get("status"), cl.last_json.get("action"))

    updated_settings = cl.get_settings()
    updated_last_json = dict(cl.last_json) if isinstance(cl.last_json, dict) else {}
    return updated_settings, updated_last_json


def submit_challenge_code(
    settings_dict: dict[str, Any],
    last_json: dict[str, Any],
    code: str,
    username: str,
    password: str,
) -> tuple[Any, str]:
    """Submit a security code for Instagram challenge and return logged-in client + session.

    The `settings_dict` and `last_json` should be the UPDATED values returned
    by `trigger_challenge_code` (which advances the challenge past the
    select-verify-method step and triggers Instagram to send the code).
    """
    if not _HAS_INSTAGRAPI:
        raise InstagrapiUnavailable("instagrapi is not installed.")
    cl = Client()
    cl.delay_range = (SETTINGS.delay_min_seconds, SETTINGS.delay_max_seconds)
    cl.set_settings(settings_dict)
    _patch_client(cl)
    cl.last_json = last_json
    cl.challenge_code_handler = lambda u, c: code
    log.info("Resolving challenge for %s with code", username)
    cl.challenge_resolve(last_json)
    # After challenge is resolved, complete the login
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


def build_settings_from_cookies(
    sessionid: str, ds_user_id: str, csrftoken: str = "",
) -> dict[str, Any]:
    """Build instagrapi settings dict from real browser cookies.

    This skips instagrapi's detectable login flow entirely — the
    session comes from a real Instagram login on your phone/browser.
    """
    import uuid
    from copy import deepcopy

    device = deepcopy(ONEPLUS_6T_DEVICE)
    settings = {
        "cookies": {
            "sessionid": sessionid,
            "ds_user_id": ds_user_id,
            "csrftoken": csrftoken,
        },
        "authorization_data": {
            "ds_user_id": ds_user_id,
            "sessionid": sessionid,
            "csrftoken": csrftoken,
            "should_use_header_over_cookies": True,
        },
        "uuids": {
            "uuid": str(uuid.uuid4()),
            "phone_id": str(uuid.uuid4()),
            "client_session_id": str(uuid.uuid4()),
            "device_id": "android-" + uuid.uuid4().hex[:16],
        },
        "device_settings": device,
        "user_agent": (
            f"Instagram {device['app_version']} Android "
            f"({device['android_version']}/{device['android_release']}; "
            f"{device['dpi']}; {device['resolution']}; {device['manufacturer']}; "
            f"{device['model']}; {device['device']}; {device['cpu']}; en_US)"
        ),
    }
    return settings


def verify_session(settings_dict: dict[str, Any]) -> str | None:
    """Test if a settings dict works by fetching timeline. Returns None if OK, error string if not."""
    try:
        cl = build_client(settings_dict)
        cl.get_timeline_feed()
        return None
    except Exception as exc:
        return str(exc)


def is_blocked(exc: BaseException) -> bool:
    return isinstance(
        exc,
        (ChallengeRequired, FeedbackRequired, PleaseWaitFewMinutes, RateLimitError),
    )


def is_challenge(exc: BaseException) -> bool:
    return isinstance(exc, ChallengeRequired)


def all_targets(targets: Iterable[str]) -> list[str]:
    return list(targets)
