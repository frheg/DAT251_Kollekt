# Publish checklist — finish in VS Code

Everything in the numbered steps is doable inside VS Code / the integrated terminal.
It stops at the point where you must switch to Xcode, Android Studio, or the
Apple/Google/Firebase consoles (the **Handoff** section at the bottom).

Status going in: app code is committed on `main`, web + backend builds are green,
native `ios/` and `android/` projects are scaffolded (appId `no.kollekt.app`, v1.0/build 1),
icons + splash generated. The remaining VS Code work is cleanup, config, signing setup,
and a clean mobile sync.

> ⚠️ **Release decision — Games API key.** `VITE_GAMES_API_KEY` is compiled into the
> bundle, so it is **public** — anyone can extract it from the shipped app. This is *not*
> fixable in this repo by hiding the key. Before a real public release, the Kollekt Games
> service must adopt public-client-safe auth (or a backend proxy). The fix lives in the
> **games repo**, not here. For a course demo you may consciously accept this; just decide
> it on purpose rather than shipping it by accident.

---

## 0. Push the committed work to GitHub

This still hasn't landed (`origin/main` is behind by 2 commits). Run in your own
terminal where your GitHub login works:

```bash
git checkout main
git push origin main          # if it complains about .claude/settings.json: `git restore .claude/settings.json` first
git status                    # expect: up to date with 'origin/main'
```

---

## 1. Repo cleanup

- ✅ **Example env files filled.** `.env.example` and `.env.mobile.example` now contain
  the documented variable names + safe placeholders (no secrets). They just need
  committing (step 9).
- **Stop the `.claude/settings.json` churn (optional).** It keeps getting dirtied by
  local tool-permission edits. Move local entries into `.claude/settings.local.json`
  (already gitignored) so it stops creating noise in `git status`.

---

## 2. Point the mobile build at the deployed services

**Prerequisite:** backend and Kollekt Games must be reachable over public **HTTPS**
(a phone can't reach `localhost`). If they aren't deployed yet, that hosting step is a
platform dependency before this works.

Edit `.env.mobile` — replace the placeholders with the real hosts:

```bash
VITE_API_URL=https://<your-backend-host>/api
VITE_GAMES_API_URL=https://<your-games-host>/api
VITE_GAMES_API_KEY=<real-games-key>
```

Both URLs must start with `https://` or the mobile build will refuse to run.

---

## 3. Backend config the released app needs

The deployed backend (not just local `.env`) must have these set, or login/calendar
will break on the released app. You can prepare the values in VS Code; **applying them
to the deployment + registering the Google redirect URI happens in your hosting
dashboard / Google Cloud Console — see Handoff.**

- **CORS** — `APP_CORS_ALLOWED_ORIGINS` must include the web origin and the Capacitor
  origins:
  ```
  https://<your-web-origin>,capacitor://localhost,https://localhost,http://localhost
  ```
- **Google OAuth (Calendar)** — production values, not localhost:
  ```
  GOOGLE_REDIRECT_URI=https://<your-backend-host>/api/google-calendar/callback
  GOOGLE_FRONTEND_URL=https://<your-web-origin>
  GOOGLE_MOBILE_RETURN_URL=no.kollekt.app://google-calendar-connected
  ```
  The backend only redirects back to allowlisted URLs, so these must match exactly.

> The updated backend must be **redeployed** so the new `V33` push-token migration runs
> and the OAuth/CORS config takes effect. Deploy = handoff (hosting), but flagged here so
> Google Calendar connect doesn't silently fail on release.

---

## 4. Build in mobile mode and sync into the native projects

```bash
npm run mobile:sync          # = vite build --mode mobile  +  cap sync
```

Verify the synced assets now point at your real host (must NOT contain localhost):

```bash
grep -rho "https\?://[^\"']*\/api" android/app/src/main/assets/public/assets/*.js | sort -u
```

> Today the synced assets still contain `localhost:8080/api` — they were synced from the
> web build. This step replaces them. Don't skip it.

---

## 5. Android: add release signing (required for a publishable AAB)

### 5a. Generate a keystore (keep it forever — it identifies your app to Play)

```bash
keytool -genkey -v -keystore android/kollekt-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias kollekt
```

`*.jks` is already gitignored — never commit it.

### 5b. Create `android/key.properties` (also already gitignored)

```properties
storeFile=kollekt-release.jks
storePassword=<the password you just set>
keyAlias=kollekt
keyPassword=<the key password you just set>
```

### 5c. Wire it into `android/app/build.gradle`

Add the loader near the top (after `apply plugin: 'com.android.application'`):

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside the `android { }` block add a `signingConfigs` block and reference it from the
release build type:

```gradle
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release   // <-- add this line
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
```

### 5d. Build the signed release artifact (in VS Code terminal)

```bash
cd android && ./gradlew bundleRelease     # -> app/build/outputs/bundle/release/app-release.aab
```

(That `.aab` is the file you upload to Play Console.)

---

## 6. Responsive QA pass (do this in Chrome device mode)

Open the app at `npm run dev`, DevTools → device toolbar, and check the **narrow** widths
the presets don't default to:

- **375px** (iPhone SE / mini) and **320px** (smallest phones).
- Watch the 7-item bottom nav (Home/Tasks/Calendar/Chat/Economy/Board/Games) — that's the
  most likely spot to crowd. If labels/icons collide, it's a small CSS tweak in
  `BottomNav.tsx`, not a per-device layout.
- Also check landscape and with large text.

(Safe-area notch/home-indicator padding won't show in the browser — that's expected and
already handled via `env(safe-area-inset-*)`; it only appears on a real device.)

---

## 7. (Optional) Push notifications — only if you want them live now

These can be partially prepped in VS Code but the credentials come from the consoles
(so they straddle the handoff):
- **Android:** drop `google-services.json` (from the Firebase console) into `android/app/`.
  The build already picks it up automatically when present.
- **iOS:** APNs is configured in Xcode + Apple Developer portal (handoff section).

If you skip this, the apps still build and run fine — push just stays inactive.

---

## 8. Version numbers

For the first release the defaults are fine (Android `versionCode 1` / `versionName "1.0"`,
iOS `MARKETING_VERSION 1.0` / `CURRENT_PROJECT_VERSION 1`). For every later upload you
must bump `versionCode` (Android) and `CURRENT_PROJECT_VERSION` (iOS) — edit in VS Code.

---

## 9. Final verification gate + commit (all in VS Code)

```bash
npm run typecheck                         # frontend types
npm run build:mobile                      # mobile bundle builds with real .env.mobile
cd backend && ./gradlew build && cd ..    # backend green (tests + coverage)
git status                                # no secrets staged (.env*, *.jks, key.properties stay ignored)
```

Then commit the safe changes (filled example files, signing config, version bumps):

```bash
git add .env.example .env.mobile.example android/app/build.gradle
git commit -m "Release prep: fill env examples, Android release signing"
git push origin main
```

> Do NOT commit: `android/kollekt-release.jks`, `android/key.properties`, `.env`,
> `.env.mobile`, `google-services.json`. They are gitignored — keep it that way.

---

## ▶ Handoff — starts on the platforms (NOT this checklist)

Once the above is done, the rest happens outside VS Code:

- **Hosting / deploy:** redeploy the backend (applies `V33` migration + OAuth/CORS env)
  and set the step-3 env vars in your hosting dashboard.
- **Google Cloud Console:** add the production `GOOGLE_REDIRECT_URI` to the OAuth client's
  authorized redirect URIs.
- **iOS (Xcode + Apple Developer, $99/yr):** open `npm run mobile:open:ios`, set the
  signing **Team**, add the Push Notifications capability (if using push), then
  **Product ▸ Archive ▸ Distribute** → upload to **App Store Connect / TestFlight**.
- **Android (Play Console, one-time $25):** create the app, upload `app-release.aab`,
  complete the store listing, data-safety form, and content rating.
- **Firebase console:** create the project, download `google-services.json` (Android)
  and register the APNs key (iOS) — only if shipping push.
- **Store metadata (both):** screenshots, descriptions, privacy policy URL.

---

### Quick reality check before you start
1. Is the backend (and games service) deployed on public HTTPS? ← unblocks steps 2–4.
2. Have you **decided** about the public games key (release gate at top)?
3. Do you have / want an Apple Developer + Play Console account? ← needed only at handoff.
4. Push notifications in v1, or defer? ← if defer, skip step 7 entirely.
