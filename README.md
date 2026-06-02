# SalesPulse CRM

A full-stack Lead Management & Auto-Dialer CRM for sales teams. Features role-based access (Admin / Agent), auto-dialer workflow, revenue tracking, calendar follow-ups, bulk CSV import, and analytics.

**Demo credentials** — `admin@demo.com / demo1234` and `agent@demo.com / demo1234`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Wouter, TanStack Query |
| API | Node.js 24, Express 5, JWT (HS256), bcryptjs, pino |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
├── artifacts/
│   ├── crm/            # React + Vite frontend
│   └── api-server/     # Express API server
├── lib/
│   ├── db/             # Drizzle schema + DB client
│   ├── api-spec/       # OpenAPI spec (source of truth)
│   ├── api-client-react/  # Generated React Query hooks
│   └── api-zod/        # Generated Zod schemas
```

---

## Environment Variables

### API Server

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ (prod) | JWT signing secret — run `openssl rand -base64 32` |
| `PORT` | optional | API server port (default: `8080`) |
| `ALLOWED_ORIGINS` | optional | Comma-separated CORS origins (default: allow all) |

### CRM Frontend (Vite)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | prod only | Full URL of the deployed API server |
| `BASE_PATH` | optional | Base path prefix (default: `/`) |
| `PORT` | optional | Dev server port |

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+ — `npm install -g pnpm`
- PostgreSQL database

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/salespulse-crm.git
cd salespulse-crm

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and SESSION_SECRET

# 4. Push database schema
pnpm --filter @workspace/db run push

# 5. Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# 6. In a separate terminal, start the frontend (port 5173)
BASE_PATH=/ PORT=5173 pnpm --filter @workspace/crm run dev
```

The CRM will be at `http://localhost:5173` and the API at `http://localhost:8080`.

---

## Build

```bash
# Full typecheck + build all packages
pnpm run build

# Build only the frontend
BASE_PATH=/ pnpm --filter @workspace/crm run build

# Build only the API server
pnpm --filter @workspace/api-server run build
```

Frontend output: `artifacts/crm/dist/public/`
API server output: `artifacts/api-server/dist/index.mjs`

---

## Database

```bash
# Push schema changes to development DB
pnpm --filter @workspace/db run push

# Force push (skips confirmation prompts)
pnpm --filter @workspace/db run push-force
```

> **Production schema changes** are applied automatically via Replit's Publish flow (if using Replit). For other hosts, run `push` against your production `DATABASE_URL`.

---

## Deployment

### Architecture

This project has two separately deployed services:

```
Vercel (frontend)   →   API Server (Railway / Render / Fly.io)
     ↕                           ↕
  Static SPA              PostgreSQL DB
```

---

### Frontend — Vercel

1. **Push to GitHub** (see GitHub section below)

2. **Import on Vercel** — go to [vercel.com/new](https://vercel.com/new) and import your repository

3. **Configure build settings** — Vercel will auto-detect `vercel.json`:
   - Build command: `pnpm install --frozen-lockfile && BASE_PATH=/ pnpm --filter @workspace/crm run build`
   - Output directory: `artifacts/crm/dist/public`

4. **Set environment variable** in Vercel project settings:
   ```
   VITE_API_URL = https://your-api-server.railway.app
   ```

5. **Deploy** — Vercel handles SPA routing automatically via `vercel.json` rewrites.

---

### API Server — Railway (recommended)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub

2. Select your repository, set **Root Directory** to `artifacts/api-server`

3. Set environment variables:
   ```
   DATABASE_URL  = postgresql://...
   SESSION_SECRET = <strong random string>
   ALLOWED_ORIGINS = https://your-app.vercel.app
   NODE_ENV = production
   ```

4. Railway detects `package.json` scripts automatically:
   - Build: `pnpm run build`
   - Start: `pnpm run start`

5. Provision a **PostgreSQL** add-on in Railway, then run schema push:
   ```bash
   DATABASE_URL=<production-url> pnpm --filter @workspace/db run push-force
   ```

---

### Alternative API Hosts

**Render:**
- Build command: `pnpm install && pnpm run build`
- Start command: `node --enable-source-maps ./dist/index.mjs`
- Root directory: `artifacts/api-server`

**Fly.io:**
```bash
fly launch --dockerfile Dockerfile  # create a Dockerfile for the API
fly secrets set SESSION_SECRET=... DATABASE_URL=...
fly deploy
```

---

## GitHub Setup

Ensure your `.gitignore` excludes secrets before pushing:

```bash
# Verify no secrets in tracked files
git --no-optional-locks status
grep -r "SESSION_SECRET\|DATABASE_URL\|password" .env 2>/dev/null || echo "Clean"

# Initialize and push
git init
git add .
git commit -m "Initial commit: SalesPulse CRM"

# Create repo on GitHub, then:
git remote add origin https://github.com/your-username/salespulse-crm.git
git branch -M main
git push -u origin main
```

> ⚠️ Never commit `.env` files. The `.gitignore` already excludes them.
> ✅ `.env.example` **is** committed — it documents required vars without secrets.

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | ✅ | Current user |
| GET | `/api/leads` | ✅ | List leads (paginated) |
| POST | `/api/leads` | ✅ | Create lead |
| GET | `/api/leads/:id` | ✅ | Lead detail |
| PATCH | `/api/leads/:id` | ✅ | Update lead |
| DELETE | `/api/leads/:id` | Admin | Delete lead |
| POST | `/api/leads/import` | Admin | Bulk import CSV |
| GET | `/api/dashboard/stats` | Admin | KPI stats |
| GET | `/api/users` | Admin | List agents |
| GET | `/api/health` | — | Health check |

---

## Key Architecture Decisions

- **Contract-first API** — OpenAPI spec (`lib/api-spec/openapi.yaml`) is written first; Orval generates React Query hooks and Zod schemas automatically.
- **JWT in localStorage** — Token stored as `crm_token`; `setAuthTokenGetter` in `main.tsx` wires it into every API call.
- **Role-based routing** — Admins → `/admin/*`, Agents → `/agent/*`. `ProtectedRoute` enforces role checks.
- **`inArray()` not `ANY()`** — Drizzle ORM's `sql\`ANY(${array})\`` fails with the pg driver; always use `inArray(col, array)`.

---

## Scripts Reference

```bash
pnpm install                                    # Install all dependencies
pnpm run build                                  # Typecheck + build everything
pnpm run typecheck                              # Full typecheck
pnpm --filter @workspace/api-server run dev     # Start API dev server
pnpm --filter @workspace/crm run dev            # Start CRM dev server
pnpm --filter @workspace/db run push            # Push DB schema (dev)
pnpm --filter @workspace/api-spec run codegen   # Regenerate API hooks from OpenAPI
```
