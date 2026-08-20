# Deployment: GitHub Pages + Render API + Neon Postgres

Free hosting split across three providers. The web app is a static Vite build served by
GitHub Pages; the NestJS API runs as a Render Web Service; the database lives on Neon.

```
Browser ──> GitHub Pages (static web, VITE_API_URL baked in at build)
                 │
                 └─> Render Web Service (NestJS API, CORS open)
                          │
                          └─> Neon PostgreSQL (pooled DATABASE_URL)
```

## 1. Prepare the database (Neon)

Create a database in Neon and grab two connection strings:

- `DATABASE_URL` — the pooled connection string, used at runtime
- `DIRECT_URL` — the direct connection string, used by Prisma migrations

## 2. Deploy the API (Render)

Two options:

- **Blueprint (recommended):** push this repo, then in Render use
  **New → Blueprint** and select the repo. Render reads `render.yaml`, creates the
  `allosta` web service, and prompts for the `sync: false` env vars:

  | Variable        | Value                                         |
  | --------------- | --------------------------------------------- |
  | `DATABASE_URL`  | Neon pooled connection string                 |
  | `DIRECT_URL`    | Neon direct connection string                 |
  | `JWT_SECRET`    | long random string (e.g. `openssl rand -hex 32`) |

  `SEED_DEMO` already defaults to `"true"`, so demo data is seeded on first start.
  Set it to `"false"` to skip reseeding on later restarts.

- **Manual:** New → Web Service → repo → root directory `.`, build and start commands
  from `render.yaml`, same env vars.

The service runs `prisma generate` + `build` during the deploy and
`migrate deploy` (+ optional seed) on start. The `GET /` route is the health check.

## 3. Deploy the web app (GitHub Pages)

1. In the repo: **Settings → Pages → Source → "Deploy from a GitHub Action"**.
2. In **Settings → Secrets and variables → Actions → Variables**, add:

   | Name     | Value                                  |
   | -------- | -------------------------------------- |
   | `API_URL`| `https://allosta.onrender.com`          |

   No trailing slash. This is baked into the bundle as `VITE_API_URL`.
3. Push to `main` (or run the `Deploy web to GitHub Pages` workflow manually).
   The workflow builds `apps/web` and publishes `apps/web/dist`.

The action fails fast if `API_URL` is missing so a silent `/api` fallback never ships.

## Caveats (free tiers)

- **Render free web service sleeps** after ~15 minutes idle: the first request after
  idle is slow, and the daily 00:10 KST no-show cron only runs while the service is
  awake. Operators can always run the batch manually from the dashboard.
- **`API_URL` changes require a web redeploy** because it is compiled into the bundle.
- GitHub Pages is served from `https://<owner>.github.io/<repo>` unless a custom domain
  is configured.

## Verify

- Open the Pages URL, read the seeded accounts below, and log in.
- Sweep `https://allosta.onrender.com/` for the API health response.