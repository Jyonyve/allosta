# Alostar web portal

React and Vite frontend with customer, advisor, and operator workspaces selected from the authenticated user role.

## Development

From the repository root:

```powershell
pnpm --dir apps/web dev
```

The default Vite server runs at `http://localhost:5173` and proxies `/api` to `http://localhost:3000`.

## API configuration

No environment file is required for the standard local setup. For a deployed API, copy `.env.example` to `.env.production.local` and set:

```dotenv
VITE_API_URL=https://api.example.com
```

Only public browser configuration belongs in `VITE_*` variables. Database URLs, JWT secrets, and other server credentials must never be placed in a Vite environment file.

## Role workspaces

- Customer: test results, available times, reservation, consultation history, and eligible cancellation
- Advisor: schedule, availability ranges, draft notes, product interest, and finalization
- Operator: aggregates, advisor performance, consultation inspection, consent verification, and no-show control

The app stores the JWT session in `sessionStorage`, clears it on logout, and returns to login when the API responds with `401`.

## Verification

```powershell
pnpm --dir apps/web lint
pnpm --dir apps/web build
```

Production builds use TypeScript project references followed by Vite bundling.
