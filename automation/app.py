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
import logging
import time
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

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

STARTED_AT = time.time()


# ---------------- request models ----------------

class ConnectBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


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
        cl, encrypted = ig.login(body.username, body.password)
    except Exception as exc:  # noqa: BLE001
        log.warning("Login failed for %s: %s", body.username, exc)
        db.set_status(body.user_id, "error", f"Login failed: {exc}")
        raise HTTPException(status_code=401, detail=f"Instagram login failed: {exc}")
    try:
        db.upsert_connection(body.user_id, body.username, encrypted)
    except Exception as exc:  # noqa: BLE001
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
