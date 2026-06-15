"""
Supabase access layer. Uses the service_role key so we can read every
user and write automation_logs that bypass RLS.

Returns plain dicts shaped exactly like src/types/database.ts in the
mobile app, so both sides agree on field names.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Iterable

from supabase import Client, create_client

from .config import SETTINGS


def _client() -> Client:
    return create_client(SETTINGS.supabase_url, SETTINGS.supabase_service_key)


# ---------------- profiles ----------------

def get_profile(user_id: str) -> dict[str, Any] | None:
    res = (
        _client()
        .table("profiles")
        .select("*")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def list_active_users() -> list[dict[str, Any]]:
    res = (
        _client()
        .table("profiles")
        .select("*")
        .is_("onboarded_at", "not.null")
        .eq("automation_paused", False)
        .execute()
    )
    return list(res.data or [])


def update_personalization_score(user_id: str, score: int) -> None:
    _client().table("profiles").update(
        {
            "personalization_score": max(0, min(100, int(score))),
            "updated_at": dt.datetime.utcnow().isoformat() + "Z",
        }
    ).eq("id", user_id).execute()


# ---------------- preferences ----------------

def get_preferences(user_id: str) -> list[dict[str, Any]]:
    res = (
        _client()
        .table("preferences")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return list(res.data or [])


def get_boost_hashtags(user_id: str) -> list[str]:
    return [p["topic"] for p in get_preferences(user_id) if p["direction"] == "boost"]


def get_reduce_hashtags(user_id: str) -> list[str]:
    return [p["topic"] for p in get_preferences(user_id) if p["direction"] == "reduce"]


# ---------------- instagram_connections ----------------

def get_connection(user_id: str) -> dict[str, Any] | None:
    res = (
        _client()
        .table("instagram_connections")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def set_status(user_id: str, status: str, error: str | None = None) -> None:
    _client().table("instagram_connections").update(
        {
            "status": status,
            "error_message": error,
            "updated_at": dt.datetime.utcnow().isoformat() + "Z",
        }
    ).eq("user_id", user_id).execute()


def set_last_sync(user_id: str) -> None:
    _client().table("instagram_connections").update(
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
    _client().table("instagram_connections").upsert(
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
    _client().table("automation_logs").insert(
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
        .table("automation_logs")
        .select("action, success", count="exact")
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
        .table("automation_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(res.data or [])
