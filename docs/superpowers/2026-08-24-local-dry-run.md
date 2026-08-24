# Local dry run — UUID v7 migration

Run 2026-08-24 against a local Supabase stack (`supabase/postgres:17.6.1.159`,
the same PostgreSQL 17.6 as production), with GoTrue, PostgREST and Kong.
**Production was never contacted.** The worktree's `backend/` has no `.env`, so
Express could not have reached it even by accident; the verification scripts
were run from a mirrored copy with a local `.env`.

## What this run proves — and what it does not

It proves the migration's **logic** end to end, and it is the first time either
backend has served real requests against a migrated database.

It is **not** a substitute for Task 4. A local stack is built from the Prisma
schema, so it cannot contain production's hand-made objects — the stray indexes,
triggers, views, RLS policies and referential actions accumulated over years of
loose `.sql` files. Those are exactly what section 0's pre-flight checks exist to
catch, and only a real copy of production can tell you whether any of them exist.

## Baseline

161 rows across the nine tables, with a deliberately mixed set of referential
actions: six foreign keys `ON UPDATE CASCADE ON DELETE SET NULL`, two
`ON DELETE CASCADE`.

## Results

| Check | Result |
|---|---|
| `001` + `002` applied | **COMMIT** |
| Section E notices | all 8 non-default referential actions reported preserved |
| `pg_get_constraintdef` before vs after | identical, plus the intended new `stores_user_id_fkey` |
| Row counts | 161 → 161, unchanged |
| Orphaned foreign keys | 0 |
| Mis-mapped foreign keys | 0 |
| `verify_uuid_v7.mjs` | PASS — 200 ids, version 7, RFC variant, no collisions |
| `smoke_auth.mjs` | PASS — all 11 checks |
| NestJS against the migrated DB | 200 on stores, products, orders, categories, settings; no `legacy_*` in any body |
| Express against the migrated DB | 200 on all four; **does** serve `legacy_*` (a known, accepted divergence) |

### The C1 failure scenario, reproduced as a pass

Deleting a product that had been viewed and reviewed cascaded its `product_views`
rows from 3 to 0. Before C1 was fixed, this raised
`violates foreign key constraint "product_views_product_id_fkey"` — a 500 for any
seller deleting a product anyone had ever looked at.

### The C2 mutation test, against a real database

With the legacy-strip interceptor removed and the app rebuilt, **every endpoint
returned 500** — `/api/stores`, `/api/products`, `/api/orders`, `/api/categories`.
The unit suite stays green at 132/132 either way, because every Prisma mock
returns plain objects with `Number` ids. This is the clearest available evidence
that the finding was production-breaking rather than theoretical.

### Finding #0, proven closed end to end

Against real Supabase Auth, with a store whose published phone is `55598765`:

- the victim registers, logs in, resolves their own store, and the store's
  `user_id` matches the authenticated user;
- an attacker registers `55598765@attacker-domain.test` — the victim's phone as
  the email local part, on an unrelated domain — logs in, and resolves **no store**.

The attack's precondition is intact, which is what makes the result meaningful
rather than vacuous: querying the database the way the **old** code did
(`stores.phone = split_part(email, '@', 1)`) still matches **1 store** — the
victim's. Only the resolution mechanism changed.

## Findings from the run

1. **`prisma db pull` cannot introspect the migrated database as configured.**
   It fails with `P4002`, because `stores.user_id` references `auth.users` and the
   datasource does not declare the `auth` schema. Enabling Prisma's `multiSchema`
   would require `@@schema` on every model, so the schema deliberately does not.
   To introspect, drop `stores_user_id_fkey`, pull, and restore it.
2. **The Prisma schema was missing the real referential actions and indexes**
   (fixed in `8a54a3b`). A future `prisma db push` would have reset the two
   cascading foreign keys to Prisma's `SET NULL` default and dropped the eight
   indexes — reintroducing C1 by another route.
3. **The verification scripts have no environment override.** Both read
   `../.env` relative to themselves, so pointing them at a dry-run copy means
   copying the files rather than setting a variable. Worth a small change before
   Task 4 makes that inconvenient for real.
