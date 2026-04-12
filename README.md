# EvalEngine

企業独自の評価基準を構築し、AIとデータで分析・意思決定を行う**中央分析API基盤**。

## Architecture

```
[Client Apps] ──API Key──▶ [NestJS API :3001] ──internal──▶ [FastAPI AI :8000]
                                    │                               │
                           [PostgreSQL + pgvector]             [OpenAI API]
                                    │
                           [Redis / BullMQ]

[Next.js Admin :3000] ──JWT──▶ [NestJS API]
```

## Stack

| Layer | Tech |
|-------|------|
| Admin UI | Next.js 14 (App Router) + Tailwind CSS |
| API | NestJS + Passport (JWT + ApiKey) + Swagger |
| AI | FastAPI + OpenAI embeddings + GPT-4o-mini |
| DB | PostgreSQL 16 + pgvector |
| Queue | Redis + BullMQ (async analysis) |
| Monorepo | Turborepo + pnpm workspaces |

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Set: OPENAI_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET, AI_INTERNAL_KEY

# 3. Start infra
docker compose -f docker/docker-compose.yml up postgres redis -d

# 4. Migrate DB + seed demo data
cd packages/db && pnpm db:generate && pnpm db:migrate && pnpm db:seed

# 5. Start all services
pnpm dev
```

| Service | URL |
|---------|-----|
| Admin Panel | http://localhost:3000 |
| API + Swagger | http://localhost:3001/api/docs |
| AI Service | http://localhost:8000/docs |

Demo login (after seed):
- Email: `admin@demo.com` / Password: `admin123`
- Demo API Key: `demo-api-key-123456`

## Project Structure

```
apps/
  api/     # NestJS REST API — auth, tenants, projects, models, axes, questions, answers, results
  ai/      # FastAPI Python — embeddings, text analysis, scoring
  web/     # Next.js admin — dashboard, model editor, results viewer
packages/
  db/      # Prisma schema + migrations + seed
  types/   # Shared TypeScript types (DTOs)
  config/  # Shared Zod env schemas + constants
docker/    # docker-compose.yml + postgres init.sql
```

## Data Model

```
Tenant ──▶ Project ──▶ EvaluationModel ──▶ Axis ──▶ Question
                                                         │
Answer (from client app) ──▶ AnswerItem ──▶ [Embedding]
     │
     ▼
Result ──▶ ResultScore (per Axis: normalizedScore, tendency)
```

## Answer Submission API (for client apps)

```http
POST /api/v1/answers
X-Api-Key: <your-api-key>
X-Tenant-Id: <your-tenant-id>

{
  "modelId": "...",
  "respondentRef": "user-123",
  "items": [
    { "questionId": "...", "value": "3to5" },
    { "questionId": "...", "value": "問題解決の例..." }
  ]
}
```

Response: `202 { "answerId": "...", "status": "PENDING" }`

Results are computed asynchronously and available via `GET /api/v1/results`.
