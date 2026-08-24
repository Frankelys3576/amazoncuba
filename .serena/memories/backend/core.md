# Backend Core

Plain Express app in `backend/src/`. `src/index.js` mounts routers under `/api/<resource>` (products, auth, orders, stores, users, categories, settings, upload) and exports `app` for Vercel; calls `app.listen` only when not on Vercel/production.

`config/supabase.js` builds one Supabase client using `SUPABASE_SERVICE_ROLE_KEY` (falls back to `SUPABASE_ANON_KEY`) — bypasses RLS, so controllers must self-enforce authorization.

## Auth middleware (contradicts the "no authz layer" assumption — it exists, but is applied selectively)
`src/middleware/auth.middleware.js` exports `authenticateSeller` and `requireStoreOwnership`:
- `authenticateSeller`: verifies the Supabase bearer token via `supabase.auth.getUser`, then re-derives the caller's store by extracting a phone number from the email local-part and `ilike`-matching `stores.phone` (same heuristic as `auth.controller.js` login — there is no `user_id` column linking `stores` <-> `auth.users`). Sets `req.user`/`req.store`.
- `requireStoreOwnership`: checks `req.store.id === req.params.id`.
- Applied to: `product.routes.js` (create/update/delete), `store.routes.js` (`PUT /:id`, `PUT /:id/credentials`, custom-category mutations), `auth.routes.js` (`POST /delete`).
- NOT applied to: `store.routes.js` `PUT /:id/status` (admin approve/reject) and `GET /:id/admin-details` — consistent with admin-frontend having no real token to send (see `mem:core` admin auth note). Don't assume these are protected.

`auth.controller.js`: `register` creates the user via `supabase.auth.admin.createUser` (auto-confirmed) and, if `store_name` present, also inserts a pending `stores` row (type `business`/`hostal`; hostal fields like lat/lng/price_per_night duplicated onto direct columns for map queries). `login` uses `signInWithPassword` and looks up the store via the same phone-from-email-local-part heuristic. No backend-issued JWT — Supabase's session object is returned directly to the client.

Image uploads (`upload.routes.js`): multer memory storage (required for serverless) → pushes buffer to Supabase Storage bucket `store-images` → returns public URL.

Schema changes: loose `.sql` files (e.g. `update_schema_hostals.sql`) or JS scripts running raw SQL via the Supabase/pg client — no Prisma/Knex/Sequelize.
