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
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`

### 2) Kjør frontend lokalt uten container

```bash
npm install
cp .env.example .env
npm run dev
```

### 3) Kjør backend lokalt uten container

```bash
cd backend
gradle bootRun
```

## Viktige API-endepunkter

- `GET /api/dashboard?memberName=Kasper`
- `GET/POST/PATCH /api/tasks`
- `GET/POST/PATCH/DELETE /api/tasks/shopping`
- `GET/POST /api/events`
- `GET/POST /api/chat/messages`
- `GET/POST /api/economy/expenses`
- `GET /api/economy/balances`
- `GET/POST /api/economy/pant`
- `GET /api/economy/summary`
- `GET /api/leaderboard`
- `GET /api/achievements`
- `GET /api/drinking-game/question`

## CI/CD

GitHub Actions workflow bygger frontend og backend på pushes/PR mot `main`.

For Docker Hub publish på `main`, sett secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Workflow pusher:

- `<DOCKERHUB_USERNAME>/kollekt-frontend:latest`
- `<DOCKERHUB_USERNAME>/kollekt-backend:latest`
