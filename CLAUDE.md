# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**S10 BizSmartHub** is a financial KPI dashboard that pulls data from an S10 ERP (SQL Server) system and presents it to management as a web dashboard. Companies tracked: CMO GROUP, INTEGRAL, MEDARQ, AMERICANA (plus GRUPO consolidated view).

## Commands

### Development

```bash
# Start all services via Docker (recommended)
docker compose up -d

# Backend only (port 3202)
cd backend && npm run start:dev

# Frontend only (port 3100)
cd frontend && npm run dev

# Sync agent (runs on client network with S10 access)
cd s10-agent && node sync-agent.js --year=2026
```

### Build

```bash
cd backend && npm run build        # → dist/
cd frontend && npm run build       # → .next/
docker compose -f docker-compose.prod.yml up -d --build   # Full production build
```

### Database

```bash
cd backend
npx prisma generate              # Regenerate client after schema changes
npx prisma migrate deploy        # Apply pending migrations
npx prisma studio                # GUI at localhost:5555
```

### Lint & Test

```bash
cd frontend && npm run lint       # Next.js ESLint

# E2E tests (Playwright — no test files exist yet)
cd e2e && npx playwright test
```

## Architecture

### Monorepo Layout

```
backend/    — NestJS API (port 3202)
frontend/   — Next.js 14 dashboard (port 3100)
s10-agent/  — Node.js sync agent (runs on client LAN with S10 SQL Server)
e2e/        — Playwright E2E tests
```

### Data Flow

S10 ERP (SQL Server) → s10-agent (on client network) → `POST /sync/push` with `x-sync-key` header → NestJS backend → PostgreSQL → Next.js dashboard

Two sync modes controlled by `S10_SYNC_MODE` env var:
- **push** (production): agent pushes data to `/sync/push`
- **direct**: backend queries S10 SQL Server directly (requires LAN access)

### Backend (NestJS)

Entry: `backend/src/main.ts` — port 3202, 100MB body limit, Swagger at `/docs` (non-prod only).

Modules in `backend/src/modules/`:
- **s10** — Raw SQL queries against S10 SQL Server (QUERY_PL_COMPLETO, QUERY_CXC, QUERY_CXP, QUERY_CAJA, QUERY_GAV, QUERY_GASTOS_FINANCIEROS)
- **sync** — Receives pushed snapshots from the agent (`POST /sync/push`)
- **kpi** — Serves processed KPI data to the frontend (consolidado, scorecard, cxc, cxp, caja, transactions, audit endpoints)
- **auth** — JWT authentication with guards: `JwtAuthGuard`, `AdminGuard`, `CompanyAccessGuard`
- **prisma** — Database connection singleton
- **company**, **users** — Entity management

Key Prisma models: `KpiSnapshot`, `Company`, `SyncLog`, `User`.

### Frontend (Next.js 14, App Router)

Entry: `frontend/src/app/` — uses App Router.

- `layout.tsx` — Root layout, fonts (Inter, Outfit, IBM Plex Mono)
- `login/` — Login page
- `dashboard/` — Main KPI dashboard (client component)

The dashboard has a company selector and year selector. Charts use **Recharts**. Data fetching uses **SWR** against `NEXT_PUBLIC_API_URL` (default: `http://localhost:3202`).

Brand colors: navy `#0D3B5E`, orange `#E25C1A`.

### Environment Variables

Backend `.env` (see `backend/.env.example`):
- `DATABASE_URL` — PostgreSQL connection
- `S10_HOST/PORT/USER/PASSWORD/DATABASE` — S10 SQL Server connection
- `S10_SYNC_MODE` — `push` or `direct`
- `SYNC_API_KEY` — Secret for agent authentication
- `JWT_SECRET` / `JWT_EXPIRATION`
- `CORS_ORIGINS`

Frontend:
- `NEXT_PUBLIC_API_URL` — Backend URL

### Ports

| Service    | Dev Port | Docker Service |
|------------|----------|---------------|
| PostgreSQL | 5435     | s10biz-db     |
| Backend    | 3202     | s10biz-api    |
| Frontend   | 3100     | s10biz-web    |

### Deployment

Production runs on VPS at `s10bizsmarthub.bizwareapps.com` behind Nginx (`nginx-s10block.conf`). See `DEPLOY.md` for full setup. Use `deploy_vps.sh` for deployments.

**MIGRADO 2026-07-14** (regla #62/#34 global): `/opt/apps/s10bizsmarthub` en el VPS PROD (`72.62.16.28`)
ahora es un clone git real (deploy key de solo lectura `~/.ssh/s10bizsmarthub_deploy`, alias SSH
`github-s10bizsmarthub`), no una copia por tarball. `deploy_vps.sh` hace `git fetch + reset --hard
origin/main` en el VPS en vez de empaquetar/subir el working tree local completo. Efecto colateral
encontrado y corregido: la rama de trabajo local es `develop`, pero el VPS siempre desplegaba `main` — un
commit (`cb9a527`, rate-limit de login) llevaba horas solo en `develop` sin mergear, así que el nuevo
`deploy_vps.sh` ahora, en su Paso 1, mergea automáticamente la rama actual a `main` antes de pushear si
no se está trabajando directo en `main`. La clave real de Postgres (antes horneada con `sed -i` sobre
`docker-compose.prod.yml`, un archivo trackeado — reintroducía drift en cada deploy) ahora vive solo en
`$VPS_APP_DIR/.env` (gitignored), que Docker Compose ya lee para `${DB_PASSWORD:-...}` sin tocar el yml.
