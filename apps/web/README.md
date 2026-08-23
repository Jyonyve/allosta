# Allosta Web Portal

React and Vite frontend for the Allosta consultation operations platform.

The authenticated user's role determines whether the customer, advisor, or operator workspace is displayed.

The application supports Korean and English. Korean is used by default on the first visit, and the selected language is persisted in local storage.

## Technology

- React 19
- TypeScript
- Vite 8
- TanStack Query
- Fetch API with a typed API wrapper

React Router is intentionally not used.

The current MVP uses role-based single workspaces with internal view switching, so URL-based routing would add complexity without providing meaningful navigation value.

## State management

The frontend separates local UI state from remote server state.

### Local React state

React local state is used for interaction-specific state such as:

- selected workspace view or tab
- selected test result
- selected appointment day and slot
- modal visibility
- form inputs
- consultation-record editor inputs
- local notices
- authentication session
- language preference

### TanStack Query

TanStack Query manages remote state obtained from the API, including:

- accessible test results
- customer consultations
- available appointment slots
- delegation requests
- advisor profile
- advisor availability
- advisor consultations
- products
- operator dashboard
- operator consultation data
- external-consent queue

Mutations invalidate only the related queries so that the UI stays synchronized with server state without maintaining duplicate manual reload logic.

Examples:

```text
Reserve or replace consultation
→ invalidate customer consultations
→ invalidate affected available slots
```

```text
Update advisor availability
→ invalidate advisor availability
```

```text
Finalize consultation record
→ invalidate advisor consultations
→ refresh affected operational data
```

```text
Run non-attendance processing
→ invalidate operator dashboard
→ invalidate operator consultations
```

The existing `api.ts` layer remains responsible for HTTP transport.

TanStack Query does not replace `fetch`; it manages query caching, loading and error state, mutations, invalidation, and synchronization of server state.

## API layer

API calls are centralized in:

```text
apps/web/src/api.ts
```

The API wrapper provides:

- typed request and response models
- `Authorization: Bearer` handling
- JSON serialization
- request timeout handling
- normalized `ApiError`
- support for `VITE_API_URL`

Authentication tokens are not included in TanStack Query keys.

Authenticated query data is cleared when the session ends so data from one seeded role cannot be reused by another user after logout and login.

## Development

From the repository root:

```powershell
pnpm --dir apps/web dev
```

The default Vite development server runs at:

```text
http://localhost:5173
```

During standard local development, `/api` is proxied to:

```text
http://localhost:3000
```

## API configuration

No frontend environment file is required for the default local setup.

For a deployed API, copy `.env.example` to `.env.production.local` and set:

```dotenv
VITE_API_URL=https://api.example.com
```

Only browser-safe public configuration belongs in `VITE_*` variables.

Never place any of the following in a Vite environment file:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- other server credentials

Vite environment variables are bundled into client-side code and are visible to users.

## Role workspaces

### Customer

The customer workspace includes:

- accessible test results
- calculated appointment slots
- consultation reservation
- reservation replacement
- eligible cancellation
- consultation history
- proxy-consultation requests
- consent approval and rejection

### Advisor

The advisor workspace includes:

- assigned consultation schedule
- availability management
- consultation-record DRAFT editing
- interested-product selection
- follow-up notes
- FINAL record confirmation

### Operator

The operator workspace includes:

- operational dashboard
- consultation status aggregates
- advisor performance
- consultation inspection
- interested-product aggregates
- external consent verification
- manual non-attendance processing

## Session behavior

The JWT session is stored in `sessionStorage`.

On logout:

- the stored session is removed
- authenticated TanStack Query cache is cleared
- the application returns to the login screen

When the API responds with `401`, the application also clears the session and returns to login.

This is particularly important for the demo because different seeded CUSTOMER, ADVISOR, and OPERATOR accounts may be used consecutively in the same browser.

## Verification

Run lint:

```powershell
pnpm --dir apps/web lint
```

Run a production build:

```powershell
pnpm --dir apps/web build
```

The production build runs TypeScript project-reference checks before Vite bundling.
