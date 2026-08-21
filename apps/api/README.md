# Allosta API

NestJS API for authentication, test-result access, scheduling, delegations, advisor workflows, operator reporting, and no-show processing.

## Environment

Copy `.env.example` to `.env` and provide:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
DIRECT_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
JWT_SECRET=replace-with-a-long-random-secret
PORT=3000
```

- `DATABASE_URL` is consumed at runtime through `@prisma/adapter-pg` and should be the pooled Neon URL in hosted environments.
- `DIRECT_URL` is consumed by Prisma configuration for migrations and should be the direct database URL.
- `JWT_SECRET` must be set to a private, unpredictable value outside local development.
- `PORT` defaults to `3000`.

## Database lifecycle

Run commands from the repository root unless noted otherwise:

```powershell
pnpm --dir apps/api exec prisma generate
pnpm --dir apps/api exec prisma migrate status
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api seed
```

Use `migrate deploy` to apply the committed schema. Do not generate a new migration for routine setup.

## Development

```powershell
pnpm --dir apps/api start:dev
```

The API listens on `http://localhost:3000` by default. Authentication uses an eight-hour JWT access token. There is no refresh-token or public signup flow in the MVP.

## Modules

- `auth`: login and JWT issuance
- `master-data`: test results and products
- `consultations`: computed slots, reservations, cancellation, schedules, and records
- `availability`: advisor availability use cases
- `delegations`: proxy-consent request, decision, and external verification
- `dashboard` and `operator`: reporting and operational inspection
- `batch`: previous-day no-show processing

CQRS handlers are limited to the core availability, consultation, delegation, and dashboard use cases. Simpler modules use standard Nest services/controllers.

## Tests and build

```powershell
pnpm --dir apps/api test --runInBand
pnpm db:test
pnpm --dir apps/api build
```

`pnpm db:test` starts disposable PostgreSQL on `127.0.0.1:5433`, applies committed migrations, and runs the integration suite. The test bootstrap refuses any other database target.

The database migration also contains exclusion and partial-unique constraints that are deliberately tested against real PostgreSQL; an in-memory substitute is not sufficient for these cases.
