# Allosta API

NestJS API for authentication, test-result access, consultation scheduling, delegation consent, advisor workflows, operator reporting, and non-attendance processing.

## Environment

Copy `.env.example` to `.env` and provide:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
DIRECT_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
JWT_SECRET=replace-with-a-long-random-secret
PORT=3000
```

- `DATABASE_URL` is used at runtime through `@prisma/adapter-pg`. In hosted environments it should use the pooled Neon connection.
- `DIRECT_URL` is used by Prisma for migrations and should use the direct Neon connection.
- `JWT_SECRET` must be private and unpredictable outside local development.
- `PORT` defaults to `3000`.

## Database lifecycle

Run commands from the repository root unless noted otherwise.

Generate the Prisma Client:

```powershell
pnpm --dir apps/api exec prisma generate
```

Check migration status:

```powershell
pnpm --dir apps/api exec prisma migrate status
```

Apply migrations committed to the repository:

```powershell
pnpm --dir apps/api exec prisma migrate deploy
```

Seed the demo dataset:

```powershell
pnpm --dir apps/api seed
```

Use `migrate deploy` for normal setup and deployment.

Do not create a new migration simply to initialize an existing environment.

## Development

Start the API in watch mode:

```powershell
pnpm --dir apps/api start:dev
```

The API listens on:

```text
http://localhost:3000
```

Authentication uses an eight-hour JWT access token.

The MVP does not include:

- refresh tokens
- public signup
- OAuth login

## Modules

### `auth`

Handles login, password verification, JWT issuance, authentication guards, and role checks.

### `master-data`

Provides test-result and product data required by consultation workflows.

### `consultations`

Handles:

- dynamic appointment-slot calculation
- consultation reservation
- advisor auto-assignment
- reservation replacement
- cancellation
- advisor consultation lists
- consultation records
- DRAFT / FINAL lifecycle
- consultation completion

### `availability`

Handles advisor availability ranges and their scheduling constraints.

### `delegations`

Handles test-result-scoped proxy consultation consent:

- delegation request
- self-service approval and rejection
- external consent verification

### `dashboard`

Calculates operational metrics such as consultation counts, completion rates, non-attendance rates, advisor statistics, and interested-product aggregates.

### `operator`

Provides operator-level consultation inspection and operational APIs.

### `batch`

Processes overdue consultations that remain in `RESERVED` state and changes them to `NOT_ATTENDED`.

The scheduled job runs daily at `00:10` using the `Asia/Seoul` timezone.

`NOT_ATTENDED` represents a consultation whose scheduled end time has passed without a consultation record being started.

It is intentionally distinct from `NO_SHOW`.

`NO_SHOW` represents explicitly confirmed customer absence and has no creation path in the current MVP.

## Application structure

The API is implemented as a Modular Monolith.

CQRS handlers are used selectively for business-heavy use cases such as:

- consultation reservation and lifecycle
- advisor availability
- delegation consent
- dashboard queries

Simpler functionality uses standard NestJS services and controllers.

Read and write operations share the same PostgreSQL database.

## Scheduling and concurrency

Customers select a test result and appointment time. They do not choose an advisor directly.

The server assigns an eligible advisor based on:

- advisor active status
- supported test type
- registered availability
- existing active consultations
- current daily workload

Active consultation states are:

```text
RESERVED
DOCUMENTING
```

Database constraints provide the final protection against concurrent booking conflicts.

The schema includes PostgreSQL-specific exclusion and partial-unique constraints.

Reservation and replacement flows also use database transactions to preserve consistency.

## Consultation records

Consultation records have two states:

```text
DRAFT
FINAL
```

The first DRAFT save changes the consultation from:

```text
RESERVED → DOCUMENTING
```

Finalization changes both resources atomically:

```text
ConsultationRecord
DRAFT → FINAL

Consultation
DOCUMENTING → COMPLETED
```

FINAL records are immutable in the MVP.

## Tests and build

Run API unit tests:

```powershell
pnpm --dir apps/api test --runInBand
```

Run PostgreSQL integration tests:

```powershell
pnpm db:test
```

Build the API:

```powershell
pnpm --dir apps/api build
```

`pnpm db:test` starts disposable PostgreSQL on `127.0.0.1:5433`, applies committed migrations, and runs the integration suite.

The test bootstrap refuses any database target other than the dedicated local test database.

Real PostgreSQL is intentionally used because exclusion constraints, partial unique indexes, transactions, and booking conflicts are part of the behavior being tested.
