# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tienda Cuba Amazon — a marketplace platform for Cuban businesses/hostales, comprised of a NestJS/Prisma backend (with the original Express backend still in the tree as a rollback) and three independent Vite/React single-page apps (customer-facing storefront, seller dashboard, admin panel). Product copy, comments, and API error messages are in Spanish; keep new user-facing strings and comments consistent with that.

## Repo layout

This is a multi-app repo, NOT a workspace/monorepo tool (no root `package.json`, no Turborepo/Nx/Lerna). Each app has its own `package.json`, `node_modules`, and is deployed as a **separate Vercel project**:

- `backend-nest/` — **the backend that serves production.** NestJS + Prisma REST API. Talks to the same Supabase (Postgres via Prisma; Auth + Storage via `@supabase/supabase-js`).
- `backend/` — the original Express REST API. **No longer serves traffic**; it stays deployed purely as the rollback target (see Deployment).
- `frontend/` — the public storefront (customers browse stores/products, place orders, "CubaBnB" hostal listings).
- `seller-frontend/` — dashboard for store owners (manage products, orders, profile).
- `admin-frontend/` — internal admin panel (approve stores, manage users, marketing, settings).
- `easyWeb/` — currently empty.

Run any command from inside the relevant app directory (`backend-nest/`, `backend/`, `frontend/`, `seller-frontend/`, `admin-frontend/`) — there is no root install/build/lint script.

## Commands

Each frontend (`frontend/`, `seller-frontend/`, `admin-frontend/`) uses the same Vite/React/oxlint setup:

```bash
npm install
npm run dev       # vite dev server
npm run build     # vite build -> dist/
npm run lint      # oxlint
npm run preview   # preview production build
```

Backend (NestJS — the one that serves production):

```bash
cd backend-nest
npm install
npx prisma generate  # required after any schema.prisma change, and after a fresh install
npm run start:dev    # nest start --watch (PORT from .env, default 5001)
npm run build        # nest build -> dist/
npm test             # jest unit tests
npm run test:e2e     # supertest e2e tests
npm run lint         # eslint -- NOTE: this runs with --fix and will rewrite files
```

Backend (Express — rollback only):

```bash
cd backend
npm install
npm run dev        # nodemon src/index.js (reads PORT from .env, default 5001 locally)
npm start           # node src/index.js
```

`backend-nest` is the only app with tests (Jest unit + Supertest e2e; Prisma and Supabase are mocked, nothing hits a live database). `backend`'s `npm test` is a stub and the frontends have no test script — do not assume a runner exists elsewhere without checking.

## Backend architecture

Two backends implement the same API and are kept behaviour-compatible: `backend-nest/` serves production, `backend/` is the rollback. **A behavioural change to one almost always needs the same change to the other** — several past fixes shipped to both in a single commit. The contract described below is what both implement; paths are given for the Express side, with the NestJS equivalent noted where it differs.

### NestJS (`backend-nest/`) — the deployed backend

- One module per resource under `src/<resource>/` (Controller + Service + DTOs), mirroring the Express routers. `PrismaModule` is global; Supabase Auth and Storage stay reachable through `SupabaseModule`.
- Prisma points at the same Supabase Postgres. `prisma/schema.prisma` is the source of truth and matches the live database. There is **no** `prisma/migrations` directory and `prisma migrate` is not used — schema changes still happen through the ad hoc SQL described below, then get reflected into the schema by hand or with `prisma db pull`.
- The Express middleware map onto guards in `src/auth/`: `authenticateSeller` → `SellerAuthGuard` (+ `SellerAuthStrategy`), `requireStoreOwnership` → `StoreOwnershipGuard`, `authenticateAdmin` → `AdminGuard`, `authorizeOrdersQuery` → `OrdersQueryAuthGuard`, `authorizeOrderUpdate` → `OrderUpdateAuthGuard`, `requireAdminWhenRequested` → `AdminWhenRequestedGuard`. **Any new admin route must be mounted behind `AdminGuard`**, exactly as on the Express side.
- Rate limits use `@nestjs/throttler` with per-route `@Throttle` overrides matching Express's numbers, and carry the same per-instance in-memory caveat. `trust proxy` is `1` in `src/main.ts` and **stays `1`** even though `/api` now arrives through a proxy hop — that was measured, and the extra hop does not collapse the per-IP buckets.
- A global interceptor (`common/legacy-fields.interceptor.ts`) strips the `legacy_*` bigint columns from every response: they are migration-rollback scaffolding, and `JSON.stringify` cannot serialize a bigint at all. This is the one visible response difference from Express, which still leaks them.
- `src/main.ts` must call `app.listen()` unconditionally — Vercel's NestJS preset runs the listening server as a single function. Do not reintroduce a `NODE_ENV`/`VERCEL` gate or an exported serverless handler.

### Express (`backend/`) — retained as the rollback

Plain Express app in `backend/src/`, `routes/*.routes.js` → `controllers/*.controller.js` → Supabase client (`config/supabase.js`). No service/model layer — controllers talk to Supabase directly.

- `src/index.js` mounts each router under `/api/<resource>` (`products`, `auth`, `orders`, `stores`, `users`, `categories`, `settings`, `upload`) and exports the `app` for Vercel; it only calls `app.listen` when not running on Vercel/production.
- `config/supabase.js` builds a single Supabase client using `SUPABASE_SERVICE_ROLE_KEY` (falls back to `SUPABASE_ANON_KEY`). The service role key bypasses Row Level Security, so backend code is entirely responsible for its own authorization — Postgres will not stop anything. Those checks live in `src/middleware/auth.middleware.js` (`authenticateSeller`, `requireStoreOwnership`, `authenticateAdmin`, `authorizeOrdersQuery`, `authorizeOrderUpdate`, `requireAdminWhenRequested`); routes that touch anything non-public are mounted behind one of them. Four writes stay unauthenticated by design because customers legitimately call them with no account: `POST /api/orders`, `POST /api/upload`, `POST /api/products/:id/view` and `POST /api/products/:id/reviews`. All but `POST /api/orders` are rate-limited (see below); `POST /api/orders` has no rate limiter of its own but computes totals server-side and caps line quantities. `POST /api/upload` still awaits its own authorization design.
  - `PUT /api/orders/:id` is **not** unauthenticated any more: `authorizeOrderUpdate` allows three callers — a customer with no credential, who may only set `delivered` (knowing the order id is the credential, as with `GET /api/orders?ids=`); the seller of a store with a line item in that order, limited to `shipped`/`delivered`; and an admin. The controller then validates the value against `ORDER_STATUSES` (`pending`/`shipped`/`delivered`) before writing — that check is what stops an admin token writing an arbitrary status, so keep it and `backend-nest`'s `UpdateOrderDto` in sync with it.
  - Some public reads are caller-aware rather than guarded: `GET /api/stores`, `GET /api/stores/:id` and `GET /api/products` never reject a caller, but resolve the credential (if any) with `resolveOrdersCaller` and show non-`approved` stores — and their products — only to an admin or the owning seller. A hidden store answers `404`, the same as one that does not exist. `GET /api/stores?as=admin` is the exception: with that flag the route does demand an admin credential (401/403), so `admin-frontend` finds out its session expired instead of silently rendering an empty panel.
  - Order totals are computed server-side from `products.price` (`createOrder` ignores any `total`/`price` in the body) and capped at 1000 units per line.
  - The public write endpoints are rate-limited in `src/middleware/rate-limit.middleware.js` (login 10/15min, reviews 5/h, product views 60/h, uploads 20/h). The counter is in memory, so on Vercel it limits **per instance**, not globally. `app.set('trust proxy', 1)` in `src/index.js` is what makes the per-IP buckets meaningful behind Vercel — do not change it to `true`.
- Auth (`auth.controller.js`) is Supabase Auth: `register` creates the user via `supabase.auth.admin.createUser` (auto-confirmed) and, if `store_name` is present, also inserts a pending `stores` row (store type `business` or `hostal`, hostal-specific fields like lat/lng/price_per_night are duplicated onto direct columns for map queries). `login` uses `signInWithPassword` and looks up the caller's store by `stores.user_id`. There's no backend-issued JWT — Supabase's session object is returned directly to the client.
- Admin auth is real, per-person auth: admin routes require an `Authorization: Bearer <token>` header holding a Supabase access token whose user carries `app_metadata.role === 'admin'` — `authenticateAdmin` in `backend/src/middleware/auth.middleware.js` verifies it on every request. `admin-frontend` logs in through `POST /api/auth/login` and keeps the real access token in `localStorage.admin_token` (`admin-frontend/src/AdminAuth.jsx`); every admin call sends it. **Any new admin route must be mounted behind `authenticateAdmin`** — an unguarded one is a hole, not a convention.
  - The role is granted only out-of-band, with the service-role key: `node backend/set_admin_role.js <correo>`. There is no API that grants it.
  - It lives in `app_metadata`, never `user_metadata`: any authenticated user can rewrite their own `user_metadata` via `supabase.auth.updateUser`, so a role kept there would let any seller make themselves an admin. `app_metadata` is writable only with `SUPABASE_SERVICE_ROLE_KEY`.
  - `PUT`/`DELETE /api/users/:id` refuse to touch an account whose role is `admin` (403). There is exactly one admin account and no second account able to restore access.
- Image uploads (`upload.routes.js`) use `multer` memory storage (required for serverless) and push the buffer straight to a Supabase Storage bucket (`store-images`), returning the public URL.
- Numerous one-off scripts live at the top of `backend/` (`seed*.js`, `generate_*.js`, `check_*.js`, `test_db*.js`, `add_*.js`, etc.) — these are manual maintenance/migration scripts run ad hoc with `node <script>.js`, not part of the app or CI. Don't treat them as reusable modules or wire them into the server.
- Schema changes are applied via loose `.sql` files (e.g. `update_schema_hostals.sql`) or JS scripts that run raw SQL through the Supabase/pg client — there is no migration framework (no Prisma/Knex/Sequelize).

## Frontend architecture

All three frontends share the same shape: Vite + React 19 + `react-router-dom` v7, plain CSS files per component (one `.css` alongside each `.jsx`, no CSS-in-JS or Tailwind), `lucide-react` for icons, oxlint for linting (react-hooks rules enforced).

- Each app has its own `src/services/api.js` with hand-rolled `fetch` wrappers (no axios, no react-query/SWR) — these three files are near-duplicates of each other; when adding an endpoint, add the fetch wrapper to every app's `api.js` that needs it, keeping the same error-handling shape (catch, `console.error`, return `[]`/`null`/`{}` fallback for GETs, rethrow for mutations).
- API base URL logic is duplicated in each `api.js`, but in production all three resolve to the same origin: `frontend/` (served from that domain) uses the same-origin path `/api`, while `seller-frontend` and `admin-frontend` use the absolute `https://www.amasoncubano.com/api`. In dev each targets `localhost:5001/api` (or the current hostname on port 5001 for LAN testing); `VITE_API_URL` overrides both. **No frontend points at a backend deployment directly** — `/api` is a proxy (see Deployment), so changing which backend serves the API is one line in the root `vercel.json`, not an edit across three `api.js` files.
- `frontend/` (storefront) uses React Context for cross-page state: `context/CartContext.jsx` (cart) and `context/LocationContext.jsx` (selected province/municipality for filtering stores/products).
- `frontend/`, `seller-frontend/` and `admin-frontend/` each keep their own copy of `cubaLocations.js` (province/municipality data) and `AddressInputWithAutocomplete` / `LocationPinPicker` components — these are duplicated per app rather than shared.
- `seller-frontend` and `admin-frontend` are flat: page components live directly under `src/` (e.g. `SellerDashboard.jsx`, `AdminStores.jsx`) rather than in a `pages/` subfolder like `frontend` uses.
- Store/product "status" workflow: sellers register with a store in `pending` status (unless the `auto_approve_sellers` platform setting is `true`); `admin-frontend`'s `AdminStores.jsx` is where stores get approved/rejected. Keep this pending→approved flow in mind when touching store creation or listing endpoints (public listings should filter to `approved`).

## Deployment

Four Vercel projects deploy from this one repo, all on pushes to `main`:

| Project | Serves | Root directory |
|---|---|---|
| `tienda-cuba-amazon` | storefront at `amasoncubano.com` / `www.amasoncubano.com`, **and `/api`** | repo root (root `vercel.json`) |
| `backend-cuba-amazon` | the NestJS API at `api02.amasoncubano.com` | `backend-nest/` |
| `seller-cuba-amazon` | seller dashboard at `seller.amasoncubano.com` | `seller-frontend/` |
| `admin-cuba-amazon` | admin panel at `admin.amasoncubano.com` | `admin-frontend/` |

**How `/api` reaches the backend.** The root `vercel.json` is *not* legacy — it is the live config for `tienda-cuba-amazon`. It builds `frontend/` and routes `/api/(.*)` to `https://api02.amasoncubano.com/api/$1`, an external proxy (legacy `routes` accept an absolute `dest`, which proxies rather than redirects). All three frontends therefore reach one origin, and swapping backends is that single `dest` line.

- The proxy target is deliberately the **custom domain**, not the project's `*.vercel.app` name. `*.vercel.app` names are released when a project is deleted or renamed, and because this is a same-origin proxy that forwards `Authorization`, whoever claimed the name next would receive every admin and seller bearer token.
- `backend/src/index.js` is still built by the root `vercel.json` on purpose. That is the rollback lever: point `dest` back at `/backend/src/index.js` and Express serves again without a rebuild. Only remove that build once the NestJS backend has soaked.
- `backend-nest/vercel.json` contains only `"framework": "nestjs"`. That pin is **required**: a Vercel project created through the API has no framework preset, and without it the build fails with `No Output Directory named "public" found`.

Env vars:

- `backend-nest/.env` (see `backend-nest/.env.example`): `PORT`, `DATABASE_URL` (pooled Supavisor connection, port 6543, `pgbouncer=true` — serverless fan-out exhausts the direct connection limit), `DIRECT_URL` (direct connection, port 5432, schema operations only), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. On Vercel, the three `SUPABASE_*` values in Production are supplied by an attached Supabase Marketplace integration rather than from this file — check there before assuming a missing key.
- `backend/.env` (see `backend/.env.example`): `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Admin access

Per-admin auth is already live in production, so the one-time ordering step below is history — it is recorded because the same sequence applies to any *new* environment: grant the role **before** the backend and `admin-frontend` ship there. `node backend/set_admin_role.js <correo-del-admin>` is what grants it, using the service-role key directly against Supabase (it is independent of which backend is serving). If a deploy lands before the role exists, **nobody can log into the admin panel** — the login screen rejects the account, and there is no admin API to grant the role.

Two consequences that remain permanently true:

- **Recovering the admin password is a Supabase dashboard job.** Once the role is set, `PUT /api/users/:id` refuses to act on that account, so the admin's own password can no longer be reset through the panel. Supabase's own dashboard (Authentication → Users) is the only recovery path. Confirm the credentials work before locking the account down.
- There is exactly one admin account. Deleting it through the panel is likewise refused (403), for the same reason: nothing else could restore access.
