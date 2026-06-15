"""Smoke test for the MyFeed automation modules."""
import os
import sys

# Set required env vars BEFORE importing config
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")
os.environ.setdefault("ENCRYPTION_KEY", "test-key-12345")

# Mock instagrapi
class _Stub:
    pass

sys.modules.setdefault("instagrapi", _Stub())
sys.modules.setdefault("instagrapi.exceptions", _Stub())

from automation import config  # noqa: E402
print(f"[ok] config: port={config.SETTINGS.port} interval={config.SETTINGS.worker_interval_seconds}s")

from automation import crypto  # noqa: E402
enc = crypto.encrypt("hello world", "myfeed-test-key-1234")
dec = crypto.decrypt(enc, "myfeed-test-key-1234")
assert dec == "hello world", f"roundtrip failed: {dec!r}"
print(f"[ok] crypto: roundtrip ok ({enc[:24]}...)")

from automation import instagrapi_client as ig  # noqa: E402
print(f"[ok] instagrapi_client: available={ig.is_available()}")

from automation import worker  # noqa: E402
assert callable(worker.run_for_user)
assert callable(worker.run_for_all_users)
print("[ok] worker: run_for_user / run_for_all_users callable")

from automation import supabase_client  # noqa: E402
print("[ok] supabase_client: imports")

from automation import app  # noqa: E402
routes = sorted(r.path for r in app.app.routes if hasattr(r, "path"))
print(f"[ok] app: routes={routes}")
assert "/health" in routes
assert "/connect-instagram" in routes
assert "/run-now" in routes

print("\nAll automation modules import & basic sanity-check pass.")
