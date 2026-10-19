# Deploying TremorSense

Three pieces, deployed independently:

| Piece | Where | How |
|---|---|---|
| `backend/` | Northflank | Dockerfile (combined service) |
| `frontend/` | Vercel | Git integration, zero config |
| `raspberry_pi/` | the cane | git pull + systemd — see [raspberry_pi/README.md](raspberry_pi/README.md) |

Deploy in that order: the frontend needs the backend's URL, and the Pi needs
both the URL and the ingest key.

---

## 1. Database

Any Postgres works (Prisma 7 connects via the `pg` driver adapter). Northflank's
managed Postgres addon, Supabase, or Prisma Postgres (`npx create-db`) are all
fine.

Keep the connection string — it becomes `DATABASE_URL`.

### If you use Supabase (or any pooler), you need two URLs

Supabase gives you the same database on two ports, and they are not
interchangeable:

| Port | Mode | Use it for |
|---|---|---|
| **6543** | Transaction pooler | `DATABASE_URL` — the running app |
| **5432** | Session / direct | `DIRECT_URL` — migrations only |

`prisma migrate deploy` issues `SET session_replication_role = 'replica'` and
takes a session-level advisory lock. A transaction-mode pooler supports
neither, so a container that only has the 6543 URL will fail or hang at the
migration step on boot. (Session mode on port 6543 was removed in February
2025 — 6543 is transaction-only now.)

```
DATABASE_URL=postgresql://USER:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://USER:PASS@aws-0-REGION.pooler.supabase.com:5432/postgres
```

[backend/prisma.config.ts](backend/prisma.config.ts) prefers `DIRECT_URL` for
every CLI command, while the app keeps using `DATABASE_URL` — the two paths are
deliberately separate. If `DATABASE_URL` looks like a pooler and `DIRECT_URL`
is missing, `docker-entrypoint.sh` stops with an explanatory error rather than
hanging.

You do **not** need `?pgbouncer=true`. That flag disabled prepared statements
in Prisma's old query engine; the `pg` driver adapter only uses named prepared
statements if given a `statementNameGenerator`, which this project does not.

On a small pooler, also set `PG_POOL_MAX` (see below) so the app doesn't
exhaust the connection allowance.

Migrations are applied automatically on container start by
`backend/docker-entrypoint.sh` (`prisma migrate deploy`, which only runs
committed migrations and never resets anything). Set `SKIP_MIGRATIONS=1` if you
would rather run them as a separate release step.

> If this database already held the old `dashboard` / `piData` tables, the
> migration `20261016120000_fog_episodes_and_rollups` **drops both**. They were
> never written to by any code path, but check before deploying if you believe
> otherwise.

## 2. Backend → Northflank

Create a **Combined service** → build from the repo, Dockerfile:

| Setting | Value |
|---|---|
| Build context | `/backend` |
| Dockerfile | `/backend/Dockerfile` |
| Port | `3004` (HTTP, public) |
| Health check | `GET /health` |

Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | from step 1 (pooler/6543 is fine) |
| `DIRECT_URL` | session-mode URL (Supabase port 5432) — required if `DATABASE_URL` is a pooler |
| `JWT_SECRET` | `openssl rand -base64 48` — rotating it signs everyone out |
| `JWT_EXPIRES_IN` | `30d` (optional) |
| `PI_INGEST_KEY` | `openssl rand -hex 32` — the cane's shared secret |
| `GROQ_API_KEY` | from <https://console.groq.com/keys> |
| `GROQ_MODEL` | `openai/gpt-oss-120b` (optional) |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://tremorsense.vercel.app` |
| `PG_POOL_MAX` | optional; set to a low number on small Postgres tiers |

`PORT` is injected by Northflank and honoured automatically.

Northflank gives you a URL like `https://api--tremorsense--abc123.code.run`.
Verify it:

```bash
curl https://<your-backend-url>/health
# {"msg":"Server is up and running"}
```

**`CORS_ORIGINS` must list the exact frontend origin** (scheme + host, no
trailing slash, comma-separated for several). A missing entry shows up as the
browser blocking every request while `curl` works fine. Vercel preview
deployments get their own hostnames — add them too if you want previews to work
against production.

## 3. Frontend → Vercel

Import the repo and set **Root Directory** to `frontend`. The build is already
configured for Vercel (`nitro: { preset: "vercel" }` in
[frontend/vite.config.ts](frontend/vite.config.ts)), which emits
`.vercel/output` — Vercel detects it without a `vercel.json`.

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Other (or Vite — the nitro output overrides it) |
| Build command | `npm run build` |
| Install command | `npm install` |

Environment variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | your Northflank URL, **no trailing slash** |

`VITE_*` variables are inlined at build time, so changing it requires a
redeploy, not just a restart.

> **Why `package.json` has an `overrides` entry.** Vercel's registry proxy
> blocks `@tanstack/start-server-core` below 1.169.39 over an XSS advisory
> ([GHSA-qx66-fv34-fjm8](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8)),
> failing the install with a 403. `@tanstack/react-start@^1.169.3` resolves it
> to 1.169.44, and the override keeps any future install from pulling a
> vulnerable copy back in transitively. Do **not** work around this with
> `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS=1` — that ships a known XSS
> in the server-rendering path.

After deploying, go back and put the Vercel URL into the backend's
`CORS_ORIGINS`.

## 4. Cane → Raspberry Pi

Full instructions in [raspberry_pi/README.md](raspberry_pi/README.md).

> **Hardware floor:** the current model is 1.26 GB and needs ≈2.5 GB RAM to
> load, so the cane needs a **Pi 4 or 5 with 4 GB+**. scikit-learn must be
> **1.9.1**, the version it was pickled with. Run
> `python3 -m tremorsense.checkmodel` on the device to confirm both before
> trusting it.

The three settings that must match the backend:

| `raspberry_pi/.env` | Must equal |
|---|---|
| `API_BASE_URL` | the Northflank URL (no trailing slash) |
| `PI_INGEST_KEY` | the backend's `PI_INGEST_KEY` |
| `CANE_ID` | the Cane ID the patient signed up with (`TS-XXXX-XXXX`) |

A `404` from `/pi_data` means no account is paired with that `CANE_ID` yet — the
Pi keeps buffering, and the data uploads once someone signs up with it.

---

## Env var reference

| Variable | Service | Required |
|---|---|---|
| `DATABASE_URL` | backend | yes |
| `DIRECT_URL` | backend | only if `DATABASE_URL` is a transaction pooler |
| `JWT_SECRET` | backend | yes |
| `PI_INGEST_KEY` | backend + Pi | yes (same value) |
| `GROQ_API_KEY` | backend | yes (chatbot 502s without it) |
| `CORS_ORIGINS` | backend | yes in production |
| `NODE_ENV`, `PORT`, `JWT_EXPIRES_IN`, `GROQ_MODEL`, `PG_POOL_MAX` | backend | no |
| `VITE_API_URL` | frontend | yes |
| `CANE_ID`, `API_BASE_URL` | Pi | yes |
| everything else in `raspberry_pi/.env.example` | Pi | no (has defaults) |

Templates: [backend/.env.example](backend/.env.example),
[frontend/.env.example](frontend/.env.example),
[raspberry_pi/.env.example](raspberry_pi/.env.example). No `.env` file is
committed.

## Local development

```bash
# backend  (http://localhost:3004)
cd backend && cp .env.example .env && npm install && npm run dev

# frontend (http://localhost:8080)
cd frontend && cp .env.example .env && npm install && npm run dev
```

The frontend dev server runs on **8080**, so the backend's `CORS_ORIGINS` must
include `http://localhost:8080` — that is what `.env.example` ships with.

## Post-deploy smoke test

```bash
API=https://<your-backend-url>

curl $API/health

# Create an account (also pairs the cane)
curl -X POST $API/auth/signup -H 'content-type: application/json' \
  -d '{"name":"Test","email":"you@example.com","password":"a-strong-password","cane_id":"TS-4F2A-9C71"}'
# -> {"token":"...","user":{...}}

TOKEN=<token from above>
curl "$API/api/overview?tz=0" -H "authorization: Bearer $TOKEN"

# Simulate a cane upload
curl -X POST $API/pi_data -H 'content-type: application/json' \
  -H "x-api-key: $PI_INGEST_KEY" \
  -d '{"cane_id":"TS-4F2A-9C71","episodes":[{"started_at":"2026-01-01T10:00:00.000Z","ended_at":"2026-01-01T10:00:08.000Z","duration_ms":8000,"confidence":0.9,"window_count":4}]}'
```

Then open the Vercel URL, sign in, and the episode should appear on the
dashboard.

## Known limitations

* **Chat history is in-process.** `/llm_bot` keeps each user's conversation in
  memory, so it resets on redeploy and is not shared across replicas. Move it to
  a table if you scale the backend beyond one instance.
* **One shared ingest key for all canes.** Any cane with the key can post as any
  `cane_id`. Fine for a pilot; issue per-device keys before a wider rollout.
* **No password reset flow** — there is no email sending configured.
