"""
Supabase access layer for the worker.

We deliberately talk to `postgrest-py` directly instead of `supabase-py`
because the latter (≥ 2.30) has a bug that double-appends `/rest/v1`
to the URL. Since the worker only needs DB access, the postgrest
client is enough — no auth, storage, or realtime needed.

All callers get back plain dicts shaped exactly like
src/types/database.ts in the mobile app.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Iterable

from postgrest import SyncPostgrestClient

from .config import SETTINGS


def _client() -> SyncPostgrestClient:
    # Be defensive: the URL may be either the bare project URL
    # (https://xxx.supabase.co) or already include /rest/v1.
    base = SETTINGS.supabase_url.rstrip("/")
    for suffix in ("/rest/v1", "/rest/v1/"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    return SyncPostgrestClient(
        f"{base}/rest/v1",
        headers={
            "apikey": SETTINGS.supabase_service_key,
            "Authorization": f"Bearer {SETTINGS.supabase_service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        schema="public",
    )


# ---------------- profiles ----------------

def get_profile(user_id: str) -> dict[str, Any] | None:
    res = _client().from_("profiles").select("*").eq("id", user_id).maybe_single().execute()
    return res.data if res else None


def list_active_users() -> list[dict[str, Any]]:
    res = (
        _client()
        .from_("profiles")
        .select("*")
        .not_.is_("onboarded_at", "null")
        .eq("automation_paused", False)
        .execute()
    )
    return list(res.data or [])


def update_personalization_score(user_id: str, score: int) -> None:
    _client().from_("profiles").update(
        {
            "personalization_score": max(0, min(100, int(score))),
            "updated_at": dt.datetime.utcnow().isoformat() + "Z",
        }
    ).eq("id", user_id).execute()


# ---------------- preferences ----------------

def get_preferences(user_id: str) -> list[dict[str, Any]]:
    res = _client().from_("preferences").select("*").eq("user_id", user_id).execute()
    return list(res.data or [])


def get_boost_hashtags(user_id: str) -> list[str]:
    return [p["topic"] for p in get_preferences(user_id) if p["direction"] == "boost"]


def get_reduce_hashtags(user_id: str) -> list[str]:
    return [p["topic"] for p in get_preferences(user_id) if p["direction"] == "reduce"]


# ---------------- instagram_connections ----------------

def get_connection(user_id: str) -> dict[str, Any] | None:
    res = _client().from_("instagram_connections").select("*").eq("user_id", user_id).maybe_single().execute()
    return res.data if res else None


def set_status(user_id: str, status: str, error: str | None = None) -> None:
    _client().from_("instagram_connections").update(
        {
            "status": status,
            "error_message": error,
            "updated_at": dt.datetime.utcnow().isoformat() + "Z",
        }
    ).eq("user_id", user_id).execute()


def set_last_sync(user_id: str) -> None:
    _client().from_("instagram_connections").update(
        {
            "status": "connected",
            "last_sync": dt.datetime.utcnow().isoformat() + "Z",
            "error_message": None,
            "updated_at": dt.datetime.utcnow().isoformat() + "Z",
        }
    ).eq("user_id", user_id).execute()


def upsert_connection(
    user_id: str,
    username: str,
    encrypted_session: str,
) -> None:
    _client().from_("instagram_connections").upsert(
        {
            "user_id": user_id,
            "username": username,
            "encrypted_session": encrypted_session,
            "status": "connected",
            "last_sync": dt.datetime.utcnow().isoformat() + "Z",
            "updated_at": dt.datetime.utcnow().isoformat() + "Z",
        },
        on_conflict="user_id",
    ).execute()


# ---------------- automation_logs ----------------

def log_action(
    user_id: str,
    action: str,
    target: str | None = None,
    success: bool = True,
    error: str | None = None,
) -> None:
    _client().from_("automation_logs").insert(
        {
            "user_id": user_id,
            "action": action,
            "target": target,
            "success": success,
            "error_message": error,
        }
    ).execute()


def count_actions_today(user_id: str) -> dict[str, int]:
    start = dt.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"
    res = (
        _client()
        .from_("automation_logs")
        .select("action", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", start)
        .execute()
    )
    rows: Iterable[dict[str, Any]] = res.data or []
    counts: dict[str, int] = {"like": 0, "follow": 0, "browse": 0}
    for r in rows:
        a = r.get("action")
        if a in counts:
            counts[a] += 1
    return counts


def recent_logs(user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    res = (
        _client()
        .from_("automation_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(res.data or [])
