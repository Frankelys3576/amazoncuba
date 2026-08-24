# UUID v7 Migration + Seller Ownership — Design

> Status: **design approved**. The implementation plan is a separate document.
> Revised after planning began: the three-phase split was replaced by a single transaction once the
> foreign-key graph was traced, and the Postgres version was confirmed as 17.6.

## Goal

Two changes to the same tables, shipped as one project:

1. **Close finding #0** — seller account takeover via the email→store heuristic. Replace it with a
   real `stores.user_id` foreign key to `auth.users`.
2. **Migrate every integer primary key to UUID v7**, so ids stop being enumerable and stop
   requiring BigInt serialization workarounds.

They are combined because both rewrite `stores`, and doing them separately means two migrations and
two maintenance windows on the same table.

## Scope

**In scope:** finding #0, and the primary/foreign key type change across all nine tables.

**Explicitly not in scope:** findings #1 (order price tampering), #2 (orders IDOR), #3 (admin
auth), #4 (pending stores in public listings). Those are described in
`2026-08-24-security-hardening-scope.md` and follow this project. This design does not address
them and must not be read as doing so.

**Where the code lands:** `backend/` (Express) is the priority, because it serves 100% of traffic.
`backend-nest/` receives the equivalent changes but is deployed nowhere, so its changes are not
load-bearing until cutover. Both share one Supabase database, so the schema work happens once and
serves both.

## Id generation — resolved

**The project runs PostgreSQL 17.6.** Native `uuidv7()` arrived in PG 18, so it is not available.

This does **not** force application-side generation. UUID v7 is generated database-side by a
`plpgsql` function using `gen_random_uuid()` (pgcrypto, built in) for the random bits and
`clock_timestamp()` for the 48-bit millisecond prefix, with the version and variant nibbles set
explicitly. Generation stays in exactly one place, so the two backends cannot drift, and no insert
path in either changes.

**The function must be verified empirically before anything depends on it.** The bit manipulation
that sets the version and variant nibbles is easy to get subtly wrong, and a wrong version nibble
yields ids that look like uuids, sort correctly, and are not v7. Verification asserts: the version
nibble is `7`, the variant bits are RFC-4122, values generated in sequence sort ascending, and
distinct calls in the same millisecond do not collide. This is a task with assertions, not an
assumption.

## Structure — one transaction, all nine tables

The original design phased this into three migrations. **That was wrong**, and the reason is worth
recording so it is not reintroduced: a foreign key requires matching column types, so converting
`stores.id` and `categories.id` forces `products.store_id`, `products.category_id` and
`store_categories.store_id` in the same transaction. Once `products` and `store_categories` are
being rewritten, converting their own primary keys is nearly free — which in turn forces
`products.store_category_id`, `order_items.product_id`, `product_views.product_id` and
`product_reviews.product_id`.

That is seven of nine tables in one connected component. Only `orders` (referenced by
`order_items.order_id`) and `platform_settings` sit outside it.

Phasing would therefore have delivered little: the first phase was already about 80% of the work,
and the intermediate state left `products` carrying a uuid foreign key alongside a bigint primary
key — a shape both backends would have to tolerate correctly, and the most error-prone option
available.

At **460 rows total** the entire migration runs in seconds. It ships as **one transaction covering
all nine tables**, plus `stores.user_id`, the backfill, and the seller auth switch. One rollback
point, no mixed-type intermediate state, and finding #0 closes with it.

## Schema

Row counts are small enough for the whole migration to be a single transaction: 36 stores, 105 products, 106
product_reviews, 97 product_views, 91 store_categories, 11 categories, 7 order_items, 5 orders,
2 platform_settings — **460 rows total**.

Pattern per table, illustrated with `stores`:

```sql
alter table public.stores rename column id to legacy_id;
alter table public.stores add column id uuid;           -- generation per the fork above
update public.stores set id = <v7>;
alter table public.stores alter column id set not null;
-- swap the primary key, rewire dependent foreign keys to the new uuid
alter table public.stores
  add column user_id uuid references auth.users(id) on delete set null;
create unique index stores_user_id_key on public.stores(user_id) where user_id is not null;
```

Three deliberate choices on `user_id`:

- **Nullable.** Eleven of 36 stores will not map (see *Backfill*). A `not null` column would make
  the migration impossible without inventing owners.
- **`on delete set null`, not `cascade`.** `DELETE /api/users/:id` is currently unauthenticated
  (finding #3, still open). Under `cascade`, any anonymous caller hitting that endpoint would
  destroy store rows and every product hanging off them. Under `set null` the store survives and
  becomes unowned. This choice can be revisited once #3 lands.
- **Unique, partial on non-null.** Today's lookup does `.limit(1)`, so "one store per seller" is
  already the de facto rule — merely unenforced, which is why the collisions in the audit went
  unnoticed. Enforcing it means a future collision fails at write time instead of silently handing
  someone the wrong dashboard. Reversible if multi-store sellers are ever wanted; the audit found
  nobody legitimately owning two.

`legacy_id` is retained on every migrated table, referenced by nothing. It makes rollback a primary
key swap rather than a restore, and lets the 44 ad-hoc scripts at `backend/` root keep working
through the transition. Dropping the `legacy_id` columns is a later cleanup, not part of this
project.

## Backfill

One-time, run once as part of the migration. The rule is **doubly unambiguous**: exactly one account matches the
store, and that account matches exactly one store.

```sql
update public.stores s
set user_id = u.id
from auth.users u
where replace(replace(split_part(u.email, '@', 1), '+', ''), ' ', '') = s.phone
  and s.user_id is null
  and (select count(*) from auth.users u2
       where replace(replace(split_part(u2.email,'@',1),'+',''),' ','') = s.phone) = 1
  and (select count(*) from public.stores s2
       where s2.phone = replace(replace(split_part(u.email,'@',1),'+',''),' ','')) = 1;
```

It replicates the `+`/whitespace stripping deliberately. This is the **last** use of that
heuristic — here it only interprets history, and never again authorizes a request.

**Run it as a `select` first** and record the affected row count and the list of stores left null,
before anything writes.

Expected from the audit: roughly 25 of 36 mapped, 11 left null.

### Accepted consequence

Stores that do not map get `user_id = null` and therefore **have no seller access at all** after
the migration. The audit identified these categories:

- Six `rejected` seed/test stores — no action needed.
- Two pairs where the same person holds both a legacy-domain and a current-domain account — the
  backfill's count check leaves these null rather than guessing.
- One store whose `phone` column contains a non-numeric string that multiple unrelated accounts
  derive to — genuinely ambiguous, deliberately left null.
- **Two approved, real stores** whose `phone` values (one containing an embedded space, one
  containing a WhatsApp URL) match no account.

The last group deserves emphasis: **those two sellers cannot log in today either.** Their phone
values do not match under Express's current substring lookup, so they are already locked out and
may not have reported it. The migration does not regress them; it makes an existing failure explicit.

## Assigning an owner to an unowned store

By **documented SQL runbook**, executed by the operator in the Supabase dashboard. Not an endpoint.

Building an "assign store to user" API before finding #3 (admin auth) exists would create an
unauthenticated endpoint that reassigns store ownership — a strictly worse vulnerability than the
one this project closes. When #3 lands, an admin UI can replace the runbook.

The runbook is a single statement with both ids supplied by the operator, plus a verification
`select` before and after. It is expected to be needed for approximately two stores initially.

## Code changes

### `backend/` (Express) — load-bearing, serves all traffic

- `src/middleware/auth.middleware.js`: seller lookup becomes `.eq('user_id', user.id)`. The
  `.ilike('phone', '%...%')` substring match is removed.
- `src/controllers/auth.controller.js`: `login` resolves the store the same way; `register` sets
  `user_id` from the created user's id on the store insert.
- `extractPhoneFromEmail` is **deleted**, not adapted. Removing it is the point of finding #0.
- Two `parseInt` id sites removed.

### `backend-nest/` (NestJS) — not deployed, changes are not yet load-bearing

- `src/auth/seller-auth.strategy.ts` resolves by `user_id`; `extract-phone-from-email.util.ts` and
  its spec are deleted.
- 19 `SpanishParseIntPipe` call sites across five controllers become a uuid-validating pipe (28
  total mentions, counting imports and the pipe's own definition). The Spanish error message is
  preserved — it exists because `ParseIntPipe`'s default message is English, and that reason does
  not change.
- 13 `BigInt` references removed, including the `BigInt.prototype.toJSON` shim in
  `src/common/bigint.ts` and the e2e test that pins it. That shim exists solely because Prisma maps
  `bigint` to JS `BigInt` and `JSON.stringify` throws on it; with uuid keys the problem disappears.
- Six `Number()` id coercions and four `String()` id comparisons removed.
- `prisma/schema.prisma` regenerated against the migrated database.

### Frontends — no code change required

`seller-frontend` holds `seller_store_id` and ten other id values in `localStorage`. These continue
to work unchanged: they hold a uuid string instead of an integer, and are passed through to the API
as opaque values. No parsing or arithmetic is performed on them.

The one hazard is **stale values from before the migration**, handled at cutover.

## Cutover

In a short maintenance window:

1. Full Supabase backup.
2. Dry run against a Supabase branch or restored copy; record row counts and FK integrity.
3. Apply the migration in a single transaction.
4. Post-migration verification script: row count per table matches pre-migration, every foreign key
   resolves, no orphans.
5. **Invalidate all Supabase auth sessions**, so every seller logs in fresh and
   receives the new uuid rather than carrying a stale integer in `localStorage`. With roughly 17
   accounts the support cost is negligible; the alternative is silent failures in sellers'
   browsers.
6. One real seller login, end to end, before reopening traffic.

## Rollback

Before commit: `rollback`. The whole migration is one transaction, so this is total.

After commit: swap the primary key back to `legacy_id`, which is retained precisely for this. The
application change is reverted alongside — the two must move together, since Express resolving by
`user_id` against a rolled-back schema would fail closed (403 for every seller) rather than
dangerously, but would still be an outage.

Full backup restore remains the last resort.

## Testing

**The honest constraint: there is no test database, and `backend-nest`'s 142 tests all mock
Prisma.** They would pass against a completely broken migration. Unit tests cannot verify this
work.

Verification is therefore:

- **Dry run** against a Supabase branch or a restored copy — the only step that exercises the real
  migration against real data.
- **Post-migration assertions** on row counts and referential integrity, scripted so they run
  identically in the dry run and in production.
- **One real login** before reopening traffic — the check that would have caught the
  `req.store` defect during the NestJS migration, and the one that matters most here.
- Existing unit and e2e suites still run, but as regression cover for the *code* changes (pipe
  swaps, removed coercions), not as evidence the migration worked.

## Risks

| Risk | Mitigation |
|---|---|
| The hand-written v7 function is subtly wrong (bad version nibble) | Verified empirically with assertions on version, variant, ordering and collisions before anything depends on it. |
| Project stalls after the migration, leaving a half-uuid schema | Survivable; two tables are already uuid. Decide up front to finish. |
| Two approved stores lose seller access | They are already locked out today. Runbook assigns owners. |
| A seller carries a stale integer id in `localStorage` | Sessions invalidated at cutover. |
| Migration breaks a foreign key silently | Post-migration integrity assertions, run in dry run first. |
| The 44 ad-hoc scripts at `backend/` root break | `legacy_id` retained; scripts are manual and not in any deploy path. |

## Decisions on record

- Combine finding #0 with the id migration rather than shipping #0 first.
- Migrate all nine tables in one transaction rather than phasing. The foreign-key graph made the
  phase split illusory (see *Structure*).
- Generate UUID v7 in the database via a plpgsql function, since the project is on PG 17.6 and
  native `uuidv7()` requires PG 18. Keeps generation single-sourced; no insert paths change.
- Fix in `backend/` first; `backend-nest/` follows and is not load-bearing until cutover.
- Backfill only doubly-unambiguous matches; leave the rest null rather than guessing an owner.
- Assign owners by SQL runbook, not an endpoint, until finding #3 exists.
- Retain `legacy_id` columns; drop them in a later cleanup.
- Force re-login at cutover rather than adding self-healing frontend code.

## Related

- `2026-08-24-security-hardening-scope.md` — findings #0–#4, and the production audit whose results
  this design depends on.
- `2026-08-23-backend-nestjs-prisma-migration-design.md` — the port whose schema this changes.
