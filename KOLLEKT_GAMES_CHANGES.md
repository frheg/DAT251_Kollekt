# Kollekt Games — changes needed for release with the mobile app

This is a hand-off doc for the **separate Kollekt Games repository**. It lists what that
service must do so it works with the main Kollekt app once Kollekt ships as native
iOS/Android (Capacitor) apps. It is derived from the real client contract in the main
repo: [`src/lib/gamesApi.ts`](src/lib/gamesApi.ts).

> **Where the UI lives:** the games **screens** (`GamesPage`, `CollektGamePage`) live in
> the *main* app. The Games service is a **content + logic API only** — it returns data,
> the main app renders it. So "design" work here means the **shape, length, and language**
> of the data, not visual styling.

---

## 1. The contract the app calls (must match exactly)

Base URL is whatever `VITE_GAMES_API_URL` points at (e.g. `https://<host>/api`); the client
appends these sub-paths. All requests send headers `x-api-key: <key>` and
`Content-Type: application/json`.

| Method | Path | Request body | Response |
|---|---|---|---|
| GET | `/games?lang=en\|no` | — | `DrinkingGameDefinition[]` |
| GET | `/games/:gameId?lang=en\|no` | — | `DrinkingGameDefinition` |
| GET | `/kollekt/meta` | — | `KollektMeta` |
| POST | `/kollekt/round` | `{ roundNumber, players, preset, usedIds, lang }` | `{ round: Round \| null, usedIds: string[] }` |
| POST | `/kollekt/summary` | `{ players }` | `{ summaries: SessionPlayerSummary[] }` |

**Enums must match the client literally** (these are checked/typed in the app):
- `gameId`: `'hundred-questions' | 'truth-or-chug' | 'never-have-i-ever'`
- `preset`: `'default' | 'quick' | 'hardcore' | 'casual'`
- `RoundType`: `'STAT_COMPARISON' | 'CHALLENGE' | 'HOT_SEAT' | 'TRIVIA_TWIST' | 'RANDOM_EVENT'`
- `lang`: `'en' | 'no'`

Response field names must match the TS interfaces in `gamesApi.ts` (`DrinkingGameDefinition`,
`KollektMeta`, `Round`, `GameEvent`, `GameConfig`, `SessionPlayerSummary`, `PlayerStats`).
Renaming a field silently breaks the app — keep this table and those types as the source of truth.

Behavioural notes the app relies on:
- `/kollekt/round` **round-trips `usedIds`** — echo back the updated list so the app can
  avoid repeating event templates across a session.
- `round` may be **`null`** when no more templates are available — the app treats that as
  "end of game", so return `{ round: null, usedIds }` rather than an error.
- Non-2xx is treated as a hard failure (the app throws `Games API error <status>`), so use
  proper status codes and never return 200 with an error body.

---

## 2. Mobile compatibility (the critical, must-do changes)

### 2a. CORS — allow the Capacitor app origins
On a phone the WebView's origin is **not** your website. The service must allow:

```
Access-Control-Allow-Origin:  https://<your-web-origin>, capacitor://localhost, https://localhost, http://localhost
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-api-key
```

- **iOS** WebView origin is `capacitor://localhost`.
- **Android** WebView origin is `https://localhost`.
- The custom **`x-api-key`** header makes every request "non-simple", so the browser sends a
  **preflight `OPTIONS`** first — the service must answer `OPTIONS` with the headers above
  (status 204/200). If preflight fails, every games call fails on device.
- Do **not** rely on cookies/sessions — it's cross-origin; auth must be the header/token only.

### 2b. HTTPS only
The native build **rejects non-HTTPS** games URLs (`VITE_GAMES_API_URL` must be `https://`),
and Android blocks mixed/cleartext content. Deploy the service behind valid TLS.

### 2c. Latency & resilience
`/kollekt/round` is called **once per round, on demand**, over mobile networks. Keep it fast
(<~500ms) and stateless; the app handles its own session state and just needs each round back.

---

## 3. Security — the release gate (must decide before public launch)

`VITE_GAMES_API_KEY` is **compiled into the app bundle**, so it is **public** — anyone can
extract it. Shipping a static shared key as-is means anyone can call your API.

Pick one before release:
1. **Public-client hardening (minimum):** treat the key as a public identifier, add
   **per-key/per-IP rate limiting**, abuse monitoring, and easy key rotation. Acceptable for
   a course/demo if you accept the risk.
2. **Short-lived tokens:** the main Kotlin backend (which *is* authenticated) hands out a
   short-lived, scoped token the app sends to Games instead of a static key.
3. **Backend proxy:** the app calls the Kollekt backend, which signs/forwards to Games. The
   key never ships in the app. Most secure; most work.

Document which option you chose so the main app's `gamesApi.ts` auth header can be updated to match.

---

## 4. Internationalisation (functionality parity)

The app sends `lang=en|no` and lets users toggle language mid-session.
- `/games`, `/games/:id`, and `/kollekt/round` must honour `lang` and return localized text.
- `GameEvent` may carry `textByLanguage: { en, no }`; if you use it, populate **both**
  languages — the app switches without re-fetching in some flows.
- Norwegian (`no`) content must exist for every game/prompt, not just English.

---

## 5. "Design" = content shaped for small screens

Since the main app renders the data, make the content mobile-friendly:
- Keep `title`/`shortTitle` short (the UI shows `shortTitle` in tight spots); long titles wrap
  badly on a 320–375px phone.
- Keep `description` and prompt `text` concise — a few lines, not paragraphs.
- Provide complete `rules: string[]` and `prompts[]` so cards aren't empty.
- `KollektMeta.presets` must include all four presets with `label` + `description` + a valid
  `GameConfig` (the app builds the preset picker straight from this).
- `minPlayers` and `defaultGuestStats` in `/kollekt/meta` should match the app's expectations
  (`MIN_PLAYERS = 2`, and the `DEFAULT_GUEST_STATS` shape in `gamesApi.ts`).

---

## 6. Deployment & ops

- Deploy on a **stable public HTTPS URL** (this becomes `VITE_GAMES_API_URL` / `.env.mobile`).
- Add a **health endpoint** (e.g. `GET /health`) for uptime checks.
- Consider an API **version prefix** (e.g. `/api/v1`) so the contract can evolve without
  breaking shipped app versions (a published mobile build can't be hot-fixed instantly).
- Have its own CI/CD, image, and (optionally) its own `.env.example` documenting the key.

---

## 7. Pre-release verification checklist (run against the deployed Games service)

- [ ] HTTPS works; certificate valid.
- [ ] `OPTIONS` preflight to `/kollekt/round` returns the CORS headers (test with
      `Origin: capacitor://localhost` and `Origin: https://localhost`).
- [ ] `GET /games?lang=no` returns Norwegian content; `lang=en` returns English.
- [ ] `POST /kollekt/round` returns a valid `Round`, echoes `usedIds`, and eventually returns
      `round: null` when templates are exhausted.
- [ ] `POST /kollekt/summary` returns `summaries` with the `SessionPlayerSummary` shape.
- [ ] `GET /kollekt/meta` returns all four presets + `minPlayers` + `defaultGuestStats`.
- [ ] A request with a missing/invalid `x-api-key` is rejected (and rate limiting works).
- [ ] Response field names/enums still match `src/lib/gamesApi.ts` in the main repo.
- [ ] End-to-end: run the real **Kollekt iOS/Android build** against the deployed Games URL and
      play a full game (start → several rounds → summary) on a device.

---

### TL;DR — the 3 things that will actually break mobile if skipped
1. **CORS for `capacitor://localhost` + `https://localhost`** (incl. `OPTIONS` preflight and the `x-api-key` header).
2. **HTTPS** on a stable public URL.
3. **Don't ship a raw static API key** without rate limiting / a better auth story.
