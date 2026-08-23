# Disposable test database

This PostgreSQL instance is dedicated to local integration and end-to-end tests.

It is completely separate from Neon, listens only on `127.0.0.1:5433`, and stores its data in disposable container storage.

## Start PostgreSQL

From the repository root:

```powershell
pnpm db:test:up
pnpm db:test:status
```

## Run the integration suite

The following command starts PostgreSQL, applies the migrations committed to the repository, and runs the local integration test suite:

```powershell
pnpm db:test
```

The integration test bootstrap accepts only the following database target:

```text
localhost:5433/allosta_test
```

Existing `DATABASE_URL` and `DIRECT_URL` values, including Neon credentials, are overridden inside the Jest process and are never used by this suite.

This prevents integration tests from accidentally running against a development or hosted database.

## Apply the existing migrations manually

In the same PowerShell window:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/allosta_test?schema=public"
$env:DIRECT_URL=$env:DATABASE_URL
$env:JWT_SECRET="local-test-only-secret-change-me"

pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec prisma migrate status
```

Use `migrate deploy`, not `migrate dev`.

The disposable database is intended to apply migrations already committed to the repository. It should not create or modify migration files.

## Why real PostgreSQL is used

The schema includes PostgreSQL-specific integrity rules such as exclusion constraints and partial unique indexes.

These constraints are part of the application's concurrency and scheduling guarantees, so the integration suite intentionally runs against real PostgreSQL rather than an in-memory substitute.

## Stop and erase PostgreSQL

```powershell
pnpm db:test:down
```

The command removes the test container and its disposable database storage.
