# Per-admin authentication — design

**Status:** approved, not yet implemented
**Closes:** finding #3 in `2026-08-24-security-hardening-scope.md`, replacing the
shared-key stopgap shipped on `security-admin-lockdown`.

## Problem

The admin API originally verified nothing. `AdminAuth.jsx` wrote the literal
string `'master_token'` to `localStorage`, `App.jsx` read it once to decide
whether to render the dashboard, and it was never attached to any request. No
route checked anything, so `GET /api/users` returned every user and
`PUT /api/users/:id` forwarded the caller's body straight to
`supabase.auth.admin.updateUserById` — two unauthenticated requests to change the
password of any account on the platform.

The `security-admin-lockdown` branch closed that with a shared key
(`ADMIN_API_KEY`) checked by `requireAdmin`. That was a deliberate stopgap: it
shuts the hole but identifies nobody, so it leaves no record of who did what.
This design replaces it with authentication of an actual person.

## Constraints

- **One admin, essentially fixed.** No admin-management UI, no invite flow, no
  roles model, no audit log. All were considered and cut as unnecessary.
- Two backends share one Supabase database: `backend/` (Express, serves all
  traffic) and `backend-nest/` (NestJS, merged but deployed nowhere). Both change.
- `backend/` has no test runner; its verification is a script plus reading.
- User-facing strings and API error messages are in Spanish.

## Decisions

### Identity lives in Supabase Auth, authorization in `app_metadata`

The admin is an ordinary Supabase Auth user carrying `app_metadata.role = 'admin'`.
No new table and no second session system: both backends already verify Supabase
JWTs for sellers, so this reuses machinery that exists and is already exercised.

**It must be `app_metadata`, never `user_metadata`.** Supabase lets any
authenticated user edit their own `user_metadata` through `updateUser`, so a role
stored there would let any registered seller promote themselves to admin with a
single API call. `app_metadata` is writable only with the service-role key.

An `admins` table keyed by `user_id` was the alternative. It is the better choice
when membership changes often or needs granular permissions; with one fixed admin
it buys nothing and costs a table, a migration, and a lookup per request.

### Granting the role

`backend/set_admin_role.js`, run manually, in the style of the repo's existing
top-level maintenance scripts. It takes an email, resolves the user, and writes
the role.

**It must merge, not overwrite.** `updateUserById` replaces the `app_metadata`
keys it is given, and Supabase already stores `provider` and `providers` there.
The script reads the existing object, spreads it, and adds `role`.

Because `app_metadata` requires the service-role key, granting admin requires
backend environment access. It cannot be done through the API by any logged-in
user, which is the property that makes this safe.

## Components

### Express — `authenticateAdmin` (`backend/src/middleware/auth.middleware.js`)

Verifies the bearer token via `supabase.auth.getUser(token)`, then checks
`user.app_metadata?.role === 'admin'`. Sets `req.admin = user`.

| Condition | Status | Message |
|---|---|---|
| No `Authorization` header | 401 | `Token no proporcionado` |
| Invalid or expired token | 401 | `Token inválido o expirado` |
| Valid token, role is not `admin` | 403 | `No tienes permisos de administrador` |

It replaces `requireAdmin` at the six existing sites: `GET/PUT/DELETE /api/users`,
`POST /api/settings`, and `PUT /api/stores/:id/status`, `PUT /api/stores/:id/zelle`,
`GET /api/stores/:id/admin-details`. The protected surface does not change — only
how the caller proves identity.

`GET /api/orders` keeps its existing three-way authorization; only the admin leg
swaps from key to token.

### NestJS — `AdminGuard`, deliberately not a passport strategy

A plain `CanActivate` guard reading the header, verifying the token, and checking
the role. It sets `request.admin`.

Two reasons it is not a second passport strategy. The `'bearer'` strategy name is
already taken by `SellerAuthStrategy`. And `@nestjs/passport`'s `AuthGuard`
assigns the entire `validate()` return onto `request.user` — the exact trap that
left `req.store` silently undefined earlier in this project and survived five
clean reviews, because the test hand-built the request shape. A direct guard does
not re-enter that shape.

Applied to the Nest equivalents of the same routes.

### Admin frontend

- `AdminAuth.jsx`: delete the hardcoded `admin@tiendacuba.com` / `admin123` check
  (which ships in the public JS bundle) and call `POST /api/auth/login`. Store
  `session.access_token` as `admin_token`. Login succeeds for a user with no
  store — the response carries `store: null`, which is correct for an admin.
- `services/api.js`: send `Authorization: Bearer <admin_token>` on admin calls.
- `App.jsx`: `PrivateRoute` stays, but as UI convenience only. Enforcement is
  server-side. This is stated in a comment so the gate is not mistaken for
  security again.
- On 401/403, clear the token and return to login. Today `api.js` swallows errors
  into `[]`, so an unauthorized panel renders as an empty one — indistinguishable
  from a working panel with no data.

### Self-lockout guard

`PUT /api/users/:id` and `DELETE /api/users/:id` refuse to act on an account whose
`app_metadata.role === 'admin'`, returning 403
`No se puede modificar ni eliminar una cuenta de administrador`.

With exactly one admin there is no second account to restore access, so a
mis-aimed delete is unrecoverable through the application.

### Removing the shared key

`requireAdmin` is deleted, `ADMIN_API_KEY` is removed from `.env.example` and its
comment block, and the variable is unset in Vercel. The break-glass if something
goes wrong is not the key — it is Supabase's dashboard, which can reset the
password regardless.

## Testing

`backend/smoke_admin_lockdown.mjs` is extended and renamed
`backend/smoke_admin_auth.mjs`:

- no token → 401 on every admin route;
- **a valid seller token → 403** on every admin route (a seller must never pass);
- admin token → 200;
- the routes that must stay public still respond 200;
- the three `GET /api/orders` callers behave as before, with the admin leg now
  requiring an admin token;
- **a normal user who calls `supabase.auth.updateUser({ data: { role: 'admin' } })`
  — which writes `user_metadata` — gains no admin access.** This encodes the
  footgun so it cannot quietly reappear.

NestJS gets unit tests for `AdminGuard` and e2e coverage of a protected route.
Because Nest's suite mocks Prisma and Supabase, at least one check must run
against the local Supabase stack, where the earlier `BigInt` defect proved that
green mocked tests can coexist with a backend that 500s on every request.

## Rollout

The panel is already non-functional after the lockdown, so there is no continuity
to protect:

1. Run `set_admin_role.js` against the production project for your account.
2. Deploy `backend/` and `admin-frontend/` together.
3. Verify with `smoke_admin_auth.mjs` against production.
4. Unset `ADMIN_API_KEY` in Vercel.

## Out of scope

- **Login rate limiting and MFA** on the admin account. Both are reasonable
  follow-ups; neither is required to close this finding.
- **`POST /api/upload`** and **`PUT /api/orders/:id`**, still unauthenticated.
  Customers legitimately call both, so each needs its own design rather than a
  lock.
- Findings #1 (order price tampering) and #4 (pending stores in public listings).

## Known residual risk

The admin account becomes the single highest-value credential on the platform: it
can change any user's password and rewrite any store's payment details. This
design authenticates it properly but does not add a second factor, so the whole
platform rests on one password. That is an accepted trade for now, and it is the
reason MFA is named as the first follow-up rather than left unmentioned.
