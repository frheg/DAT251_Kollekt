Ready for review
Select text to add comments on the plan
Plan: Extract games to a standalone service + remove Kafka/Redis
Context
The KOLLEKT_OVERVIEW.md describes a target architecture that the code has not yet reached. Today:

All drinking-game logic is client-side: src/lib/drinkingGameEngine/* (~2,400 lines, powers the dynamic "Kollekt" game) and src/lib/drinkingGames.ts + 3 JSON files (powers the prompt/deck games). drinkingGames.ts even imports the JSON via a relative path into backend/.../drinking-games/.
The backend still ships Kafka (KafkaConfig, IntegrationEventPublisher/Consumer), Redis (RedisConfig, StatsCacheService, Redis-backed TokenStoreService, direct redisTemplate caching in StatsService), and a GET /api/drinking-game/question endpoint (hardcoded NO questions, unrelated to the JSON files).
Goals (confirmed with user):

Extract all game logic into a new kollekt-games/ folder = a standalone Node + TypeScript REST service (will become its own GitHub repo), called by the frontend with an API key. Move everything algorithmic (RNG, round/event generation, scoring, content).
Remove Kafka and Redis entirely. Move refresh/revoked tokens to PostgreSQL.
Break nothing; delete/fix tests that no longer apply.
Ensure the game works in the new repo when later connected via API key.
Part A — New kollekt-games/ standalone service (Node + TypeScript)
New folder at repo root, self-contained so it can be pushed to its own GitHub repo:

kollekt-games/package.json, tsconfig.json, Dockerfile, .gitignore, .env.example, README.md
kollekt-games/src/engine/* ← move verbatim the 9 files from src/lib/drinkingGameEngine/
kollekt-games/src/content/*.json ← move the 3 files from backend/src/main/resources/drinking-games/
kollekt-games/src/content/index.ts ← the localization logic from src/lib/drinkingGames.ts (getDrinkingGames, getDrinkingGame, localizeDrinkingGame, types)
kollekt-games/src/server.ts ← Express app: CORS (allowed origins from env), JSON body, API-key middleware (x-api-key checked against GAMES_API_KEY), routes, GET /health (no auth)
REST contract (all under /api, all require x-api-key):

GET /api/games?lang= → DrinkingGameDefinition[] (localized) — for GamesPage
GET /api/games/:id?lang= → one definition
GET /api/kollekt/meta → { presets, minPlayers, defaultGuestStats } (from GAME_PRESETS, MIN_PLAYERS, DEFAULT_GUEST_STATS)
POST /api/kollekt/round body { roundNumber, players, preset, usedIds, lang } → { round, usedIds } (calls generateRound; usedIds round-trips as an array ↔ Set)
POST /api/kollekt/resolve body { players, round, ...outcome } → { players } (calls resolveRound)
POST /api/kollekt/skip body { players, round } → { players } (calls skipRound)
POST /api/kollekt/summary body { players } → { summaries } (calls buildSessionSummaries; tier label computed client-side via performanceTier mirror or returned here)
The engine functions are pure, so the service stays stateless — the client keeps the players/usedIds/round-number state (as it already does) and calls the service for computation.

Part B — Frontend changes
Delete: src/lib/drinkingGameEngine/ (all 9 files), src/lib/drinkingGames.ts.

New src/lib/gamesApi.ts (mirrors the src/lib/api.ts pattern):

Reads VITE_GAMES_API_URL + VITE_GAMES_API_KEY; fetch wrapper attaching x-api-key.
Async API calls: getDrinkingGames(lang), getDrinkingGame(id, lang), getKollektMeta(), generateRound(...), resolveRound(...), skipRound(...), buildSessionSummaries(players).
Re-exports the TS types the pages need (Player, Round, RoundType, GameConfig, GameLang, GamePreset, SessionPlayerSummary, DrinkingGameDefinition, DrinkingGameId, DrinkingPromptKind, etc.) as a contract mirror (same approach as src/lib/types.ts). Types are not "logic".
Boundary decision: trivial React-state plumbing on the players array — addPlayer, removePlayer, togglePlayerActive, getActivePlayers, createGuestPlayer, fromLeaderboardPlayer, canStartGame — stays client-side as ~1-line helpers in gamesApi.ts (using minPlayers/defaultGuestStats from getKollektMeta). Round-tripping per-keystroke array edits over HTTP would be absurd; all algorithmic game logic (RNG, round/event generation, scoring) lives in the service.
Edit src/pages/GamesPage.tsx: swap the drinkingGames import for gamesApi; getDrinkingGames becomes async — fetch into state on mount / language change (replacing the useMemo at lines ~68), with a loading/empty fallback.

Edit src/pages/CollektGamePage.tsx: swap engine imports for gamesApi; make the round handlers (startGame, advance-round, resolve, skip) async and await the API. Fetch getKollektMeta() into state to replace GAME_PRESETS/canStartGame/MIN_PLAYERS usage (lines ~208, ~283-284, ~411-412, ~462-464). Keep the players/usedIdsRef/summaries state.

Edit .env.example: add VITE_GAMES_API_URL=http://localhost:4000/api and VITE_GAMES_API_KEY=dev-key.

Part C — Backend: remove Kafka
Delete: config/KafkaConfig.kt, service/IntegrationEventPublisher.kt, service/IntegrationEventConsumer.kt (the consumer only logged; realtime runs over WebSockets, so drop entirely rather than convert to Spring events — nothing consumes them meaningfully).

Edit call sites — remove the eventPublisher ctor param and every eventPublisher.*Event(...) call in: TaskOperations.kt, ChatOperations.kt, EconomyOperations.kt, ShoppingOperations.kt, EventOperations.kt.

Edit application.yml: remove the spring.kafka and app.topics blocks. build.gradle.kts: remove spring-kafka + spring-kafka-test (keep the junit-parallel block; simplify its kafka comment).

Part D — Backend: remove Redis
Delete: config/RedisConfig.kt, service/StatsCacheService.kt.

Edit StatsService.kt: remove redisTemplate + statsCacheService ctor params (and the redis import); delete the 3 cached-read / 3 cache-write blocks (leaderboard ~112/160, achievements ~187/220, dashboard ~293/346) so values compute on demand; remove the 3 statsCacheService.clear*() calls.

Edit remaining statsCacheService users — remove ctor param + clear*() calls in: EventOperations.kt, CollectiveOperations.kt, AccountOperations.kt, EconomyOperations.kt, MemberOperations.kt, TaskOperations.kt.

Edit application.yml: remove spring.data.redis. build.gradle.kts: remove spring-boot-starter-data-redis.

TokenStore → PostgreSQL (keep public API identical)
TokenStoreService keeps the same method signatures, so TokenService, RevokedTokenValidator, SecurityConfig are unchanged.

New domain/TokenEntry.kt — entity for table auth_tokens(jti PK, subject, type, expires_at) where type ∈ {REFRESH, REVOKED_ACCESS}.
New repository/TokenEntryRepository.kt — JPA repo + queries.
New resources/db/migration/V32__add_token_store.sql — create auth_tokens.
Reimplement TokenStoreService on the repo:
storeRefreshToken → upsert REFRESH row with expires_at.
isRefreshTokenActive → exists jti + subject + REFRESH + expires_at > now.
revokeRefreshToken → delete REFRESH jti.
revokeAccessToken → insert REVOKED_ACCESS row with expires_at.
isAccessTokenRevoked → exists jti + REVOKED_ACCESS + expires_at > now.
Expiry is enforced at query time (Redis previously used TTL). No @Scheduled purge — the app has no @EnableScheduling, so adding one would change behavior; opportunistically delete the stale row for a jti on write to bound growth.
Part E — Backend: remove the drinking-game endpoint
StatsController.kt: remove getQuestion mapping + DrinkingQuestionDto import.
StatsService.kt: remove getDrinkingQuestion + buildDrinkingQuestions (+ kotlin.random.Random import if now unused).
api/dto/ApiModels.kt: remove DrinkingQuestionDto (line ~386).
Delete backend/src/main/resources/drinking-games/*.json (moved to the games service in Part A).
Part F — Infra & docs
docker-compose.yml: remove redis, zookeeper, kafka services and the backend's depends_on + SPRING_DATA_REDIS_* / SPRING_KAFKA_* env. (Games service runs from its own repo — not added here.)
README.md: drop the Kafka/Redis lines (11, 34-35) and the /api/drinking-game/question line (78); add a short "Games service" note + the two VITE_GAMES_* vars.
KOLLEKT_OVERVIEW.md: resolve the "decision pending" notes to match what was built (Node games service, frontend calls it directly with an API key, V32 token migration, Kafka events dropped not converted).
Part G — Tests (delete / fix)
Delete: config/RedisConfigTest.kt, service/IntegrationEventPublisherTest.kt.

Rewrite: service/TokenStoreServiceTest.kt → JPA/H2-backed instead of Redis (service still exists with the same API).

Fix (remove mocks/refs to deleted ctor params, redis/kafka, and the drinking endpoint):

service/StatsServiceTest.kt (redis + statsCache mocks; getDrinkingQuestion test)
service/TaskOperationsTest.kt, EconomyOperationsTest.kt, EventOperationsTest.kt, CollectiveOperationsTest.kt, MemberOperationsTest.kt, AccountOperationsTest.kt, ChatOperationsTest.kt, ShoppingOperationsTest.kt (eventPublisher / statsCache mocks)
api/ControllerEndpointContractTest.kt (drinking-game endpoint assertion)
acceptance/AcceptanceTestSupport.kt (redis/kafka test setup)
resources/application-test.yml (remove redis/kafka/topics blocks)
resources/user-story-test-mapping.md (doc touch-up if it references the endpoint)
Verification
Games service: cd kollekt-games && npm install && npm run build && npm run dev; curl -H "x-api-key: dev-key" localhost:4000/api/games; curl .../api/kollekt/meta; POST a /api/kollekt/round with a sample players payload; confirm 401 without the key.

Backend: cd backend && ./gradlew build (compiles + runs full test suite). Confirm app boots with no Redis/Kafka on the classpath and Flyway applies V32. Manually exercise login → refresh → logout to confirm token store works against Postgres.

Frontend: npm install && npm run build (tsc passes with engine deleted). npm run dev, set VITE_GAMES_*, open /games and /games/kollekt: game list loads, a Kollekt session generates rounds, resolve/skip work, end summary renders.

Full stack: docker compose up builds with no redis/kafka/zookeeper containers.































