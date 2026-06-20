# Release — remaining work (NOT doable in VS Code)

All VS Code / integrated-terminal work is **done**: env example files committed, Android
release signing wired into `android/app/build.gradle` (guarded), and the full verification
gate is green (`typecheck`, `build:mobile`, backend `gradlew build`). Everything below
happens on the hosting platform, the app stores, or the Apple/Google/Firebase consoles.

## Decisions already made
- **Push notifications:** deferred for v1 (step 7 skipped — apps build/run fine without it).
- **Games API key:** the public `VITE_GAMES_API_KEY` is consciously accepted as a known
  limitation for the course demo. The real fix (public-client-safe auth or a backend proxy)
  lives in the **games repo**, not here.
- **Release branch:** confirm whether `mobile/capacitor-conversion` or `main` is the branch
  to release from before tagging/uploading.

---

## 1. Deploy backend + Kollekt Games on public HTTPS  ← unblocks everything else
A phone cannot reach `localhost`. Both services must be live on `https://` before the
mobile build can point at them.

After they're deployed, the remaining mobile-host wiring **is** done back in VS Code:
1. Edit `.env.mobile` with the real hosts (replace the `example.com` placeholders):
   ```
   VITE_API_URL=https://<backend-host>/api
   VITE_GAMES_API_URL=https://<games-host>/api
   VITE_GAMES_API_KEY=<real-games-key>
   ```
2. `npm run mobile:sync`
3. Verify no localhost remains in the synced assets:
   ```
   grep -rho "https\?://[^\"']*\/api" android/app/src/main/assets/public/assets/*.js | sort -u
   ```

## 2. Backend deployment config (hosting dashboard) + redeploy
Set on the **deployed** backend, then redeploy (so the `V33` push-token migration runs and
OAuth/CORS take effect):
- **CORS** — `APP_CORS_ALLOWED_ORIGINS`:
  ```
  https://<web-origin>,capacitor://localhost,https://localhost,http://localhost
  ```
- **Google OAuth (Calendar):**
  ```
  GOOGLE_REDIRECT_URI=https://<backend-host>/api/google-calendar/callback
  GOOGLE_FRONTEND_URL=https://<web-origin>
  GOOGLE_MOBILE_RETURN_URL=no.kollekt.app://google-calendar-connected
  ```
  These must match exactly — the backend only redirects to allowlisted URLs.

## 3. Google Cloud Console
Add the production `GOOGLE_REDIRECT_URI` (above) to the OAuth client's authorized redirect
URIs, or Calendar connect fails silently on the released app.

## 4. Android release keystore (you run `keytool`; build.gradle already wired)
```bash
keytool -genkey -v -keystore android/kollekt-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias kollekt
```
Then create `android/key.properties` (both files are gitignored — never commit them):
```properties
storeFile=kollekt-release.jks
storePassword=<store password>
keyAlias=kollekt
keyPassword=<key password>
```
Build the upload artifact:
```bash
cd android && ./gradlew bundleRelease   # -> app/build/outputs/bundle/release/app-release.aab
```

## 5. Android — Play Console (one-time $25)
Create the app, upload `app-release.aab`, complete the store listing, data-safety form,
and content rating.

## 6. iOS — Xcode + Apple Developer ($99/yr)
```bash
npm run mobile:open:ios
```
Set the signing **Team**, then **Product ▸ Archive ▸ Distribute** → upload to
App Store Connect / TestFlight. (No Push Notifications capability needed — push is deferred.)

## 7. Store metadata (both stores)
Screenshots, descriptions, privacy policy URL.

---

## Later uploads (every release after the first)
Bump the version numbers in VS Code before re-uploading:
- Android: `versionCode` (and `versionName`) in `android/app/build.gradle`
- iOS: `CURRENT_PROJECT_VERSION` (and `MARKETING_VERSION`)

## Never commit
`android/kollekt-release.jks`, `android/key.properties`, `.env`, `.env.mobile`,
`google-services.json` — all gitignored; keep it that way.
