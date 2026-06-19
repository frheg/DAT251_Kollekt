# Kollekt — System Overview

> Living context/plan document. Update as the system evolves.

**What it is:** A student project (DAT251) — a mobile-first web app for shared households / collectives ("kollektiv"). Roommates manage chores, money, shopping, a shared calendar, group chat, and gamification (XP, levels, leaderboards, achievements), plus a party drinking-game mode. The drinking-game/party features are now provided by a **separate games service** (its own GitHub repo) that Kollekt consumes over a REST API rather than running the game logic in-app. Originally based on a Figma export.

**Stack:** React + TypeScript (Vite) frontend · Spring Boot (Kotlin) backend · PostgreSQL (Supabase) · WebSockets (realtime) · Docker / Docker Compose / GitHub Actions CI-CD.

> **Removed in recent cleanup:** Redis (cache + token store) and Kafka (messaging). See [Recent architecture changes](#recent-architecture-changes) for what replaced them.

**Companion service:** **Kollekt Games** — a separate GitHub repository containing all the drinking-game logic and question content, exposed as a REST API. Kollekt depends on it; it does not depend on Kollekt.

---

## Recent architecture changes

These are the in-flight structural changes this doc was updated to reflect. Items marked _(decision pending)_ are reasonable defaults that can still change.

1. **Games extracted to a separate repo + API.** The client-side drinking-game engine (was `src/lib/drinkingGameEngine`) and its question content (was `backend/src/main/resources/drinking-games/` + `GET /api/drinking-game/question`) now live in a standalone **Kollekt Games** service (Node + TypeScript REST API; in this repo under `kollekt-games/` until it is split into its own GitHub repo). The Kollekt frontend keeps the `GamesPage` / `CollektGamePage` UI and calls that external API **directly** with an API key (`VITE_GAMES_API_URL` + `VITE_GAMES_API_KEY`) — no backend proxy.
2. **Redis removed.** The two consumers were token storage and the stats/leaderboard cache:
   - **Token store** (refresh + revoked tokens) → moved to **PostgreSQL** (`TokenEntry` entity + `TokenEntryRepository`, table `auth_tokens` via migration **V32**). Expiry is enforced at query time; expired rows are purged on write.
   - **Stats/leaderboard cache** → **computed on demand** (no cache; `StatsCacheService` and the direct `RedisTemplate` reads/writes in `StatsService` are gone).
3. **Kafka removed.** Integration events (`IntegrationEventPublisher` / `IntegrationEventConsumer`) were **dropped entirely** — the consumer only logged and nothing consumed the events meaningfully. Realtime updates are unaffected — they already run over WebSockets, not Kafka.

---

## High-level architecture

```
React SPA (Vite, :5173)
 │  REST /api/*  (JWT Bearer access + refresh tokens)
 │  WS  /ws/collective?memberName=...  (live updates)
 │  REST  → Kollekt Games API  (drinking-game rounds + questions)
 ▼
Spring Boot backend (Kotlin, :8080)
 ├── api/         REST controllers
 ├── service/     business logic ("Operations" classes)
 ├── repository/  Spring Data JPA
 ├── domain/      JPA entities
 └── config/      security, websocket, web (CORS)
 ▼
PostgreSQL (Supabase)   ← also holds refresh/revoked tokens now

   ┌──────────────────────────────────────────────────────┐
   │  Kollekt Games (separate GitHub repo)                  │
   │  REST API: round generation + question bank            │
   │  (JEG_HAR_ALDRI, CHUG_OR_TRUTH, 100_SPØRSMÅL, …)       │
   └──────────────────────────────────────────────────────┘
        ▲ consumed by Kollekt (frontend GamesPage)
```

A user logs in → belongs to a **Collective** (household, identified by a `join_code`). Almost every entity carries a `collective_code` and is scoped to that collective. The `memberName` is used pervasively as the identity key in queries (note: names are globally unique — `uq_members_name`).

---

## Frontend (`/src`)

**Entry & routing** — `src/main.tsx` → `src/App.tsx`. Routing via `react-router-dom`:
- `GuestOnlyRoute` → `/login`
- `AuthOnlyRoute` → `/create-household` (authed but no collective yet)
- `AppLayout` wraps all main pages (with header + bottom nav)
- Catch-all redirects to `/`

**Auth/session state** — `src/context/UserContext.tsx`: holds `currentUser`, loads `/onboarding/me` on boot, manages notifications, and opens the realtime WS connection. Persists user + tokens in `localStorage`.

**API client** — `src/lib/api.ts`: central `fetch` wrapper. Attaches `Bearer` token, auto-refreshes on 401 via `/onboarding/refresh`, sanitizes error messages through i18n. Exposes `api.get/post/patch/delete/postForm`.

**Games API client** — `src/lib/gamesApi.ts`: thin client for the external **Kollekt Games** REST API (round generation, scoring, question content). Attaches the `x-api-key` header; base URL + key from `VITE_GAMES_API_URL` / `VITE_GAMES_API_KEY`. Also holds the contract TS types and the trivial player-list helpers the UI needs locally (the algorithmic engine itself lives in the games service).

**Realtime** — `src/lib/realtime.ts`: `connectCollectiveRealtime(memberName, onEvent)` opens a reconnecting WebSocket to `/ws/collective`; events like `NOTIFICATION_CREATED`, `TASK_DEADLINE_SOON`, etc. trigger refetches.

**Shared types** — `src/lib/types.ts`: the contract mirror of backend DTOs (Task, Expense, CalendarEvent, ChatMessage, Leaderboard, Achievement, AppUser, etc.).

**Layout & nav** — `AppLayout.tsx`, `AppHeader.tsx`, `BottomNav.tsx` (7 tabs: Home, Tasks, Calendar, Chat, Economy, Leaderboard, Games), `LanguageSwitcher.tsx`.

**UI kit** — `src/components/ui/`: shadcn/Radix-based primitives (button, dialog, card, etc.) + custom flair (`Confetti`, `Sparkles`, `AnimatedButton`). Styling via Tailwind (`src/styles/globals.css`).

**i18n** — `src/i18n/`: English + Norwegian (`en.json`, `no.json`).

### Pages (`/src/pages`)
| Page | Route | Purpose |
|---|---|---|
| `LoginPage` | `/login` | Sign up / log in |
| `CreateHouseholdPage` | `/create-household` | Create or join a collective by code |
| `DashboardPage` | `/` | Home: user XP/level/rank, upcoming tasks & events, recent expenses, pending shopping |
| `TasksPage` | `/tasks` | Chores: create/assign/complete, recurrence, categories, XP/penalty, feedback |
| `CalendarPage` | `/calendar` | Shared events; Google Calendar sync |
| `ChatPage` | `/chat` | Group chat: reactions, polls, images, replies |
| `EconomyPage` | `/economy` | Expenses, balances, settle-up |
| `PantTrackerPage` | `/economy/pant` | Bottle-deposit ("pant") tracker toward a shared goal |
| `LeaderboardPage` | `/leaderboard` | Rankings, period stats, monthly prize, achievements |
| `GamesPage` | `/games` | Game hub — UI only; backed by the external Kollekt Games API |
| `CollektGamePage` | `/games/kollekt` | The Kollekt drinking game — UI only; backed by the external Kollekt Games API |
| `ProfilePage` | `/profile` | Profile, settings, notification prefs, logout |

### Drinking-game engine — moved out

The self-contained, client-side game engine that previously lived at `src/lib/drinkingGameEngine` has been **extracted into the separate Kollekt Games repository** and is now exposed as a REST API. The Kollekt frontend no longer ships this logic; the `GamesPage` / `CollektGamePage` components consume the API instead.

For reference, the extracted engine covers: player management (from leaderboard or guests), weighted RNG for round/player selection, round generation/resolution/skip, event/prompt templates, game config presets (default/quick/hardcore/casual), and end-of-game stat scoring. Question content for modes like `JEG_HAR_ALDRI`, `CHUG_OR_TRUTH`, and `100_SPØRSMÅL` now lives with and is served by that service rather than from the Kollekt backend.

---

## Backend (`/backend`, package `com.kollekt`)

Entry: `KollektApplication.kt`. Layered: **api → service → repository → domain**.

### API controllers (`/api`)
| Controller | Base path | Area |
|---|---|---|
| `OnboardingController` | `/api/onboarding` | signup, login, refresh, logout, `/me`, create/join collective, join code |
| `TaskController` | `/api/tasks` | tasks + shopping items, regret/late-complete, feedback |
| `CalendarController` | `/api/events` | events |
| `GoogleCalendarController` | `/api/google-calendar` | OAuth + sync |
| `ChatController` | `/api/chat` | messages, reactions, polls, images |
| `EconomyController` | `/api/economy` | expenses, balances, pant, summary, settle |
| `StatsController` | `/api` | dashboard, leaderboard, achievements |
| `MemberController` | `/api/members` | collective members, status |
| `InvitationController` | `/api/invitations` | email invites |
| `NotificationController` | `/api/notifications` | list/read/delete, preferences |
| `InvitationRealtimeController`, `AuthVerification`, `ApiExceptionHandler` | — | realtime invites, auth helper, global error → JSON `{error}` |

> The former `GET /api/drinking-game/question` endpoint (served by `StatsController`) has been removed from the Kollekt backend; that responsibility now belongs to the Kollekt Games service.

DTOs live in `api/dto/ApiModels.kt`.

### Services (`/service`) — the business logic ("*Operations*" + "*Service*")
- **Account/auth:** `AccountOperations`, `TokenService`, `TokenStoreService` (now **PostgreSQL-backed** — was Redis), `UserProfileService`, `CollectiveAccessService` (authorization scoping)
- **Domain ops:** `CollectiveOperations`, `MemberOperations`, `TaskOperations`, `TaskMaintenanceService` (deadline reminders, expiring overdue tasks), `ShoppingOperations`, `EventOperations`, `EconomyOperations`, `ChatOperations`
- **Gamification/stats:** `StatsService` (XP, levels, streaks, leaderboard periods, achievement definitions). The former `StatsCacheService` (Redis cache invalidation) is removed — stats/leaderboard/dashboard are computed on demand.
- **Notifications/realtime:** `NotificationService`, `RealtimeUpdateService`, `InvitationRealtimeService`
- **Integration/messaging:** integration events previously published/consumed via Kafka (`IntegrationEventPublisher` / `IntegrationEventConsumer`) now use in-process Spring application events (or are dropped where unused). `GoogleCalendarService` is unchanged.

### Repositories (`/repository`)
Spring Data JPA interfaces, one per aggregate (Member, Collective, Task, TaskFeedback, ShoppingItem, Event, Expense, PantEntry, PersonalSettlement, SettlementCheckpoint, ChatMessage, Notification, Achievement, Invitation, Room). _A token repository is added to back the now-DB-resident refresh/revoked tokens._

### Domain entities (`/domain`)
Member, Collective, Room, TaskItem, TaskFeedback, ShoppingItem, CalendarEvent, Expense, PersonalSettlement, SettlementCheckpoint, PantEntry, ChatMessage, Notification, Achievement, Invitation.

### Config (`/config`)
- `SecurityConfig` + `RevokedTokenValidator` — JWT auth, token revocation (revocation list now read from PostgreSQL)
- `WebSocketConfig` + `CollectiveWebSocketHandler` — `/ws/collective` live channel per collective
- `WebConfig` (CORS etc.)
- _Removed:_ `KafkaConfig`, `RedisConfig`.

### Database (`/resources/db/migration`)
Flyway migrations, **V1 baseline → V32**. Baseline (`V1`) defines the core tables. Later migrations layer on features: task recurrence (V10), penalty XP (V11), notifications (V12–13), chat reactions/polls/images/replies (V14, V15, V18, V31), Google Calendar (V19), monthly prize (V20), task feedback (V21), shopping completion timestamps (V22), notification prefs (V23), event end-time (V24), pant goal (V25), expense deadlines (V26), personal settlements (V27), task category normalization (V28–29), achievement config (V30), token store (V32 — `auth_tokens`, replaces Redis). Migrations V4–V9 added "smart assignment" scaffolding (assignment history, member chemistry, preferences, scores, assignment reason).

> **Migration V32 (Redis removal):** `V32__add_token_store.sql` creates the `auth_tokens` table that backs the now DB-resident refresh/revoked tokens (the data previously held in Redis).

---

## Notable design notes / current state

- **Identity by name:** `memberName` is the de-facto key across the API; member names are globally unique.
- **Games are an external service:** drinking-game logic and questions live in the separate Kollekt Games repo and are consumed over its REST API. Kollekt only ships the games *UI*.
- **No Redis, no Kafka:** tokens and (any) caching live in PostgreSQL / in-process; integration events run in-process via Spring events. WebSockets remain the realtime transport.
- **Smart task assignment is scaffolding, not yet active.** DB columns and the `assignmentReason` field exist (V4–V9), but there's **no live assignment algorithm** consuming chemistry/preferences/fairness scores yet — tasks are created with an explicit assignee. `ideas.md` flags this ("empty feature") and lists intended fairness/preference/ML directions. **Prime area for future work.**
- **Realtime is push-notify-then-refetch:** WS events tell the client *what changed*; the client refetches via REST.
- **Two settlement models:** collective-wide `SettlementCheckpoint` and per-pair `PersonalSettlement`.

## Infra & ops
- `docker-compose.yml` — backend, frontend (DB is external Supabase via `.env`). Redis, Zookeeper, and Kafka containers have been removed.
- The **Kollekt Games** service is deployed/run independently (its own repo, image, and compose/CI); Kollekt reaches it via a configured base URL.
- `Dockerfile` + `nginx/` — frontend container served by nginx.
- `.github/workflows/ci-cd.yml` — builds frontend + backend on push/PR to `main`, publishes `kollekt-frontend`/`kollekt-backend` images to Docker Hub.
- Tests: backend has broad coverage under `backend/src/test` — `service/*Test`, `api/*ContractTest`, and `acceptance/*` (user-story acceptance tests, mapped in `user-story-test-mapping.md`). The Redis/Kafka and drinking-endpoint tests have been removed; `TokenStoreServiceTest` now exercises the PostgreSQL-backed store.

---

## Ideas / backlog (see `ideas.md`)
Smart/fair task assignment, task swapping & voting, adaptive recurrence, away/vacation planning, richer analytics, role management, collective goals & rewards, IoT verification, calendar integrations, audit trail.
