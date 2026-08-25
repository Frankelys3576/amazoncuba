# Tienda Cuba Amazon — Core Map

Marketplace for Cuban businesses/hostales. Spanish-language product copy, comments, API error messages — keep new user-facing strings/comments in Spanish.

Multi-app repo, NOT a monorepo tool (no root package.json, no Turborepo/Nx/Lerna). Each app has its own package.json/node_modules and deploys as a separate Vercel project. Always run commands from inside the relevant app dir.

Apps:
- `backend/` — Express REST API, deployed as Vercel serverless functions, talks to Supabase (Postgres + Auth + Storage). See `mem:backend/core`.
- `frontend/` — public storefront (customers, "CubaBnB" hostal listings).
- `seller-frontend/` — store owner dashboard.
- `admin-frontend/` — internal admin panel (approve stores, users, marketing, settings).
- `easyWeb/` — currently empty.
Frontend shared architecture/conventions: see `mem:frontends/core`.

Cross-cutting refs:
- `mem:tech_stack` — languages/frameworks/versions per app.
- `mem:suggested_commands` — dev/build/lint commands, Darwin-specific shell notes.
- `mem:conventions` — code style/patterns specific to this codebase.
- `mem:task_completion` — what to run before considering a task done (there is no test runner).

## Project-wide invariants
- No test runner anywhere (`backend` npm test is a stub; frontends have no test script). Don't assume Jest/Vitest exists.
- No migration framework — schema changes via loose `.sql` files or ad hoc JS scripts running raw SQL.
- Store/product status workflow: sellers register with `pending` status stores (unless `auto_approve_sellers` platform setting is true); `admin-frontend/src/AdminStores.jsx` approves/rejects. Public listings must filter to `approved`.
- Admin auth IS real, per-person auth — admin routes require `Authorization: Bearer <token>` whose Supabase user has `app_metadata.role === 'admin'`; `authenticateAdmin` (`backend/src/middleware/auth.middleware.js`) verifies it on every request, and `admin-frontend` keeps a real access token in `localStorage.admin_token`. Mount any new admin route behind `authenticateAdmin`.
- The admin role is granted only with the service-role key: `node backend/set_admin_role.js <correo>`. It lives in `app_metadata`, never `user_metadata` — any user can rewrite their own `user_metadata` via `updateUser`, so a role kept there would be self-grantable. `PUT`/`DELETE /api/users/:id` refuse to touch an admin account (403); there is exactly one, and nothing else could restore access.
