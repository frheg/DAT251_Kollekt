# DAT251 Kollekt

Fullstack kollektiv-app basert på eksisterende Figma-export.



## Stack

- Frontend: React + TypeScript (Vite)
- Backend: Spring Boot (Kotlin)
- Database: PostgreSQL
- Games: separat Kollekt Games-tjeneste (Node + TypeScript REST API, eget repo)
- DevOps: Docker, Docker Compose, GitHub Actions, Docker Hub

## Prosjektstruktur

- `./` frontend
- `./backend` Kotlin Spring Boot backend
- `./docker-compose.yml` lokal fullstack-orchestrering
- `./.github/workflows/ci-cd.yml` CI/CD pipeline

## Lokalt oppsett

### 1) Start hele stacken med Docker Compose

```bash
docker compose up --build
```

Dette starter:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080/api`

Compose starter også en lokal PostgreSQL-instans for backend og Flyway, så containeroppsettet ikke er avhengig av Supabase for å starte.

Drikkespillene leveres av den separate **Kollekt Games**-tjenesten (eget repo). Frontend kaller den via `VITE_GAMES_API_URL` med `VITE_GAMES_API_KEY` (se `.env.example`).

### 2) Kjør frontend lokalt uten container

```bash
npm install
cp .env.example .env
npm run dev
```

### 3) Kjør backend lokalt uten container

```bash
cd backend
set -a
source ../.env
set +a
./gradlew bootRun
```

For lokal kjøring med `docker compose up --build`, brukes den lokale PostgreSQL-instansen. Hvis du kjører backend direkte med `./gradlew bootRun`, må du fortsatt ha en tilgjengelig database på `localhost:5432` eller tilpasse `./.env` til ønsket database.

## Mobil (iOS og Android via Capacitor)

Den samme React-kildekoden pakkes som native iOS- og Android-apper med Capacitor. App-ID-en er `no.kollekt.app`. Backend og Kollekt Games kjører fortsatt som separate tjenester; de bygges ikke inn i appen.

### Forutsetninger

- Node + `npm install` (samme som frontend).
- iOS: macOS med Xcode og CocoaPods (`sudo gem install cocoapods`).
- Android: Android Studio med Android SDK og en JDK 17+.

### Miljøvalg

Mobilbygg bruker Vite-modusen `mobile`, som laster `.env.mobile`. I motsetning til web-bygget (som bruker `/api` relativt til nginx) må mobilbygg peke på absolutte, offentlige HTTPS-URL-er:

```bash
cp .env.mobile.example .env.mobile   # fyll inn VITE_API_URL, VITE_GAMES_API_URL m.m.
```

### Bygg, synk og åpne

```bash
npm run mobile:sync          # bygger web (mode mobile) og kjører cap sync
npm run mobile:open:ios      # åpner Xcode-prosjektet
npm run mobile:open:android  # åpner Android Studio-prosjektet
npm run mobile:run:ios       # synk + kjør på iOS-simulator/enhet
npm run mobile:run:android   # synk + kjør på Android-emulator/enhet
```

### Native funksjonalitet

- Status bar og splash screen konfigureres i `capacitor.config.ts` og initialiseres i `src/lib/nativeBootstrap.ts`.
- App-ikoner og splash genereres fra `assets/icon.png` og `assets/splash*.png` med `npx capacitor-assets generate`.
- Haptikk på utvalgte handlinger via `src/lib/haptics.ts`.
- Push-varsler: klientregistrering og deep-link håndteres i `src/lib/pushNotifications.ts`, og enhetstoken lagres via `POST /api/push/device-token`. Selve leveringen krever APNs/FCM-konfigurasjon (Firebase-prosjekt + `google-services.json` for Android, APNs-nøkkel for iOS) som settes opp separat.
- Google Calendar OAuth returnerer til appen via URL-skjemaet `no.kollekt.app://google-calendar-connected` (se `src/lib/googleCalendarOAuth.ts`).

### Enhetstesting

Test innlogging, navigasjon, REST-kall, games, WebSocket-reconnect, Google Calendar-tilkobling og push-tillatelse på både iOS- og Android-enheter/simulatorer. Xcode- og Android Studio-verktøykjedene må være installert lokalt for dette.

## Viktige API-endepunkter

- `GET /api/dashboard?memberName=Kasper`
- `POST /api/onboarding/users`
- `POST /api/onboarding/login`
- `POST /api/onboarding/collectives`
- `POST /api/onboarding/collectives/join`
- `GET /api/onboarding/collectives/code/{userId}`
- `GET /api/members/collective?memberName=<name>`
- `GET/POST/PATCH /api/tasks` (`GET/PATCH` krever `memberName`)
- `GET/POST/PATCH/DELETE /api/tasks/shopping` (`GET/PATCH/DELETE` krever `memberName`)
- `GET/POST /api/events` (`GET` krever `memberName`)
- `GET/POST /api/chat/messages` (`GET` krever `memberName`)
- `GET/POST /api/economy/expenses` (`GET` krever `memberName`)
- `GET /api/economy/balances?memberName=<name>`
- `GET/POST /api/economy/pant` (`GET` krever `memberName`)
- `GET /api/economy/summary?memberName=<name>`
- `GET /api/leaderboard?memberName=<name>`
- `GET /api/achievements`

## CI/CD

GitHub Actions workflow bygger frontend og backend på pushes/PR mot `main`.

For Docker Hub publish på `main`, sett secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Workflow pusher:

- `<DOCKERHUB_USERNAME>/kollekt-frontend:latest`
- `<DOCKERHUB_USERNAME>/kollekt-backend:latest`
