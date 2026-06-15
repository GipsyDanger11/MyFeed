# Build & Submit — MyFeed

## 0. One-time setup

### 0.1 Supabase
1. Create a new project at https://supabase.com.
2. Project Settings → API → copy the **Project URL** and the
   `anon` **public** key. Save them — you'll paste them in `app.json`.
3. SQL editor → New query → paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql) → Run.
4. Project Settings → API → copy the **service_role** key (NOT the
   anon key). This is server-only and goes in Railway.

### 0.2 Google OAuth (optional, for one-tap sign-in)
- Create OAuth credentials in Google Cloud Console.
- Supabase → Authentication → Providers → Google → paste client id/secret.
- Add `myfeed://auth/callback` as an authorized redirect URI in Google.

### 0.3 Railway
1. https://railway.app → New Project → Deploy from GitHub repo.
2. Point Railway at this repo. It will auto-detect `railway.json`.
3. **Variables** tab → add the following:

   | Key                       | Value                                    |
   | ------------------------- | ---------------------------------------- |
   | `SUPABASE_URL`            | from step 0.1                            |
   | `SUPABASE_SERVICE_KEY`    | from step 0.1 (service_role, server only)|
   | `ENCRYPTION_KEY`          | a 16+ char random string, same as mobile |
   | `WORKER_INTERVAL_SECONDS` | `1800`                                   |
   | `MAX_LIKES_PER_DAY`       | `30`                                     |
   | `MAX_FOLLOWS_PER_DAY`     | `10`                                     |
   | `DELAY_MIN_SECONDS`       | `8`                                      |
   | `DELAY_MAX_SECONDS`       | `30`                                     |
   | `LOG_LEVEL`               | `INFO`                                   |

4. Deploy. Once the build is green, copy the Railway URL
   (e.g. `https://myfeed-automation.up.railway.app`).

### 0.4 Wire the URLs into the mobile app
Open `app.json` and replace the placeholders under `expo.extra`:

```json
"extra": {
  "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
  "supabaseAnonKey": "eyJhbGciOi...anon-key...",
  "automationApiUrl": "https://myfeed-automation.up.railway.app",
  "encryptionKey": "the same 16+ char string you set in Railway"
}
```

## 1. Install dependencies

```bash
npm install
```

## 2. Smoke test the mobile app

```bash
npx expo start
# press i for iOS simulator, a for Android emulator
```

Confirm:
- Login / signup works
- Onboarding flow runs end to end
- Dashboard shows "Automation paused" until you flip the switch
- Settings shows the @instagram username you connected

## 3. Android APK

### Option A — `eas build` (cloud, recommended)
```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

The first build will ask for an Android keystore. EAS will generate
and store one for you. The build takes ~10 min. The output is a URL
to download the `.apk` — submit that to the Telegram group.

### Option B — local Gradle
```bash
npx expo run:android --variant release
# APK lands in android/app/build/outputs/apk/release/app-release.apk
```

## 4. iOS TestFlight

> **TestFlight is the path judges can actually test.** Skip only if
> you have no Apple Developer account.

```bash
npx eas-cli build --platform ios
```

After the build finishes:
1. Open App Store Connect → MyApp → TestFlight.
2. EAS uploaded the build — it will say "Missing Compliance".
   Click and answer the export-compliance prompts.
3. Add the judges' email addresses (and yours) as testers.
4. Share the TestFlight public link in the submission.

## 5. Demo video (3–5 min)

Suggested shot list:

| Time   | Scene                                                  |
| ------ | ------------------------------------------------------ |
| 0:00   | Logo + tagline                                         |
| 0:15   | Sign up / sign in                                      |
| 0:45   | Onboarding splash + value props                        |
| 1:15   | Pick boost + reduce topics                             |
| 1:45   | Connect Instagram (real test account is best)          |
| 2:15   | Dashboard: status pill, stats, activity log            |
| 2:45   | Tap "Run now" → see fresh entries appear              |
| 3:15   | Settings: pause / resume / disconnect                  |
| 3:45   | Quick cut to Railway logs showing automation running   |
| 4:15   | Closing tagline                                        |

Record on the device you'll hand to judges. Use a tripod.

## 6. Submission checklist

- [ ] Telegram group post includes:
  - [ ] Demo video link (YouTube unlisted / Loom)
  - [ ] Android APK download OR APK install link (EAS)
  - [ ] iOS TestFlight link (if applicable)
  - [ ] Source code link is **NOT** required — omit it
