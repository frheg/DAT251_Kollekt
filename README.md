# DAT251 Kollekt

Fullstack kollektiv-app basert på eksisterende Figma-export.



## Stack

- Frontend: React + TypeScript (Vite)
- Backend: Spring Boot (Kotlin)
- Messaging + cache: Kafka + Redis
- Database: PostgreSQL
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
- Redis: `localhost:6379`
- Kafka: `localhost:9092`

Database kjøres ikke lokalt i Compose. Backend kobler til Supabase via verdiene i `./.env`.

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

Hvis direktekoblingen mot Supabase feiler lokalt eller i Docker, bruk pooler-connection string fra Supabase-dashboardet i stedet for `db.<project-ref>.supabase.co`.

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
- `GET /api/drinking-game/question?memberName=<name>`

## CI/CD

GitHub Actions workflow bygger frontend og backend på pushes/PR mot `main`.

For Docker Hub publish på `main`, sett secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Workflow pusher:

- `<DOCKERHUB_USERNAME>/kollekt-frontend:latest`
- `<DOCKERHUB_USERNAME>/kollekt-backend:latest`
