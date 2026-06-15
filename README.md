# MyFeed

> Instagram feed personalization, made glassmorphic.
>
> Built for the MyFeed Hackathon Challenge.

MyFeed connects to a user's Instagram account, learns the topics
they want to see more of, and runs a small automation worker in the
background to gradually retrain the feed toward those topics.

## Repo layout

```
.
├── src/                  # Expo / React Native mobile app
│   ├── app/              # expo-router screens
│   │   ├── (auth)/       # login, signup
│   │   ├── (onboarding)/ # 4 required screens
│   │   └── (app)/        # dashboard, settings, preferences, privacy
│   ├── components/
│   │   ├── glass/        # GlassCard, GradientButton, Chip, StatusPill, ...
│   │   ├── auth/         # AuthForm
│   │   └── onboarding/   # OnboardingDots
│   ├── constants/        # colors, spacing, typography, topics
│   ├── contexts/         # AuthContext
│   ├── lib/              # supabase client, db helpers, encryption, automation-api
│   └── types/            # database type definitions
├── supabase/
│   └── schema.sql        # Paste into Supabase SQL editor
├── automation/           # Python worker (deploys to Railway)
│   ├── app.py            # FastAPI server
│   ├── worker.py         # Core per-user automation pass
│   ├── instagrapi_client.py
│   ├── supabase_client.py
│   ├── crypto.py         # AES-256-CBC, matches mobile src/lib/encryption.ts
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── app.json              # Expo config (Supabase + automation URLs live here)
├── tailwind.config.js    # NativeWind v4 config
├── babel.config.js
├── metro.config.js
└── railway.json          # Railway deploy config
```

## Quick start (mobile)

```bash
npm install
npx expo start
```

Set your real Supabase URL + anon key in `app.json` under
`expo.extra.supabaseUrl` and `expo.extra.supabaseAnonKey`, then
re-run.

## Quick start (worker)

```bash
cd automation
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values
uvicorn automation.app:app --reload --port 8000
```

## Build for the hackathon

See [BUILD.md](./BUILD.md) for the full APK + TestFlight build guide.
