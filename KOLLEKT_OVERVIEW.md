# Kollekt — System Overview

> Living context/plan document. Update as the system evolves.

**What it is:** A student project (DAT251) — a mobile-first web app for shared households / collectives ("kollektiv"). Roommates manage chores, money, shopping, a shared calendar, group chat, and gamification (XP, levels, leaderboards, achievements), plus a party drinking-game mode. Originally based on a Figma export.

**Stack:** React + TypeScript (Vite) frontend · Spring Boot (Kotlin) backend · PostgreSQL (Supabase) · Redis (cache) · Kafka (messaging) · WebSockets (realtime) · Docker / Docker Compose / GitHub Actions CI-CD.

---

## High-level architecture

```
React SPA (Vite, :5173)
   │  REST  /api/*   (JWT Bearer access + refresh tokens)
   │  WS    /ws/collective?memberName=...   (live updates)
   ▼
Spring Boot backend (Kotlin, :8080)
   ├── api/         REST controllers
   ├── service/     business logic ("Operations" classes)
   ├── repository/  Spring Data JPA
   ├── domain/      JPA entities
   └── config/      security, websocket, kafka, redis
   ▼
PostgreSQL (Supabase) · Redis (stats cache, token store) · Kafka (integration events)
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
| `GamesPage` | `/games` | Game hub |
| `CollektGamePage` | `/games/kollekt` | The Kollekt drinking game |
| `ProfilePage` | `/profile` | Profile, settings, notification prefs, logout |

### Drinking-game engine (`/src/lib/drinkingGameEngine`)
A self-contained, client-side game engine (import only via `index.ts`):
- `types.ts` – Player, Round, GameSession, config types
- `gameConfig.ts` – presets (default/quick/hardcore/casual)
- `weightedRng.ts` – weighted random selection of round types & players
- `playerManager.ts` – build players (from leaderboard or guests), activation, min-players
- `roundEngine.ts` – generate/resolve/skip rounds
- `eventGenerator.ts` + `eventTemplates.ts` – the prompts/dares text
- `statProcessor.ts` – performance scoring & end-of-game summaries

Question content for some modes comes from backend JSON: `backend/src/main/resources/drinking-games/` (`JEG_HAR_ALDRI`, `CHUG_OR_TRUTH`, `100_SPØRSMÅL`), served via `GET /api/drinking-game/question`.

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
| `StatsController` | `/api` | dashboard, leaderboard, achievements, drinking-game question |
| `MemberController` | `/api/members` | collective members, status |
| `InvitationController` | `/api/invitations` | email invites |
| `NotificationController` | `/api/notifications` | list/read/delete, preferences |
| `InvitationRealtimeController`, `AuthVerification`, `ApiExceptionHandler` | — | realtime invites, auth helper, global error → JSON `{error}` |

DTOs live in `api/dto/ApiModels.kt`.

### Services (`/service`) — the business logic ("*Operations*" + "*Service*")
- **Account/auth:** `AccountOperations`, `TokenService`, `TokenStoreService` (Redis-backed), `UserProfileService`, `CollectiveAccessService` (authorization scoping)
- **Domain ops:** `CollectiveOperations`, `MemberOperations`, `TaskOperations`, `TaskMaintenanceService` (deadline reminders, expiring overdue tasks), `ShoppingOperations`, `EventOperations`, `EconomyOperations`, `ChatOperations`
- **Gamification/stats:** `StatsService` (XP, levels, streaks, leaderboard periods, achievement definitions), `StatsCacheService` (Redis cache invalidation)
- **Notifications/realtime:** `NotificationService`, `RealtimeUpdateService`, `InvitationRealtimeService`
- **Integration/messaging:** `IntegrationEventPublisher` / `IntegrationEventConsumer` (Kafka), `GoogleCalendarService`

### Repositories (`/repository`)
Spring Data JPA interfaces, one per aggregate (Member, Collective, Task, TaskFeedback, ShoppingItem, Event, Expense, PantEntry, PersonalSettlement, SettlementCheckpoint, ChatMessage, Notification, Achievement, Invitation, Room).

### Domain entities (`/domain`)
Member, Collective, Room, TaskItem, TaskFeedback, ShoppingItem, CalendarEvent, Expense, PersonalSettlement, SettlementCheckpoint, PantEntry, ChatMessage, Notification, Achievement, Invitation.

### Config (`/config`)
- `SecurityConfig` + `RevokedTokenValidator` — JWT auth, token revocation
- `WebSocketConfig` + `CollectiveWebSocketHandler` — `/ws/collective` live channel per collective
- `KafkaConfig`, `RedisConfig`, `WebConfig` (CORS etc.)

### Database (`/resources/db/migration`)
Flyway migrations, **V1 baseline → V31**. Baseline (`V1`) defines the core tables. Later migrations layer on features: task recurrence (V10), penalty XP (V11), notifications (V12–13), chat reactions/polls/images/replies (V14, V15, V18, V31), Google Calendar (V19), monthly prize (V20), task feedback (V21), shopping completion timestamps (V22), notification prefs (V23), event end-time (V24), pant goal (V25), expense deadlines (V26), personal settlements (V27), task category normalization (V28–29), achievement config (V30). Migrations V4–V9 added "smart assignment" scaffolding (assignment history, member chemistry, preferences, scores, assignment reason).

---

## Notable design notes / current state

- **Identity by name:** `memberName` is the de-facto key across the API; member names are globally unique.
- **Smart task assignment is scaffolding, not yet active.** DB columns and the `assignmentReason` field exist (V4–V9), but there's **no live assignment algorithm** consuming chemistry/preferences/fairness scores yet — tasks are created with an explicit assignee. `ideas.md` flags this ("empty feature") and lists intended fairness/preference/ML directions. **Prime area for future work.**
- **Realtime is push-notify-then-refetch:** WS events tell the client *what changed*; the client refetches via REST.
- **Two settlement models:** collective-wide `SettlementCheckpoint` and per-pair `PersonalSettlement`.
- **Caching:** Redis caches leaderboard/stats and stores refresh/revoked tokens.

## Infra & ops
- `docker-compose.yml` — redis, zookeeper, kafka, backend, frontend (DB is external Supabase via `.env`).
- `Dockerfile` + `nginx/` — frontend container served by nginx.
- `.github/workflows/ci-cd.yml` — builds frontend + backend on push/PR to `main`, publishes `kollekt-frontend`/`kollekt-backend` images to Docker Hub.
- Tests: backend has broad coverage under `backend/src/test` — `service/*Test`, `api/*ContractTest`, and `acceptance/*` (user-story acceptance tests, mapped in `user-story-test-mapping.md`).

---

## Ideas / backlog (see `ideas.md`)
Smart/fair task assignment, task swapping & voting, adaptive recurrence, away/vacation planning, richer analytics, role management, collective goals & rewards, IoT verification, calendar integrations, audit trail.
