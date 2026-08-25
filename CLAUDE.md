# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tienda Cuba Amazon — a marketplace platform for Cuban businesses/hostales, comprised of one Express/Supabase backend and three independent Vite/React single-page apps (customer-facing storefront, seller dashboard, admin panel). Product copy, comments, and API error messages are in Spanish; keep new user-facing strings and comments consistent with that.

## Repo layout

This is a multi-app repo, NOT a workspace/monorepo tool (no root `package.json`, no Turborepo/Nx/Lerna). Each app has its own `package.json`, `node_modules`, and is deployed as a **separate Vercel project**:

- `backend/` — Express REST API, deployed as Vercel serverless functions. Talks to Supabase (Postgres + Auth + Storage).
- `frontend/` — the public storefront (customers browse stores/products, place orders, "CubaBnB" hostal listings).
- `seller-frontend/` — dashboard for store owners (manage products, orders, profile).
- `admin-frontend/` — internal admin panel (approve stores, manage users, marketing, settings).
- `easyWeb/` — currently empty.

Run any command from inside the relevant app directory (`backend/`, `frontend/`, `seller-frontend/`, `admin-frontend/`) — there is no root install/build/lint script.

## Commands

Each frontend (`frontend/`, `seller-frontend/`, `admin-frontend/`) uses the same Vite/React/oxlint setup:

```bash
npm install
npm run dev       # vite dev server
npm run build     # vite build -> dist/
npm run lint      # oxlint
npm run preview   # preview production build
```

Backend:

```bash
cd backend
npm install
npm run dev        # nodemon src/index.js (reads PORT from .env, default 5001 locally)
npm start           # node src/index.js
```

There is no configured test runner in any app (`backend`'s `npm test` is a stub, frontends have no test script) — do not assume Jest/Vitest exists unless you check.

## Backend architecture

Plain Express app in `backend/src/`, `routes/*.routes.js` → `controllers/*.controller.js` → Supabase client (`config/supabase.js`). No service/model layer — controllers talk to Supabase directly.

- `src/index.js` mounts each router under `/api/<resource>` (`products`, `auth`, `orders`, `stores`, `users`, `categories`, `settings`, `upload`) and exports the `app` for Vercel; it only calls `app.listen` when not running on Vercel/production.
- `config/supabase.js` builds a single Supabase client using `SUPABASE_SERVICE_ROLE_KEY` (falls back to `SUPABASE_ANON_KEY`). The service role key bypasses Row Level Security, so backend code is entirely responsible for its own authorization — Postgres will not stop anything. Those checks live in `src/middleware/auth.middleware.js` (`authenticateSeller`, `requireStoreOwnership`, `authenticateAdmin`, `authorizeOrdersQuery`); routes that touch anything non-public are mounted behind one of them.
- Auth (`auth.controller.js`) is Supabase Auth: `register` creates the user via `supabase.auth.admin.createUser` (auto-confirmed) and, if `store_name` is present, also inserts a pending `stores` row (store type `business` or `hostal`, hostal-specific fields like lat/lng/price_per_night are duplicated onto direct columns for map queries). `login` uses `signInWithPassword` and looks up the caller's store by matching phone number extracted from the email local-part. There's no backend-issued JWT — Supabase's session object is returned directly to the client.
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
- API base URL logic is duplicated in each `api.js`: in production it points at the fixed backend Vercel URL (`https://backend-lilac-xi-77.vercel.app/api`); in dev it targets `localhost:5001/api` (or the current hostname on port 5001 for LAN testing); `VITE_API_URL` env var overrides both. When the backend's deployed URL changes, update it in all three `api.js` files.
- `frontend/` (storefront) uses React Context for cross-page state: `context/CartContext.jsx` (cart) and `context/LocationContext.jsx` (selected province/municipality for filtering stores/products).
- `frontend/`, `seller-frontend/` and `admin-frontend/` each keep their own copy of `cubaLocations.js` (province/municipality data) and `AddressInputWithAutocomplete` / `LocationPinPicker` components — these are duplicated per app rather than shared.
- `seller-frontend` and `admin-frontend` are flat: page components live directly under `src/` (e.g. `SellerDashboard.jsx`, `AdminStores.jsx`) rather than in a `pages/` subfolder like `frontend` uses.
- Store/product "status" workflow: sellers register with a store in `pending` status (unless the `auto_approve_sellers` platform setting is `true`); `admin-frontend`'s `AdminStores.jsx` is where stores get approved/rejected. Keep this pending→approved flow in mind when touching store creation or listing endpoints (public listings should filter to `approved`).

## Deployment

Each app deploys as its own Vercel project (`.vercel/` present in each, plus per-app `vercel.json` for SPA rewrites). The root `vercel.json` is a legacy/alternate combined-deploy config (builds `frontend` + `backend` together with routing rules) — the four apps have since diverged into independent Vercel projects, so prefer checking each app's own `vercel.json` over the root one when reasoning about deployment behavior.

Backend env vars (`backend/.env`, see `backend/.env.example` for the shape): `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Deploy ordering for admin auth (do this in this order)

1. **Run `node backend/set_admin_role.js <correo-del-admin>` against production first**, before `backend/` and `admin-frontend/` ship. The panel now requires a Supabase user carrying `app_metadata.role === 'admin'`; if the deploy lands before the role is granted, **nobody can log into the admin panel** — the login screen rejects the account, and there is no admin API to grant the role because granting it needs the service-role key.
2. Then deploy `backend/` and `admin-frontend/` (either order).

Two consequences worth knowing before you start:

- **Recovering the admin password is a Supabase dashboard job.** Once the role is set, `PUT /api/users/:id` refuses to act on that account, so the admin's own password can no longer be reset through the panel. Supabase's own dashboard (Authentication → Users) is the only recovery path. Confirm the credentials work before locking the account down.
- There is exactly one admin account. Deleting it through the panel is likewise refused (403), for the same reason: nothing else could restore access.
