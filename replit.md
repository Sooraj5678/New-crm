# SalesPulse CRM

A full-stack Lead Management + Auto Dialer CRM for sales teams, with role-based access for Admins and Agents, auto dialer workflow, revenue tracking, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4, shadcn/ui components, Recharts, Wouter routing
- API: Express 5 with pino logging, JWT auth (HS256), bcryptjs
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema.ts` — DB schema source of truth (users, leads, lead_notes, lead_calls, activities)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all API hooks)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, leads, users, dashboard)
- `artifacts/crm/src/` — React frontend (pages/, components/, lib/)
- `artifacts/crm/src/index.css` — CSS theme (dark/dark sidebar, full token set)

## Architecture decisions

- **Contract-first API**: OpenAPI spec is written first, then Orval generates hooks and Zod schemas. All server routes validate inputs manually; client uses generated hooks.
- **JWT in localStorage**: Token stored as `crm_token`, user as `crm_user`. `setAuthTokenGetter` in main.tsx wires the token into every generated API hook automatically.
- **Role-based routing**: Admins → `/admin/*`, Agents → `/agent/*`. `ProtectedRoute` component enforces role checks and redirects.
- **inArray() over ANY()**: Drizzle ORM's `sql\`ANY(${array})\`` fails with pg driver. Always use `inArray(col, array)` for array membership queries.
- **Status badge CSS classes**: status/priority badge styles live in `index.css` as `.status-*` and `.priority-*` utility classes for easy extension.

## Product

- **Admin**: Full lead management (create, import CSV, assign to agents, filter/search/paginate), dashboard with KPI cards + revenue chart + agent leaderboard + status breakdown pie, reports page with CSV export, agent management (create, block, delete).
- **Agent**: Personal dashboard with stats + follow-up list, leads table (own leads only), auto dialer (call next lead, log notes, update status, close won with revenue).
- **Shared**: Lead detail page (edit, add notes timeline, close deal modal, call history), Settings page (profile + password change).
- **Demo accounts**: `admin@demo.com` / `demo1234` and `agent@demo.com` / `demo1234`

## Gotchas

- Always restart the API server workflow after editing any route file — it builds then starts, so edits aren't picked up automatically.
- `pnpm --filter @workspace/api-spec run codegen` must be re-run after editing `openapi.yaml` to update the generated hooks.
- The CRM frontend uses Wouter for routing with `BASE_URL` from Vite as the router base.
- Drizzle `inArray(col, [])` will throw if the array is empty — always guard with `array.length > 0 ? inArray(...) : []`.
- After DB schema changes: run `pnpm --filter @workspace/db run push` (dev) — production needs a migration script.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
