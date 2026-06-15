# MyFeed Automation Worker

Long-running Python service that performs the actual Instagram
automation for MyFeed. It is **deployed separately** to Railway and
talks to the mobile app over HTTPS.

## What it does

1. **Exposes a small HTTP API** the mobile app uses to:
   - `POST /connect-instagram` — log in to Instagram, return an encrypted session blob
   - `POST /run-now` — trigger an immediate automation pass for a user
   - `GET /health` — liveness probe
2. **Runs a scheduled loop** every `WORKER_INTERVAL_SECONDS` (default 30 min)
   that iterates over every onboarded, non-paused user and performs
   a small number of human-like Instagram actions based on their
   boost topics.

## Safety rails

- Max `MAX_LIKES_PER_DAY` (default 30) per user per day
- Max `MAX_FOLLOWS_PER_DAY` (default 10) per user per day
- Random `DELAY_MIN_SECONDS`–`DELAY_MAX_SECONDS` (default 8–30s) between actions
- Hard cap of 6 actions per scheduler pass
- Any Instagram `ChallengeRequired` / `FeedbackRequired` / rate-limit
  immediately marks the user as `error` and stops touching their account

## Encrypted sessions

The mobile app and the worker share `ENCRYPTION_KEY` (≥ 16 chars).
Sessions are encrypted with **AES-256-CBC** (PKCS7, SHA-256-derived
key + IV) so neither side ever stores the Instagram session in
plaintext. The crypto helper in `crypto.py` matches the
implementation in `src/lib/encryption.ts`.

## Local development

```bash
cd automation
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in real values
uvicorn automation.app:app --reload --port 8000
```

Visit `http://localhost:8000/health` to confirm the worker is up.

## Deploy to Railway

1. Create a new Railway project.
2. Connect this repo.
3. Set the root to the repo root; Railway auto-detects
   `railway.json` and `automation/Dockerfile`.
4. Add the env vars from `.env.example` to **Variables**.
5. Deploy. Health-check URL: `https://<railway-url>/health`.
6. Copy the Railway URL into the mobile app:
   `app.json` → `expo.extra.automationApiUrl`.
