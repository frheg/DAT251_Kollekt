# Publish checklist — finish in VS Code

Everything here is doable inside VS Code / the integrated terminal. It stops at the
point where you must switch to Xcode, Android Studio, or the Apple/Google/Firebase
consoles (listed at the bottom as the handoff).

Status going in: app code is committed on `main`, web + backend builds are green,
native `ios/` and `android/` projects are scaffolded (appId `no.kollekt.app`, v1.0/build 1),
icons + splash generated. The remaining VS Code work is config, signing setup, and a
clean mobile sync.

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

## 1. Point the mobile build at the deployed services

**Prerequisite:** backend and Kollekt Games must be reachable over public **HTTPS**
(a phone can't reach `localhost`). If they aren't deployed yet, that hosting step is
the one true platform dependency before this works.

Edit `.env.mobile` — replace the `*.example.com` placeholders with the real hosts:

```bash
VITE_API_URL=https://<your-backend-host>/api
VITE_GAMES_API_URL=https://<your-games-host>/api
VITE_GAMES_API_KEY=<real-games-key>
```

Both URLs must start with `https://` or the mobile build will refuse to run.

---

## 2. Confirm backend CORS allows the app origin

The native WebView calls from origin `capacitor://localhost` (iOS) / `https://localhost`
(Android). Make sure the **deployed** backend's `APP_CORS_ALLOWED_ORIGINS` includes:

```
https://<your-web-origin>,capacitor://localhost,https://localhost,http://localhost
```

(Local `.env` already has the capacitor origins; this is about the deployed env config.)

---

## 3. Build in mobile mode and sync into the native projects

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

## 4. Android: add release signing (required for a publishable AAB)

### 4a. Generate a keystore (keep it forever — it identifies your app to Play)

```bash
keytool -genkey -v -keystore android/kollekt-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias kollekt
```

`*.jks` is already gitignored — never commit it.

### 4b. Create `android/key.properties` (also already gitignored)

```properties
storeFile=kollekt-release.jks
storePassword=<the password you just set>
keyAlias=kollekt
keyPassword=<the key password you just set>
```

### 4c. Wire it into `android/app/build.gradle`

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

### 4d. Build the signed release artifact (in VS Code terminal)

```bash
cd android && ./gradlew bundleRelease     # -> app/build/outputs/bundle/release/app-release.aab
```

(That `.aab` is the file you upload to Play Console.)

---

## 5. (Optional) Push notifications — only if you want them live now

These can be partially prepped in VS Code but the credentials come from the consoles
(so they straddle the handoff):
- **Android:** drop `google-services.json` (from the Firebase console) into `android/app/`.
  The build already picks it up automatically when present.
- **iOS:** APNs is configured in Xcode + Apple Developer portal (handoff section).

If you skip this, the apps still build and run fine — push just stays inactive.

---

## 6. Version numbers

For the first release the defaults are fine (Android `versionCode 1` / `versionName "1.0"`,
iOS `MARKETING_VERSION 1.0` / `CURRENT_PROJECT_VERSION 1`). For every later upload you
must bump `versionCode` (Android) and `CURRENT_PROJECT_VERSION` (iOS) — edit in VS Code.

---

## 7. Final verification gate (all in VS Code)

```bash
npm run typecheck                         # frontend types
npm run build:mobile                      # mobile bundle builds with real .env.mobile
cd backend && ./gradlew build && cd ..    # backend green (tests + coverage)
git status                                # no secrets staged (.env*, *.jks, key.properties stay ignored)
```

Then commit the safe native config changes (signing config in `build.gradle`, version bumps):

```bash
git add android/app/build.gradle .env.mobile.example
git commit -m "Configure Android release signing"
git push origin main
```

> Do NOT commit: `android/kollekt-release.jks`, `android/key.properties`, `.env.mobile`,
> `google-services.json`. They are gitignored — keep it that way.

---

## ▶ Handoff — starts on the platforms (NOT this checklist)

Once the above is done, the rest happens outside VS Code:

- **iOS (Xcode + Apple Developer, $99/yr):** open `npm run mobile:open:ios`, set the
  signing **Team**, add the Push Notifications capability (if using push), then
  **Product ▸ Archive ▸ Distribute** → upload to **App Store Connect / TestFlight**.
- **Android (Play Console, one-time $25):** create the app, upload `app-release.aab`,
  complete the store listing, data-safety form, and content rating.
- **Firebase console:** create the project, download `google-services.json` (Android)
  and register the APNs key (iOS) — only if shipping push.
- **Store metadata (both):** screenshots, descriptions, privacy policy URL.

---

### Quick reality check before you start tomorrow
1. Is the backend (and games service) deployed on public HTTPS? ← unblocks steps 1–3.
2. Do you have/ want an Apple Developer + Play Console account? ← needed only at handoff.
3. Push notifications in v1, or defer? ← if defer, skip step 5 entirely.
