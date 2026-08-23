# Deployment: GitHub Pages + Render API + Neon PostgreSQL

The demo is deployed across three providers:

- GitHub Pages serves the static React/Vite frontend.
- Render runs the NestJS API.
- Neon hosts PostgreSQL.

```text
Browser
   │
   ▼
GitHub Pages
React / Vite
   │
   │ HTTPS API requests
   ▼
Render Web Service
NestJS API
   │
   ▼
Neon PostgreSQL
```

## 1. Prepare the database — Neon

Create a PostgreSQL database in Neon and prepare two connection strings:

- `DATABASE_URL` — pooled connection string used by the application at runtime
- `DIRECT_URL` — direct connection string used by Prisma migrations

Keep both values on the server side. They must never be exposed through Vite environment variables.

## 2. Deploy the API — Render

### Blueprint — recommended

Push the repository, then in Render select:

**New → Blueprint**

Choose this repository.

Render reads `render.yaml`, creates the `allosta-api` Web Service, and requests the environment variables marked with `sync: false`.

| Variable       | Value                            |
| -------------- | -------------------------------- |
| `DATABASE_URL` | Neon pooled connection string    |
| `DIRECT_URL`   | Neon direct connection string    |
| `JWT_SECRET`   | Long unpredictable random secret |

For example:

```bash
openssl rand -hex 32
```

`SEED_DEMO` defaults to `"true"` in `render.yaml`.

When enabled, the application seeds the demo dataset during startup after migrations have been applied.

Set it to `"false"` if demo reseeding is no longer desired.

### Manual Render setup

Alternatively:

1. Select **New → Web Service**.
2. Connect this repository.
3. Set the root directory to `.`.
4. Use the build and start commands defined in `render.yaml`.
5. Add the same environment variables listed above.

During deployment, Render runs Prisma Client generation and the API build.

At application startup it runs:

```text
prisma migrate deploy
→ optional demo seed
→ NestJS production server
```

`GET /` is used as the health-check endpoint.

## 3. Deploy the frontend — GitHub Pages

In the repository:

1. Open **Settings → Pages**.
2. Select **Deploy from a GitHub Action** as the source.
3. Open **Settings → Secrets and variables → Actions → Variables**.
4. Add:

| Name      | Value                              |
| --------- | ---------------------------------- |
| `API_URL` | `https://alostar-api.onrender.com` |

Do not include a trailing slash.

The Pages workflow passes this value to the Vite build as `VITE_API_URL`.

Push a frontend-related change to `main`, or manually run the **Deploy web to GitHub Pages** workflow.

The workflow builds:

```text
apps/web
```

and publishes:

```text
apps/web/dist
```

The workflow fails immediately when `API_URL` is missing. This prevents a production build from silently falling back to the local `/api` proxy.

## Free-tier caveats

### Render sleep

The Render Free Web Service may sleep after a period of inactivity.

The first API request after sleep can therefore be slower while the service wakes up.

### Scheduled non-attendance processing

The API contains a scheduled job that runs daily at `00:10` in `Asia/Seoul`.

It changes overdue consultations that are still in `RESERVED` state to `NOT_ATTENDED`.

Because the scheduler runs inside the Render application process, the scheduled execution is not guaranteed while a free Render instance is asleep.

For the demo, an operator can run the same non-attendance processing manually from the operator dashboard.

`NOT_ATTENDED` means that the scheduled consultation ended without a consultation record being started. It does not assert that customer absence was externally confirmed.

`NO_SHOW` is reserved for a future flow where actual customer non-attendance can be explicitly confirmed, for example through CTI integration.

### Frontend API URL

`API_URL` is compiled into the frontend bundle.

Changing it requires rebuilding and redeploying the GitHub Pages frontend.

### GitHub Pages URL

Without a custom domain, the default URL is:

```text
https://<owner>.github.io/<repo>/
```

For this repository:

```text
https://jyonyve.github.io/allosta/
```

## Verification

After deployment:

1. Open the GitHub Pages URL.
2. Log in with one of the seeded demo accounts.
3. Verify customer, advisor, and operator workspaces.
4. Check the Render health endpoint:

```text
https://alostar-api.onrender.com/
```

5. Confirm that GitHub Actions CI and Pages deployment workflows completed successfully.
