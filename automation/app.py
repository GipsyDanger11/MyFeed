"""
FastAPI HTTP surface for the MyFeed automation worker.

Endpoints (mobile app talks to these):

  GET  /health
      Liveness probe. Returns worker uptime + status counts.

  POST /connect-instagram
      Body: { user_id, username, password }
      Logs into Instagram, returns an encrypted session blob.
      The mobile app double-encrypts and persists it in Supabase.

  POST /run-now
      Body: { user_id }
      Triggers a worker pass for a single user immediately
      (used by the "Run now" button in the dashboard).

A background asyncio task runs run_for_all_users() every
WORKER_INTERVAL_SECONDS for free, even if the app never calls
/run-now.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import crypto
from . import instagrapi_client as ig
from . import supabase_client as db
from .config import SETTINGS
from .worker import run_for_user

logging.basicConfig(
    level=SETTINGS.log_level,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
log = logging.getLogger("myfeed.automation")

app = FastAPI(title="MyFeed Automation", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

STARTED_AT = time.time()


# ---------------- request models ----------------

class ConnectBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class ImportSessionBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    sessionid: str = Field(..., min_length=1)
    ds_user_id: str = Field(..., min_length=1)
    csrftoken: str = Field(default="")


class RunNowBody(BaseModel):
    user_id: str = Field(..., min_length=1)


# ---------------- routes ----------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "uptime_seconds": int(time.time() - STARTED_AT),
        "instagrapi": ig.is_available(),
        "interval_seconds": SETTINGS.worker_interval_seconds,
    }


@app.post("/connect-instagram")
async def connect_instagram(body: ConnectBody) -> dict[str, Any]:
    if not ig.is_available():
        raise HTTPException(status_code=503, detail="instagrapi not installed in this build")
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(ig.login_or_get_challenge, body.username, body.password),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        log.warning("Login timed out for %s", body.username)
        db.set_status(body.user_id, "error", "Login timed out")
        raise HTTPException(
            status_code=408,
            detail="Login took too long. Your Instagram may have sent a verification email — check it, then try again.",
        )
    except Exception as exc:
        msg = str(exc)
        log.warning("Login failed for %s: %s", body.username, msg)
        db.set_status(body.user_id, "error", msg)
        if "password" in msg.lower() or "invalid" in msg.lower():
            detail = "Invalid username or password."
        elif "blacklist" in msg.lower() or "ip" in msg.lower():
            detail = "Instagram blocked this IP. Use a different network or wait a few hours."
        elif "challenge" in msg.lower() or "467" in msg or "reels_tray" in msg:
            detail = "Instagram accepted the password but your account needs manual verification. Open the Instagram app on your phone and follow the prompts, then wait 1-2 hours before trying again."
        else:
            detail = msg[:200]
        raise HTTPException(status_code=401, detail=detail)

    if isinstance(result, ig.ChallengeState):
        # Encrypt the challenge state so the frontend can send it back
        challenge_state_encrypted = crypto.encrypt(
            json.dumps({
                "settings": result.settings,
                "last_json": result.last_json,
                "username": result.username,
                "password": result.password,
            }),
            SETTINGS.encryption_key,
        )
        log.info("Challenge state saved for %s", body.username)
        db.set_status(body.user_id, "challenge_required", None)
        return {
            "ok": True,
            "challenge_required": True,
            "challenge_state": challenge_state_encrypted,
            "user_id": body.user_id,
            "username": body.username,
        }

    # Success — result is (client, encrypted)
    cl, encrypted = result
    try:
        db.upsert_connection(body.user_id, body.username, encrypted)
    except Exception as exc:
        log.exception("DB upsert failed")
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")
    return {
        "ok": True,
        "user_id": body.user_id,
        "username": body.username,
        "encrypted_session": encrypted,
    }


@app.post("/import-session")
async def import_session(body: ImportSessionBody) -> dict[str, Any]:
    """Import a real Instagram session from browser cookies.

    Use this instead of /connect-instagram when Instagram blocks your IP
    or triggers 467 after login. You provide cookies from a real browser
    login and the worker uses them directly — no detectable login flow.
    """
    if not ig.is_available():
        raise HTTPException(status_code=503, detail="instagrapi not installed")
    settings_dict = ig.build_settings_from_cookies(
        body.sessionid, body.ds_user_id, body.csrftoken,
    )
    # Try to verify, but don't fail on challenge — the session might still work
    # after the user resolves the challenge on their browser.
    err = ig.verify_session(settings_dict)
    if err:
        log.warning("Imported session has issues for %s: %s", body.username, err)
    encrypted = ig.encrypt_session(settings_dict)
    try:
        db.upsert_connection(body.user_id, body.username, encrypted)
    except Exception as exc:
        log.exception("DB upsert failed")
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")
    log.info("Session imported for %s (verify: %s)", body.username, "OK" if not err else "WARN")
    return {
        "ok": True,
        "user_id": body.user_id,
        "username": body.username,
    }


class ResolveChallengeBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    challenge_state: str = Field(
        ..., min_length=1,
        description="Encrypted challenge state from /connect-instagram or /send-challenge-code",
    )
    code: str = Field(..., min_length=1, description="Security code from Instagram email/SMS")


class SendChallengeBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    challenge_state: str = Field(
        ..., min_length=1,
        description="Encrypted challenge state from /connect-instagram response",
    )


@app.post("/send-challenge-code")
async def send_challenge_code(body: SendChallengeBody) -> dict[str, Any]:
    """Trigger Instagram to send a verification code to the user's email/SMS.

    Takes the challenge state from /connect-instagram, makes the initial
    challenge API calls, and returns an *updated* challenge state that
    should be passed to /resolve-challenge along with the code the user
    receives.
    """
    if not ig.is_available():
        raise HTTPException(status_code=503, detail="instagrapi not installed in this build")
    try:
        state = json.loads(crypto.decrypt(body.challenge_state, SETTINGS.encryption_key))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid challenge state: {exc}")
    try:
        updated_settings, updated_last_json = await asyncio.wait_for(
            asyncio.to_thread(
                ig.trigger_challenge_code,
                state["settings"],
                state["last_json"],
                state["username"],
                state["password"],
            ),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        log.warning("Trigger challenge code timed out for %s", body.username)
        raise HTTPException(status_code=408, detail="Sending verification code timed out. Try again.")
    except Exception as exc:
        msg = str(exc)
        log.warning("Trigger challenge code failed for %s: %s", body.username, msg)
        raise HTTPException(status_code=401, detail=msg[:200])

    # Re-encrypt with updated settings + last_json
    updated_state_encrypted = crypto.encrypt(
        json.dumps({
            "settings": updated_settings,
            "last_json": updated_last_json,
            "username": state["username"],
            "password": state["password"],
        }),
        SETTINGS.encryption_key,
    )
    log.info("Verification code sent for %s", body.username)
    return {
        "ok": True,
        "challenge_state": updated_state_encrypted,
        "user_id": body.user_id,
        "username": body.username,
    }


@app.post("/resolve-challenge")
async def resolve_challenge(body: ResolveChallengeBody) -> dict[str, Any]:
    """Submit a security code and complete the Instagram login.

    The `challenge_state` should be the updated state returned by
    /send-challenge-code (not the initial one from /connect-instagram).
    """
    if not ig.is_available():
        raise HTTPException(status_code=503, detail="instagrapi not installed in this build")
    try:
        state = json.loads(crypto.decrypt(body.challenge_state, SETTINGS.encryption_key))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid challenge state: {exc}")
    try:
        cl, encrypted = await asyncio.wait_for(
            asyncio.to_thread(
                ig.submit_challenge_code,
                state["settings"],
                state["last_json"],
                body.code,
                state["username"],
                state["password"],
            ),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        log.warning("Challenge resolve timed out for %s", body.username)
        db.set_status(body.user_id, "error", "Challenge resolve timed out")
        raise HTTPException(status_code=408, detail="Verification took too long. Try again.")
    except ig.ChallengeRequired:
        log.warning("Challenge still required after code submission for %s", body.username)
        db.set_status(body.user_id, "error", "Invalid code")
        raise HTTPException(status_code=403, detail="Invalid code or Instagram still requires verification. Check the code and try again.")
    except ig.FeedbackRequired as exc:
        log.warning("Feedback required for %s: %s", body.username, exc)
        db.set_status(body.user_id, "error", str(exc))
        raise HTTPException(status_code=429, detail=f"Instagram feedback required: {exc}")
    except Exception as exc:
        msg = str(exc)
        log.warning("Challenge resolve failed for %s: %s", body.username, msg)
        db.set_status(body.user_id, "error", msg)
        raise HTTPException(status_code=401, detail=msg[:200])
    try:
        db.upsert_connection(body.user_id, body.username, encrypted)
    except Exception as exc:
        log.exception("DB upsert failed")
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")
    return {
        "ok": True,
        "user_id": body.user_id,
        "username": body.username,
        "encrypted_session": encrypted,
    }


@app.post("/run-now")
async def run_now(body: RunNowBody, bg: BackgroundTasks) -> dict[str, Any]:
    # Run synchronously so the app gets an immediate summary; for
    # larger deployments, this can be moved to a queue.
    summary = await asyncio.to_thread(run_for_user, body.user_id)
    return {"ok": True, "summary": summary}


# ---------------- background scheduler ----------------

async def _scheduler() -> None:
    while True:
        log.info("Scheduler tick — running pass for all users")
        try:
            results = await asyncio.to_thread(_safe_run_for_all)
            log.info("Scheduler pass complete: %d users", len(results))
        except Exception as exc:  # noqa: BLE001
            log.exception("Scheduler pass crashed: %s", exc)
        await asyncio.sleep(SETTINGS.worker_interval_seconds)


def _safe_run_for_all() -> list[dict[str, Any]]:
    from .worker import run_for_all_users  # local import to avoid cycles
    return run_for_all_users()


@app.on_event("startup")
async def _startup() -> None:
    log.info("Starting scheduler (interval=%ss)", SETTINGS.worker_interval_seconds)
    asyncio.create_task(_scheduler())


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run("automation.app:app", host="0.0.0.0", port=SETTINGS.port)
