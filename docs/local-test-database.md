# Disposable test database

This PostgreSQL instance is for local integration and end-to-end tests. It is
separate from Neon, listens only on `127.0.0.1:5433`, and stores its data in a
temporary filesystem.

## Start PostgreSQL

From the repository root:

```powershell
pnpm db:test:up
pnpm db:test:status
```

## Run the integration suite

The following command starts PostgreSQL, applies the committed migrations, and
runs the local-only integration tests:

```powershell
pnpm db:test
```

The test bootstrap rejects database URLs unless they target
`localhost:5433/alostar_test`. Existing `DATABASE_URL` and `DIRECT_URL` values
for Neon are overwritten inside the Jest process and are never used by this
suite.

## Apply the existing migration

In the same PowerShell window:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/alostar_test?schema=public"
$env:DIRECT_URL=$env:DATABASE_URL
$env:JWT_SECRET="local-test-only-secret-change-me"

pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec prisma migrate status
```

Use `migrate deploy`, not `migrate dev`. The disposable database should apply
the migrations already committed to the repository and must not create or
modify migration files.

## Stop and erase PostgreSQL

```powershell
pnpm db:test:down
```

The `down` command removes the container. Its temporary database storage is
discarded with it.
