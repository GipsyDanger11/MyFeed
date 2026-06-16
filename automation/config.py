"""
Environment-driven configuration for the MyFeed automation worker.

Reads once on import. Fail loudly if the secrets we need are missing.

If `automation/.env` exists, it is loaded automatically (python-dotenv),
so local dev works without exporting vars in your shell.
"""
import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv  # type: ignore

    # Look for automation/.env two levels up from this file's parent.
    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path, override=False)
except ImportError:  # python-dotenv is optional
    pass


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required env var: {name}. "
            f"Set it in Railway → Variables before deploying."
        )
    return value


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"Env var {name} must be an integer, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_key: str
    encryption_key: str
    worker_interval_seconds: int
    max_likes_per_day: int
    max_follows_per_day: int
    delay_min_seconds: int
    delay_max_seconds: int
    port: int
    log_level: str
    proxy: str | None


def load() -> Settings:
    return Settings(
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_key=_required("SUPABASE_SERVICE_KEY"),
        encryption_key=_required("ENCRYPTION_KEY"),
        worker_interval_seconds=_int("WORKER_INTERVAL_SECONDS", 1800),
        max_likes_per_day=_int("MAX_LIKES_PER_DAY", 30),
        max_follows_per_day=_int("MAX_FOLLOWS_PER_DAY", 10),
        delay_min_seconds=_int("DELAY_MIN_SECONDS", 8),
        delay_max_seconds=_int("DELAY_MAX_SECONDS", 30),
        port=_int("PORT", 8000),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        proxy=os.environ.get("INSTAGRAPI_PROXY") or None,
    )


SETTINGS = load()
