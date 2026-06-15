"""
MyFeed automation worker — Python service that runs on Railway.

Responsibilities:
  1. Expose a small FastAPI HTTP API for the mobile app
     (POST /connect-instagram, POST /run-now, GET /health).
  2. Periodically run the scheduler, which iterates through every
     active user and performs a small number of human-like Instagram
     actions (likes, follows, feed browsing) based on their
     boost preferences.
  3. Stay safe: max 30 likes / 10 follows per user per day, with
     random 8-30s delays between actions, and immediate skip on
     challenge / captcha responses.

Environment variables (set in Railway):
  SUPABASE_URL                  - https://xxx.supabase.co
  SUPABASE_SERVICE_KEY          - service_role key (server only!)
  ENCRYPTION_KEY                - same 32+ char key as the mobile app
  WORKER_INTERVAL_SECONDS       - default 1800 (30 min)
  MAX_LIKES_PER_DAY             - default 30
  MAX_FOLLOWS_PER_DAY           - default 10
  DELAY_MIN_SECONDS             - default 8
  DELAY_MAX_SECONDS             - default 30
  PORT                          - default 8000
"""

__version__ = "1.0.0"
