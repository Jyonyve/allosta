# Alostar consultation operations platform

Alostar is a full-stack MVP for arranging and operating consultations about health test results. It gives customers, advisors, and operators role-specific workspaces while keeping scheduling, consent, and sensitive-data access rules on the server.

## What is included

- Customer login, accessible test results, computed appointment slots, reservation, cancellation, and consultation history
- Advisor profile, availability management, consultation schedule, persisted draft records, and transactional finalization
- Operator reporting, consultation oversight, external-consent verification, and no-show processing
- Korean/English interface with Korean-first locale-aware dates and a persisted language preference
- Test-result-scoped proxy consent through self-service approval or externally verified lawful process
- PostgreSQL constraints for overlapping availability and active consultation conflicts
- A disposable PostgreSQL 17 integration environment and GitHub Actions verification

## Technology

| Area           | Stack                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| API            | NestJS 11, TypeScript, Prisma 7, `@prisma/adapter-pg`                           |
| Web            | React 19, Vite 8, TypeScript                                                    |
| Database       | PostgreSQL 17 locally; Neon-compatible pooled runtime and direct migration URLs |
| Authentication | Email/password, bcrypt, JWT access tokens, role guards                          |
| Tests          | Jest unit tests and Supertest/PostgreSQL integration tests                      |

## Repository layout

```text
apps/api                 NestJS API, Prisma schema/migrations, seed, and tests
apps/web                 React role-based portal
docs                     Local development documentation
compose.test.yml         Disposable local PostgreSQL database
.github/workflows/ci.yml CI migration, test, lint, and build pipeline
```

## Prerequisites

- Node.js 24
- pnpm 11.18.0
- Docker Desktop with Linux containers for the disposable test database
- A PostgreSQL database for interactive local development

## Install

```powershell
git clone https://github.com/Jyonyve/alostar.git
cd alostar
pnpm install --frozen-lockfile
Copy-Item apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your PostgreSQL URLs and a private JWT secret. `DATABASE_URL` is the pooled runtime connection; `DIRECT_URL` is used by Prisma CLI and migrations. Never expose either value through Vite.

Generate the Prisma client, apply the committed migration, and seed demo data:

```powershell
pnpm --dir apps/api exec prisma generate
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api seed
```

## Run locally

Start the API and web app in separate terminals:

```powershell
pnpm --dir apps/api start:dev
```

```powershell
pnpm --dir apps/web dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:3000`, so no web environment file is needed for the default local setup.

All seeded demo accounts use `DemoPass123!`:

| Portal         | Email                   |
| -------------- | ----------------------- |
| Customer       | `customer@demo.local`   |
| Proxy customer | `proxy@demo.local`      |
| Delegate       | `delegator@demo.local`  |
| Advisor        | `advisor1@demo.local`   |
| Advisor        | `advisor2@demo.local`   |
| Operator       | `operator@demo.local`   |

## Verification

The integration suite is guarded so it can only target `localhost:5433/alostar_test`; it will reject a Neon URL.

```powershell
pnpm db:test
pnpm --dir apps/api test --runInBand
pnpm --dir apps/api build
pnpm --dir apps/web lint
pnpm --dir apps/web build
```

Stop and erase the disposable database with:

```powershell
pnpm db:test:down
```

See [docs/local-test-database.md](docs/local-test-database.md) for database details, [apps/api/README.md](apps/api/README.md) for API configuration, [apps/web/README.md](apps/web/README.md) for frontend configuration, and [docs/deployment.md](docs/deployment.md) for the GitHub Pages + Render + Neon deployment.

## Core domain decisions

- An authenticated `User` and the `Examinee` who owns a specimen are separate concepts.
- Customers select a result and time; the server assigns an eligible advisor.
- Availability ranges are persisted, while 30-minute appointment slots are calculated.
- Delegation applies to one specific test result, never every result for an examinee.
- A first saved record moves a consultation to `DOCUMENTING`; finalization writes `FINAL` and `COMPLETED` atomically.
- Final records are immutable, and only previous-day `RESERVED` consultations qualify as no-shows.
- Business scheduling uses `Asia/Seoul`.

This is an MVP: it intentionally excludes medical diagnosis, payments, notifications, lab analysis, recurring availability, waitlists, and real identity/e-signature integrations.
