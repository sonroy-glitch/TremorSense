# TremorSense

Freezing-of-gait (FOG) detection for Parkinson's patients using an instrumented
cane. Three independent parts:

```
backend/        Express + Prisma + Postgres API          -> Northflank
frontend/       TanStack Start dashboard (React)         -> Vercel
raspberry_pi/   On-device inference + offline sync       -> the cane's Pi
```

## How it fits together

1. The cane's Raspberry Pi reads three accelerometers (ankle, thigh, trunk —
   8 channels) over USB at 64 Hz.
2. A trained RandomForest labels **every sample** as normal or freezing of
   gait. Per-sample labels flicker, so each 1-second window of them votes on a
   single label.
3. Consecutive freeze windows are merged into one *episode* and written to a
   local SQLite buffer. Normal gait produces no rows — only hourly totals.
4. When the Pi finds internet it POSTs the backlog to `POST /pi_data`.
   Offline time costs nothing: data waits in SQLite and uploads are idempotent.
5. The patient sees their episodes in the web dashboard, matched to their
   account by Cane ID.

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | — | liveness |
| `POST` | `/auth/signup` | — | create account + pair a cane |
| `POST` | `/auth/signin` | — | returns a JWT |
| `GET` | `/auth/me` | Bearer | current user |
| `PATCH` | `/auth/me` | Bearer | update name/email |
| `GET` | `/api/overview?tz=<min>` | Bearer | everything the dashboard shows |
| `GET` | `/api/episodes?range=24h\|7d\|30d` | Bearer | event log |
| `POST` | `/pi_data` | `x-api-key` | the cane's batched upload |
| `POST` | `/llm_bot` | Bearer | FOG Assistant chatbot |
| `DELETE` | `/llm_bot` | Bearer | clear chat history |

Web clients authenticate with `Authorization: Bearer <jwt>` (token in
localStorage). The cane is not a browser client — it authenticates with the
shared `PI_INGEST_KEY` and names its `cane_id` in the body.

## Data model

| Table | Holds |
|---|---|
| `user` | account + its unique `cane_id` |
| `fog_episode` | one detected freeze: start, end, duration, confidence |
| `gait_rollup` | per-hour totals: normal ms, freeze ms, episode count |

Episodes are unique on `(cane_id, started_at)` and rollups on
`(cane_id, hour_start)`, which is what makes the Pi's retries safe.

## Getting started

Deployment and all environment variables: **[DEPLOY.md](DEPLOY.md)**.
Cane setup and the model contract: **[raspberry_pi/README.md](raspberry_pi/README.md)**.

```bash
cd backend  && cp .env.example .env && npm install && npm run dev   # :3004
cd frontend && cp .env.example .env && npm install && npm run dev   # :8080
```

You need a `DATABASE_URL`, a `JWT_SECRET`, a `PI_INGEST_KEY` and a
`GROQ_API_KEY` before the backend will start — it fails fast rather than
booting half-configured.

## Scope note

The model distinguishes two classes only: normal gait and freezing of gait. The
dashboard deliberately shows nothing it cannot derive from that — there is no
cue hardware, no battery telemetry, no step counting, and no prediction of
future freezes.
