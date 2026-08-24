# Backend Migration: Express → NestJS + Prisma

Status: approved design, pending spec review sign-off
Sub-project 1 of 4 in the broader migration (backend → NestJS/Prisma; admin-frontend, seller-frontend, frontend → Next.js, each a separate later sub-project).

## Context

The current backend (`backend/`) is a plain Express app: `routes/*.routes.js` → `controllers/*.controller.js` → Supabase client directly, no service/model layer, no ORM, no test suite, schema managed via loose `.sql` files and ad hoc JS scripts. See `CLAUDE.md` and Serena memory `mem:backend/core` for full detail on the current implementation.

Goals driving this migration: type safety / DX (TypeScript end-to-end, Prisma's typed queries, Nest's module/DI structure), and standardizing on a more commonly-known stack. This is one part of a larger plan to migrate all four apps in this repo to a modern stack; the backend goes first because every frontend depends on its API.

## Non-goals

- No change to Supabase: Postgres stays the database, Supabase Auth stays the identity provider, Supabase Storage stays the file store. RLS policies and the service-role-key trust model are unchanged.
- No frontend changes. The three existing Vite/React frontends keep calling the current Express backend (`backend/`) unchanged until each one's own future migration sub-project switches it over to the new backend.
- No new resource boundaries. Every capability the current API exposes gets a NestJS equivalent — the redesign is about internal cleanup and consistency, not scope changes.
- No `stores.user_id` column / auth model fix. The phone-derived store-lookup heuristic (extract phone from the Supabase Auth email local-part, `ilike`-match against `stores.phone`) carries over as-is. Fixing that properly is a DB schema change, out of scope here.

## Architecture

- New app lives in a new top-level directory: `backend-nest/`. It sits alongside the existing `backend/` in the repo — both exist simultaneously during the transition period.
- Deploys as its own separate Vercel project, consistent with this repo's existing pattern of one Vercel project per app. Runs as a standard Node.js app on Vercel Functions (Fluid Compute runs full Nest apps natively — no edge runtime, no serverless-adapter shimming needed).
- The existing `backend/` (Express) keeps deploying and keeps serving all three not-yet-migrated frontends throughout this sub-project and until each frontend's own migration is complete. `backend/` is only retired once `frontend/`, `seller-frontend/`, and `admin-frontend/` have all switched their `VITE_API_URL`/base-URL config to point at `backend-nest/`'s deployed URL — that retirement is a follow-up step tracked outside this sub-project, not part of it.
- Both backends connect to the same Supabase project (same Postgres DB, same Auth tenant, same Storage buckets). They are two independent read/write clients against shared state — no synchronization layer between them, same as any two services sharing one database.

## Module structure (Approach A: faithful mirror)

One Nest module per existing Express resource, each with Controller + Service + DTOs:

- `ProductsModule` (mirrors `product.routes.js` / `product.controller.js`)
- `AuthModule` (mirrors `auth.routes.js` / `auth.controller.js`)
- `OrdersModule` (mirrors `order.routes.js`)
- `StoresModule` (mirrors `store.routes.js`, includes the store-category sub-resource currently in `storeCategory.controller.js`)
- `UsersModule` (mirrors `user.routes.js`)
- `CategoriesModule` (mirrors `category.routes.js`)
- `SettingsModule` (mirrors `settings.routes.js`)
- `UploadModule` (mirrors `upload.routes.js`)

`PrismaModule` is global (`@Global()`), exporting a single `PrismaService` injected wherever a module needs DB access.

Domain-driven reorganization (grouping into Catalog/Commerce/Identity/StoreManagement) was considered and explicitly rejected for this sub-project — it bundles two risky changes (framework rewrite + restructuring) into one and can be revisited later as a follow-up refactor once the Nest backend is stable.

## Auth

- Supabase remains the identity provider unchanged: `register` still calls `supabase.auth.admin.createUser` (auto-confirmed), `login` still calls `supabase.auth.signInWithPassword`. No backend-issued JWT — the Supabase session object is still returned directly to the client, same as today.
- `authenticateSeller` (current Express middleware) becomes a Nest `AuthGuard` backed by a Passport bearer strategy. The strategy calls `supabase.auth.getUser(token)` to verify the bearer token — same verification logic as today, ported to Nest's guard/strategy convention.
- The strategy also re-derives the caller's store the same way the current middleware does: extract phone from the email local-part, `ilike`-match `stores.phone`. This runs inside the strategy (populating a request-scoped `store` the way `req.store` works today) rather than being duplicated per-controller.
- `requireStoreOwnership` becomes a second guard (or a check composed into the same guard chain) comparing the resolved store's id against `:id` route params.
- Route protection mirrors current behavior exactly: guards apply to `Products` create/update/delete, `Stores` profile/credentials/category-mutation endpoints, and `Auth` account deletion. `Stores` status-update and admin-details endpoints stay unguarded — consistent with `admin-frontend` having no real bearer token to send (its `'master_token'` in localStorage is not verified server-side; that does not change in this sub-project).

## Data layer

- Prisma schema is generated by running `prisma db pull` against the live Supabase Postgres connection string, then hand-refined: introspection alone typically won't infer all relations/enums correctly, so the generated schema gets manually reviewed and corrected against actual usage in the current controllers before being treated as source of truth.
- `PrismaService` connects using the same elevated DB credentials the current backend uses (i.e., the same trust level as `SUPABASE_SERVICE_ROLE_KEY` today — RLS is bypassed at this connection). Nest services remain responsible for their own authorization checks, same trust boundary as the current "backend code is trusted to self-enforce authorization" model — this migration does not add a Postgres-level authz layer.
- Supabase Storage and Supabase Auth admin calls (things Prisma doesn't cover) continue to go through `@supabase/supabase-js` directly from the relevant Nest services (`UploadModule`, `AuthModule`).

## API redesign scope

Within each module, cleaned up relative to the current Express API:

- Consistent JSON response shapes across all endpoints in a module (the current API has some inconsistency in ad hoc controller-by-controller shaping).
- Request validation via DTOs using `class-validator`/`class-transformer`, replacing today's ad hoc inline checks.
- A global exception filter producing a consistent error response shape: `{ error: "<mensaje en español>" }`, matching the existing convention of Spanish-language API error messages.

Redesign is explicitly bounded to the above — no endpoint is removed, no resource is renamed or merged, and every current capability remains reachable, just through a cleaned-up contract. Because `backend/` keeps running in parallel for old frontends, this backend does not need to be contract-compatible with the old one.

## Testing

- Jest (Nest's default test setup).
- Unit tests per service, with `PrismaService` mocked — covers business logic (e.g. the phone-derived store lookup, pending/approved status filtering, hostal-specific field duplication on registration).
- E2E tests per controller using Nest's `TestingModule` + Supertest — covers routing, guards, and request/response wiring, with Prisma/Supabase mocked rather than hitting a live test database.
- This is a net-new testing capability for the repo (no tests currently exist anywhere) — scope is "enough coverage to trust this rewrite," not exhaustive coverage of every edge case.

## Error handling

- Global Nest exception filter maps thrown exceptions (including Nest's built-in `HttpException` subclasses) to the `{ error: "..." }` JSON shape described above, with appropriate HTTP status codes, mirroring the status codes the current Express controllers already return (401/403/404/500 etc. per resource).

## Transition / cutover plan (for context — execution happens in later sub-projects)

1. This sub-project: build and deploy `backend-nest/` as its own Vercel project. No frontend touches it yet.
2. Each frontend migration sub-project (admin → seller → storefront, per the agreed rollout order) switches that frontend's API base URL to `backend-nest/`'s deployed URL as part of its own migration.
3. Once all three frontends are switched over, `backend/` (Express) is retired. That retirement step is tracked as follow-up work, not part of this sub-project or its implementation plan.

## Open questions / risks

- Prisma schema correctness depends on how well `prisma db pull` introspects the existing ad hoc schema (e.g. hostal-specific columns duplicated onto `stores`, category customization tables) — expect manual correction after the initial pull.
- Running two backends against one Supabase project means both must stay behavior-compatible with the *database*, even while their *APIs* diverge — e.g. if this migration's Prisma-side code changes what gets written to a shared column, the still-live Express backend and old frontends must still function correctly against that same data.
