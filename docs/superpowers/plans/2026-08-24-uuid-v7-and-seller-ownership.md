# UUID v7 Migration + Seller Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every integer primary and foreign key to UUID v7, and replace the email→store authorization heuristic with a real `stores.user_id` foreign key, closing security finding #0.

**Architecture:** One SQL transaction migrates all nine tables at once — the foreign-key graph makes phasing illusory (see the spec's *Structure* section). UUID v7 is generated database-side by a `plpgsql` function, because the project is on PostgreSQL 17.6 and native `uuidv7()` requires PG 18. Application changes follow in `backend/` (Express, serves all traffic) and `backend-nest/` (NestJS, deployed nowhere yet).

**Tech Stack:** PostgreSQL 17.6 on Supabase, `plpgsql`, Express + `@supabase/supabase-js`, NestJS + Prisma, Node 24, npm.

**Spec:** `docs/superpowers/specs/2026-08-24-uuid-v7-and-seller-ownership-design.md`

## Global Constraints

- **`backend/` serves 100% of production traffic. `backend-nest/` serves none.** Express changes are load-bearing; Nest changes are not, until a separate cutover.
- Both backends share **one** Supabase database, so the schema migrates once.
- **There is no test database, and `backend/` has no test runner** (`npm test` is `exit 1`). `backend-nest` has 142 tests but all mock Prisma — they pass against a broken migration. Verification is therefore: a dry run against a Supabase branch, scripted integrity assertions, and a real HTTP login check.
- **Never run the migration against production until the dry run has passed and been reviewed.** Task 12 is explicitly gated on human approval.
- All user-facing and API error strings are in Spanish, matching the rest of the repo.
- Never commit credentials. Scripts read `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`, which is gitignored.
- Row counts at time of writing: stores 36, products 105, product_reviews 106, product_views 97, store_categories 91, categories 11, order_items 7, orders 5, platform_settings 2 — **460 total**.

### Table inventory (exact)

**Get new uuid PKs (currently `bigint`):** `categories`, `stores`, `products`, `orders`, `order_items`, `platform_settings`, `store_categories`.

**Already uuid PKs (untouched):** `product_views`, `product_reviews`.

**The 8 foreign-key columns that must convert:**

| Table | Column | References |
|---|---|---|
| `products` | `category_id` | `categories.id` |
| `products` | `store_id` | `stores.id` |
| `products` | `store_category_id` | `store_categories.id` |
| `order_items` | `order_id` | `orders.id` |
| `order_items` | `product_id` | `products.id` |
| `product_views` | `product_id` | `products.id` |
| `product_reviews` | `product_id` | `products.id` |
| `store_categories` | `store_id` | `stores.id` |

---

## Task 1: UUID v7 generator, verified empirically

**Files:**
- Create: `backend/migrations/001_uuid_v7_function.sql`
- Create: `backend/migrations/verify_uuid_v7.mjs`

**Interfaces:**
- Produces: `public.uuid_generate_v7()` returning `uuid`. Every later task's `default` clauses and backfills call this.

The bit manipulation that sets the version and variant nibbles is easy to get subtly wrong, and a wrong version nibble produces values that look like uuids, sort correctly, and are **not** v7. This task exists to prove correctness before anything depends on it.

- [ ] **Step 1: Write the function**

Create `backend/migrations/001_uuid_v7_function.sql`:

```sql
-- UUID v7 (RFC 9562): 48-bit big-endian millisecond timestamp, then random.
-- PostgreSQL 18 ships uuidv7() natively; this project is on 17.6.
create or replace function public.uuid_generate_v7()
returns uuid
as $$
declare
  unix_ts_ms bytea;
  uuid_bytes bytea;
begin
  unix_ts_ms := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);

  -- random bytes for the remaining 10 octets
  uuid_bytes := uuid_send(gen_random_uuid());

  -- overlay the timestamp into octets 1-6
  uuid_bytes := overlay(uuid_bytes placing unix_ts_ms from 1 for 6);

  -- octet 7: set the high nibble to 0111 (version 7), keep the low nibble random
  uuid_bytes := set_byte(uuid_bytes, 6,
    (b'0111' || substring(get_byte(uuid_bytes, 6)::bit(8) from 5 for 4))::bit(8)::int);

  -- octet 9: set the two high bits to 10 (RFC 4122 variant), keep the rest random
  uuid_bytes := set_byte(uuid_bytes, 8,
    (b'10' || substring(get_byte(uuid_bytes, 8)::bit(8) from 3 for 6))::bit(8)::int);

  return encode(uuid_bytes, 'hex')::uuid;
end
$$ language plpgsql volatile;
```

- [ ] **Step 2: Apply it to a scratch/dry-run database, not production**

Run in the Supabase SQL editor **on a branch or restored copy**, never production at this stage.

- [ ] **Step 3: Write the verification script**

Create `backend/migrations/verify_uuid_v7.mjs`:

```javascript
// Asserts the generator actually produces RFC 9562 v7 values.
// Usage: node backend/migrations/verify_uuid_v7.mjs
// Requires an RPC wrapper; see Step 4 for how these values are obtained.
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

const ids = [];
for (let i = 0; i < 200; i++) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/uuid_generate_v7`, { method: 'POST', headers: H, body: '{}' });
  if (!r.ok) { console.error('RPC failed:', r.status, await r.text()); process.exit(1); }
  ids.push((await r.json()).replace(/"/g, ''));
}

let failures = 0;
const fail = (m) => { console.error('FAIL:', m); failures++; };

// 1. version nibble must be 7 (first hex char of the 3rd group)
for (const id of ids) {
  const version = id.split('-')[2][0];
  if (version !== '7') fail(`version nibble is ${version}, expected 7 (${id})`);
}

// 2. variant: first hex char of the 4th group must be 8, 9, a, or b
for (const id of ids) {
  const variant = id.split('-')[3][0].toLowerCase();
  if (!'89ab'.includes(variant)) fail(`variant nibble is ${variant}, expected 8/9/a/b (${id})`);
}

// 3. lexicographic order must match generation order (time-ordered property)
const sorted = [...ids].sort();
if (JSON.stringify(sorted) !== JSON.stringify(ids)) {
  fail('ids do not sort in generation order — the time prefix is wrong or not big-endian');
}

// 4. no collisions, including within the same millisecond
if (new Set(ids).size !== ids.length) fail(`collision: ${ids.length - new Set(ids).size} duplicate(s) in 200`);

// 5. the timestamp prefix must decode to approximately now
const ms = parseInt(ids[0].replace(/-/g, '').slice(0, 12), 16);
const drift = Math.abs(Date.now() - ms);
if (drift > 60000) fail(`timestamp prefix decodes to ${new Date(ms).toISOString()}, ${drift}ms from now`);

console.log(failures === 0
  ? `PASS: 200 ids, version 7, RFC variant, monotonic, no collisions, timestamp within ${drift}ms`
  : `${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 4: Expose the function to PostgREST so the script can call it**

PostgREST only exposes the `public` schema. The function is already in `public`, but PostgREST caches its schema — reload it:

```sql
notify pgrst, 'reload schema';
```

- [ ] **Step 5: Run the verification, confirm it passes**

Run: `node backend/migrations/verify_uuid_v7.mjs`
Expected: `PASS: 200 ids, version 7, RFC variant, monotonic, no collisions, timestamp within Nms`

**If any assertion fails, stop.** Do not proceed to Task 2 — every id in the database would inherit the defect.

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/001_uuid_v7_function.sql backend/migrations/verify_uuid_v7.mjs
git commit -m "Add verified UUID v7 generator for PG 17"
```

---

## Task 2: Pre/post integrity assertion script

**Files:**
- Create: `backend/migrations/verify_integrity.mjs`

**Interfaces:**
- Produces: a script runnable before and after the migration, printing a comparable report. Task 4 and Task 12 both depend on it.

This is the only automated check that the migration preserved the data. It must run identically against the dry-run copy and production.

- [ ] **Step 1: Write the script**

Create `backend/migrations/verify_integrity.mjs`:

```javascript
// Row counts and referential integrity, before and after migration.
// Usage: node backend/migrations/verify_integrity.mjs > before.txt
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

const TABLES = ['stores','products','orders','order_items','categories','store_categories','platform_settings','product_views','product_reviews'];

const count = async (t) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${t}?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return (r.headers.get('content-range') || '?/?').split('/')[1];
};

console.log('== row counts ==');
let total = 0;
for (const t of TABLES) {
  const c = await count(t);
  total += Number(c) || 0;
  console.log(`${t.padEnd(20)} ${c}`);
}
console.log(`${'TOTAL'.padEnd(20)} ${total}`);

// Referential integrity: every non-null FK must resolve to a parent row.
const CHECKS = [
  ['products',         'category_id',       'categories'],
  ['products',         'store_id',          'stores'],
  ['products',         'store_category_id', 'store_categories'],
  ['order_items',      'order_id',          'orders'],
  ['order_items',      'product_id',        'products'],
  ['product_views',    'product_id',        'products'],
  ['product_reviews',  'product_id',        'products'],
  ['store_categories', 'store_id',          'stores'],
];

console.log('\n== orphaned foreign keys (all must be 0) ==');
for (const [child, col, parent] of CHECKS) {
  const kids = await (await fetch(`${env.SUPABASE_URL}/rest/v1/${child}?select=${col}&${col}=not.is.null`, { headers: H })).json();
  const parents = new Set((await (await fetch(`${env.SUPABASE_URL}/rest/v1/${parent}?select=id`, { headers: H })).json()).map(r => String(r.id)));
  const orphans = kids.filter(k => !parents.has(String(k[col])));
  console.log(`${(child + '.' + col).padEnd(34)} ${orphans.length}`);
}

// Ownership, meaningful only after the migration adds the column.
const stores = await (await fetch(`${env.SUPABASE_URL}/rest/v1/stores?select=id,status,user_id`, { headers: H })).json();
if (stores.length && 'user_id' in stores[0]) {
  const owned = stores.filter(s => s.user_id).length;
  const unownedApproved = stores.filter(s => !s.user_id && s.status === 'approved').length;
  console.log(`\n== ownership ==\nstores with user_id: ${owned}/${stores.length}`);
  console.log(`APPROVED stores with NO owner (need the runbook): ${unownedApproved}`);
}
```

- [ ] **Step 2: Run it against production and save the baseline**

Run: `node backend/migrations/verify_integrity.mjs > /tmp/integrity-before.txt && cat /tmp/integrity-before.txt`
Expected: 460 total rows, every orphan count `0`. The ownership section is absent (no `user_id` column yet).

**If any orphan count is non-zero before the migration, stop and report it** — pre-existing broken references must be understood before a migration rewrites every key.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/verify_integrity.mjs
git commit -m "Add pre/post migration integrity assertions"
```

---

## Task 3: The migration SQL

**Files:**
- Create: `backend/migrations/002_uuid_v7_migration.sql`

**Interfaces:**
- Consumes: `public.uuid_generate_v7()` from Task 1.
- Produces: every table keyed by uuid; `stores.user_id`; `<table>.legacy_id` retained on the seven converted tables.

Written in this task, **executed only in Task 4 (dry run) and Task 12 (production)**.

- [ ] **Step 1: Write the migration**

Create `backend/migrations/002_uuid_v7_migration.sql`:

```sql
begin;

-- ---------------------------------------------------------------
-- A. new uuid primary keys on the seven bigint-keyed tables
-- ---------------------------------------------------------------
alter table public.categories        add column new_id uuid;
alter table public.stores            add column new_id uuid;
alter table public.products          add column new_id uuid;
alter table public.orders            add column new_id uuid;
alter table public.order_items       add column new_id uuid;
alter table public.platform_settings add column new_id uuid;
alter table public.store_categories  add column new_id uuid;

update public.categories        set new_id = public.uuid_generate_v7();
update public.stores            set new_id = public.uuid_generate_v7();
update public.products          set new_id = public.uuid_generate_v7();
update public.orders            set new_id = public.uuid_generate_v7();
update public.order_items       set new_id = public.uuid_generate_v7();
update public.platform_settings set new_id = public.uuid_generate_v7();
update public.store_categories  set new_id = public.uuid_generate_v7();

-- ---------------------------------------------------------------
-- B. new uuid foreign-key columns, populated by joining on the old ids
-- ---------------------------------------------------------------
alter table public.products          add column new_category_id       uuid;
alter table public.products          add column new_store_id          uuid;
alter table public.products          add column new_store_category_id uuid;
alter table public.order_items       add column new_order_id          uuid;
alter table public.order_items       add column new_product_id        uuid;
alter table public.product_views     add column new_product_id        uuid;
alter table public.product_reviews   add column new_product_id        uuid;
alter table public.store_categories  add column new_store_id          uuid;

update public.products p        set new_category_id       = c.new_id  from public.categories c        where p.category_id       = c.id;
update public.products p        set new_store_id          = s.new_id  from public.stores s            where p.store_id          = s.id;
update public.products p        set new_store_category_id = sc.new_id from public.store_categories sc where p.store_category_id = sc.id;
update public.order_items oi    set new_order_id          = o.new_id  from public.orders o            where oi.order_id         = o.id;
update public.order_items oi    set new_product_id        = p.new_id  from public.products p          where oi.product_id       = p.id;
update public.product_views pv  set new_product_id        = p.new_id  from public.products p          where pv.product_id       = p.id;
update public.product_reviews pr set new_product_id       = p.new_id  from public.products p          where pr.product_id       = p.id;
update public.store_categories sc set new_store_id        = s.new_id  from public.stores s            where sc.store_id         = s.id;

-- Guard: a non-null old FK that produced a null new FK means a pre-existing
-- orphan. Fail loudly rather than silently dropping the reference.
do $$
declare bad int;
begin
  select count(*) into bad from public.products        where category_id       is not null and new_category_id       is null;
  if bad > 0 then raise exception 'products.category_id: % orphaned', bad; end if;
  select count(*) into bad from public.products        where store_id          is not null and new_store_id          is null;
  if bad > 0 then raise exception 'products.store_id: % orphaned', bad; end if;
  select count(*) into bad from public.products        where store_category_id is not null and new_store_category_id is null;
  if bad > 0 then raise exception 'products.store_category_id: % orphaned', bad; end if;
  select count(*) into bad from public.order_items     where order_id          is not null and new_order_id          is null;
  if bad > 0 then raise exception 'order_items.order_id: % orphaned', bad; end if;
  select count(*) into bad from public.order_items     where product_id        is not null and new_product_id        is null;
  if bad > 0 then raise exception 'order_items.product_id: % orphaned', bad; end if;
  select count(*) into bad from public.product_views   where product_id        is not null and new_product_id        is null;
  if bad > 0 then raise exception 'product_views.product_id: % orphaned', bad; end if;
  select count(*) into bad from public.product_reviews where product_id        is not null and new_product_id        is null;
  if bad > 0 then raise exception 'product_reviews.product_id: % orphaned', bad; end if;
  select count(*) into bad from public.store_categories where store_id         is not null and new_store_id          is null;
  if bad > 0 then raise exception 'store_categories.store_id: % orphaned', bad; end if;
end $$;

-- ---------------------------------------------------------------
-- C. drop old foreign-key and primary-key constraints
--    Names are discovered rather than assumed, because they were created
--    by Supabase's UI and by ad-hoc SQL over time.
-- ---------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype in ('f','p')
      and connamespace = 'public'::regnamespace
      and conrelid::regclass::text in
        ('categories','stores','products','orders','order_items',
         'platform_settings','store_categories','product_views','product_reviews')
  loop
    execute format('alter table %s drop constraint %I cascade', r.tbl, r.conname);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- D. swap columns: old -> legacy_*, new -> canonical
-- ---------------------------------------------------------------
alter table public.categories        rename column id to legacy_id;
alter table public.stores            rename column id to legacy_id;
alter table public.products          rename column id to legacy_id;
alter table public.orders            rename column id to legacy_id;
alter table public.order_items       rename column id to legacy_id;
alter table public.platform_settings rename column id to legacy_id;
alter table public.store_categories  rename column id to legacy_id;

alter table public.categories        rename column new_id to id;
alter table public.stores            rename column new_id to id;
alter table public.products          rename column new_id to id;
alter table public.orders            rename column new_id to id;
alter table public.order_items       rename column new_id to id;
alter table public.platform_settings rename column new_id to id;
alter table public.store_categories  rename column new_id to id;

alter table public.products         rename column category_id       to legacy_category_id;
alter table public.products         rename column store_id          to legacy_store_id;
alter table public.products         rename column store_category_id to legacy_store_category_id;
alter table public.order_items      rename column order_id          to legacy_order_id;
alter table public.order_items      rename column product_id        to legacy_product_id;
alter table public.product_views    rename column product_id        to legacy_product_id;
alter table public.product_reviews  rename column product_id        to legacy_product_id;
alter table public.store_categories rename column store_id          to legacy_store_id;

alter table public.products         rename column new_category_id       to category_id;
alter table public.products         rename column new_store_id          to store_id;
alter table public.products         rename column new_store_category_id to store_category_id;
alter table public.order_items      rename column new_order_id          to order_id;
alter table public.order_items      rename column new_product_id        to product_id;
alter table public.product_views    rename column new_product_id        to product_id;
alter table public.product_reviews  rename column new_product_id        to product_id;
alter table public.store_categories rename column new_store_id          to store_id;

-- ---------------------------------------------------------------
-- E. re-establish keys, defaults and constraints
-- ---------------------------------------------------------------
alter table public.categories        alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);
alter table public.stores            alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);
alter table public.products          alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);
alter table public.orders            alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);
alter table public.order_items       alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);
alter table public.platform_settings alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);
alter table public.store_categories  alter column id set not null, alter column id set default public.uuid_generate_v7(), add primary key (id);

-- product_views / product_reviews keep their existing uuid primary keys;
-- section C dropped them, so restore.
alter table public.product_views   add primary key (id);
alter table public.product_reviews add primary key (id);

alter table public.products         add constraint products_category_id_fkey       foreign key (category_id)       references public.categories(id);
alter table public.products         add constraint products_store_id_fkey          foreign key (store_id)          references public.stores(id);
alter table public.products         add constraint products_store_category_id_fkey foreign key (store_category_id) references public.store_categories(id);
alter table public.order_items      add constraint order_items_order_id_fkey       foreign key (order_id)          references public.orders(id);
alter table public.order_items      add constraint order_items_product_id_fkey     foreign key (product_id)        references public.products(id);
alter table public.product_views    add constraint product_views_product_id_fkey   foreign key (product_id)        references public.products(id);
alter table public.product_reviews  add constraint product_reviews_product_id_fkey foreign key (product_id)        references public.products(id);
alter table public.store_categories add constraint store_categories_store_id_fkey  foreign key (store_id)          references public.stores(id);

-- unique constraints dropped by the cascade in section C
alter table public.stores add constraint stores_slug_key         unique (slug);
alter table public.stores add constraint stores_store_number_key unique (store_number);

-- ---------------------------------------------------------------
-- F. seller ownership (security finding #0)
-- ---------------------------------------------------------------
alter table public.stores
  add column user_id uuid references auth.users(id) on delete set null;

-- A plain UNIQUE is correct here: Postgres treats NULLs as distinct, so
-- unlimited unowned stores are allowed. A partial index would add nothing
-- and Prisma cannot introspect one as @unique, which findUnique requires.
alter table public.stores add constraint stores_user_id_key unique (user_id);

-- Backfill: only doubly-unambiguous matches. This is the LAST use of the
-- email local-part heuristic; here it interprets history, never authorizes.
update public.stores s
set user_id = u.id
from auth.users u
where replace(replace(split_part(u.email, '@', 1), '+', ''), ' ', '') = s.phone
  and s.user_id is null
  and (select count(*) from auth.users u2
       where replace(replace(split_part(u2.email,'@',1),'+',''),' ','') = s.phone) = 1
  and (select count(*) from public.stores s2
       where s2.phone = replace(replace(split_part(u.email,'@',1),'+',''),' ','')) = 1;

-- ---------------------------------------------------------------
-- G. indexes on the new foreign keys
-- ---------------------------------------------------------------
create index products_store_id_idx          on public.products(store_id);
create index products_category_id_idx       on public.products(category_id);
create index products_store_category_id_idx on public.products(store_category_id);
create index order_items_order_id_idx       on public.order_items(order_id);
create index order_items_product_id_idx     on public.order_items(product_id);
create index product_views_product_id_idx   on public.product_views(product_id);
create index product_reviews_product_id_idx on public.product_reviews(product_id);
create index store_categories_store_id_idx  on public.store_categories(store_id);

commit;
```

- [ ] **Step 2: Do NOT run it. Commit only.**

```bash
git add backend/migrations/002_uuid_v7_migration.sql
git commit -m "Add UUID v7 migration SQL (not yet executed)"
```

---

## Task 4: Dry run

**Files:** none created — this task executes Tasks 1-3 against a copy.

**Interfaces:**
- Consumes: all three migration files.
- Produces: a pass/fail verdict that gates Task 12.

- [ ] **Step 1: Create a Supabase branch or restore a backup into a scratch project**

Supabase Dashboard → Branches (or restore the latest backup into a new project). Note its URL and service-role key.

- [ ] **Step 2: Capture the baseline**

Point `backend/.env` at the copy (or export overrides) and run:

Run: `node backend/migrations/verify_integrity.mjs > /tmp/dry-before.txt`
Expected: identical row counts to production's baseline from Task 2; all orphan counts `0`.

- [ ] **Step 3: Apply Task 1's function, then Task 3's migration**

Run both SQL files in the copy's SQL editor, in order.
Expected: `COMMIT` with no exception. A raised exception from the section-B guard means a pre-existing orphan — stop and report which.

- [ ] **Step 4: Run the verification suite**

Run: `node backend/migrations/verify_uuid_v7.mjs && node backend/migrations/verify_integrity.mjs > /tmp/dry-after.txt && diff /tmp/dry-before.txt /tmp/dry-after.txt`
Expected: uuid verification PASS; the only diff is the added ownership section. **Every row count must be identical and every orphan count must still be 0.**

- [ ] **Step 5: Record how many stores got an owner**

From the ownership section: note `stores with user_id: N/36` and `APPROVED stores with NO owner`.
Expected from the audit: roughly 25 owned, and **2 approved stores unowned**.

Report both numbers. They are the input to the runbook in Task 11.

- [ ] **Step 6: Report the dry run, do not proceed to production**

Summarize: commit succeeded, counts matched, orphans zero, ownership numbers. Task 12 is gated on a human reading this.

---

## Task 5: Express — resolve the seller's store by `user_id`

**Files:**
- Modify: `backend/src/middleware/auth.middleware.js`
- Modify: `backend/src/controllers/auth.controller.js`

**Interfaces:**
- Consumes: `stores.user_id` from Task 3.
- Produces: `req.store` resolved from the authenticated user's id. `extractPhoneFromEmail` no longer exists anywhere in `backend/`.

This is the change that closes finding #0. It is load-bearing — `backend/` serves all traffic.

- [ ] **Step 1: Replace the middleware's store lookup**

In `backend/src/middleware/auth.middleware.js`, delete the `extractPhoneFromEmail` function entirely and replace the lookup:

```javascript
    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!store) {
      return res.status(403).json({ error: 'No se encontró una tienda asociada a este usuario' });
    }
```

`maybeSingle()` rather than `.limit(1).single()`: the unique index guarantees at most one row, and `maybeSingle` returns null instead of erroring on zero.

- [ ] **Step 2: Replace `login`'s store lookup**

In `backend/src/controllers/auth.controller.js`, in `login`, delete the `phoneMatch` derivation and replace the store query:

```javascript
    let store = null;
    try {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle();
      store = storeData;
    } catch (err) {
      console.error('No store found for user', data.user.id);
    }
```

- [ ] **Step 3: Set `user_id` when registration creates the store**

In `backend/src/controllers/auth.controller.js`, in `register`, add `user_id` to the store payload so new stores are owned from birth:

```javascript
      const storeData = {
        user_id: data.user.id,
        // ... existing fields unchanged
      };
```

- [ ] **Step 4: Confirm the heuristic is gone**

Run: `grep -rn "extractPhoneFromEmail\|split('@')\[0\]" backend/src`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.middleware.js backend/src/controllers/auth.controller.js
git commit -m "Resolve seller store by user_id, closing finding #0"
```

---

## Task 5b: Express — integer id assumptions that break silently under uuid

**Files:**
- Modify: `backend/src/controllers/store.controller.js:74-82`
- Modify: `backend/src/controllers/order.controller.js:9-11`

**Interfaces:**
- Produces: `GET /api/stores/:id` resolving by uuid or slug; `GET /api/orders?ids=` accepting uuid lists.

Both sites fail **silently** rather than erroring, which is why they need their own task rather than a footnote.

- [ ] **Step 1: Fix the id-vs-slug branch in `getStoreById`**

`store.controller.js:75` decides between id and slug lookup with `/^\d+$/.test(id)`. A uuid is not numeric, so every `GET /api/stores/<uuid>` would fall through to the slug branch and return 404. Replace the detection:

```javascript
    const { id } = req.params;

    // uuid -> primary key, anything else -> slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase.from('stores').select('*');
    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }
```

- [ ] **Step 2: Fix the `ids` list parsing in `getOrders`**

`order.controller.js:10` does `ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))`. This is worse than it looks: `parseInt('018f3a4b-1c2d-...', 10)` returns **`18`**, not `NaN`, so the `isNaN` filter does not catch it and the query silently matches nothing. Replace with:

```javascript
    if (ids) {
      orderIds = ids
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    }
```

- [ ] **Step 3: Confirm no integer-id assumptions remain**

Run: `grep -rnE "parseInt|\^\\\\d\+\$" backend/src`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/store.controller.js backend/src/controllers/order.controller.js
git commit -m "Express: accept uuid ids in store lookup and order id lists"
```

---

## Task 6: Express — auth smoke check

**Files:**
- Create: `backend/migrations/smoke_auth.mjs`

**Interfaces:**
- Consumes: a running Express server and a real seller credential.
- Produces: the only end-to-end verification of Task 5, since `backend/` has no test runner.

`backend`'s `npm test` is `exit 1`. Rather than introduce a test framework mid-migration, this is a dependency-free script that exercises the real HTTP path.

- [ ] **Step 1: Write the script**

Create `backend/migrations/smoke_auth.mjs`:

```javascript
// End-to-end auth check. Usage:
//   BASE=http://localhost:5001 EMAIL=... PASSWORD=... node backend/migrations/smoke_auth.mjs
const BASE = process.env.BASE || 'http://localhost:5001';
const { EMAIL, PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) { console.error('set EMAIL and PASSWORD'); process.exit(1); }

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const body = await login.json();
check(login.status === 200, `login returns 200 (got ${login.status})`);
check(!!body.session?.access_token, 'login returns a session token');
check(!!body.store, 'login resolves a store');
check(body.store?.user_id != null, 'the resolved store has user_id set');

const token = body.session?.access_token;

// a guarded route must accept the token and resolve the same store
const guarded = await fetch(`${BASE}/api/stores/${body.store?.id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
check(guarded.status === 200, `guarded store read returns 200 (got ${guarded.status})`);

// no token must be rejected, not silently allowed
const noAuth = await fetch(`${BASE}/api/auth/delete`, { method: 'POST' });
check(noAuth.status === 401, `unauthenticated guarded route returns 401 (got ${noAuth.status})`);

console.log(failures === 0 ? '\nPASS' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it against the dry-run database with a real seller credential**

Start Express pointed at the dry-run copy, then run the script with a seller account that the backfill mapped.
Expected: `PASS`, with `the resolved store has user_id set` passing — that is the assertion proving the new path works.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/smoke_auth.mjs
git commit -m "Add dependency-free auth smoke check for the Express backend"
```

---

## Task 7: NestJS — resolve by `user_id`, delete the heuristic

**Files:**
- Modify: `backend-nest/src/auth/seller-auth.strategy.ts`
- Modify: `backend-nest/src/auth/seller-auth.strategy.spec.ts`
- Modify: `backend-nest/src/auth/auth.service.ts`
- Modify: `backend-nest/src/auth/auth.service.spec.ts`
- Delete: `backend-nest/src/auth/extract-phone-from-email.util.ts`
- Delete: `backend-nest/src/auth/extract-phone-from-email.util.spec.ts`

**Interfaces:**
- Produces: `SellerAuthStrategy.validate` resolving `store` via `prisma.store.findUnique({ where: { user_id } })`.

- [ ] **Step 1: Update the strategy spec first (TDD)**

In `backend-nest/src/auth/seller-auth.strategy.spec.ts`, replace the phone-based assertions. The existing regression test asserting `findFirst` was called with `{ where: { phone: '1234' } }` is now obsolete — replace it with:

```typescript
  it('resolves the store by the authenticated user id, never by the email', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const findUnique = jest.fn().mockResolvedValue({ id: 's1', user_id: 'u1' });
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      findUnique,
    );

    const result = await strategy.validate('valid-token');

    expect(findUnique).toHaveBeenCalledWith({ where: { user_id: 'u1' } });
    expect(result.store.id).toBe('s1');
  });
```

Update `makeStrategy` so its Prisma stub exposes `store.findUnique` instead of `store.findFirst`.

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- seller-auth.strategy.spec.ts`
Expected: FAIL — the strategy still calls `findFirst` with a phone.

- [ ] **Step 3: Implement**

In `seller-auth.strategy.ts`, delete the `extractPhoneFromEmail` import and its use:

```typescript
    const store = await this.prisma.store.findUnique({
      where: { user_id: user.id },
    });

    if (!store) {
      throw new ForbiddenException(
        'No se encontró una tienda asociada a este usuario',
      );
    }
```

- [ ] **Step 4: Do the same in `AuthService`**

`login` resolves by `user_id`; `register` sets `user_id: data.user.id` on the `store.create` payload. Update `auth.service.spec.ts` to match — the existing tests assert on `storeCreate.mock.calls[0][0].data`, so add `user_id` to the expected object.

- [ ] **Step 5: Delete the util and its spec**

```bash
git rm backend-nest/src/auth/extract-phone-from-email.util.ts backend-nest/src/auth/extract-phone-from-email.util.spec.ts
```

- [ ] **Step 6: Run the full suite**

Run: `cd backend-nest && env -u DATABASE_URL npm test`
Expected: all suites pass. Two fewer than the previous 20 suites, since the util's spec is gone.

- [ ] **Step 7: Commit**

```bash
git add -A backend-nest/src/auth
git commit -m "NestJS: resolve seller store by user_id, delete the email heuristic"
```

---

## Task 8: NestJS — uuid route parameters

**Files:**
- Create: `backend-nest/src/common/spanish-parse-uuid.pipe.ts`
- Create: `backend-nest/src/common/spanish-parse-uuid.pipe.spec.ts`
- Modify: `backend-nest/src/stores/stores.controller.ts`, `store-categories.controller.ts`, `products/products.controller.ts`, `orders/orders.controller.ts`
- Delete: `backend-nest/src/common/spanish-parse-int.pipe.ts` and its spec

**Interfaces:**
- Produces: `SpanishParseUuidPipe`, replacing `SpanishParseIntPipe` at all 19 call sites.

The Spanish message exists because Nest's default pipe message is English; that reason is unchanged.

- [ ] **Step 1: Write the spec first**

Create `backend-nest/src/common/spanish-parse-uuid.pipe.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { SpanishParseUuidPipe } from './spanish-parse-uuid.pipe';

describe('SpanishParseUuidPipe', () => {
  const pipe = new SpanishParseUuidPipe();

  it('passes a valid uuid through unchanged', () => {
    const id = '018f3a4b-1c2d-7e3f-8a9b-0c1d2e3f4a5b';
    expect(pipe.transform(id)).toBe(id);
  });

  it('rejects a non-uuid with a Spanish message', () => {
    expect(() => pipe.transform('abc')).toThrow(BadRequestException);
    try {
      pipe.transform('abc');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toMatchObject({
        message: 'El identificador debe ser un UUID válido',
      });
    }
  });

  it('rejects an integer id, which is what the old routes accepted', () => {
    expect(() => pipe.transform('42')).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- spanish-parse-uuid.pipe.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `backend-nest/src/common/spanish-parse-uuid.pipe.ts`:

```typescript
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SpanishParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) {
      throw new BadRequestException('El identificador debe ser un UUID válido');
    }
    return value;
  }
}
```

- [ ] **Step 4: Swap all 19 call sites**

Run: `grep -rn "SpanishParseIntPipe" backend-nest/src` to list them, then replace each `SpanishParseIntPipe` with `SpanishParseUuidPipe` and update the imports. Controller signatures change from `id: number` to `id: string`.

- [ ] **Step 5: Delete the old pipe**

```bash
git rm backend-nest/src/common/spanish-parse-int.pipe.ts backend-nest/src/common/spanish-parse-int.pipe.spec.ts
```

- [ ] **Step 6: Run the full suite and the type check**

Run: `cd backend-nest && env -u DATABASE_URL npm test && npx tsc --noEmit`
Expected: all pass. `tsc` is the real gate here — it catches every `number`-typed id signature the swap missed.

- [ ] **Step 7: Commit**

```bash
git add -A backend-nest/src
git commit -m "NestJS: validate route ids as uuids"
```

---

## Task 9: NestJS — remove BigInt and integer-id machinery

**Files:**
- Delete: `backend-nest/src/common/bigint.ts`
- Modify: `backend-nest/src/app.module.ts`, `backend-nest/test/products.e2e-spec.ts`
- Modify: the services holding `Number()` id coercions and `String()` id comparisons

**Interfaces:**
- Produces: no `BigInt` handling anywhere. Ids are strings end to end.

The `BigInt.prototype.toJSON` shim exists solely because Prisma maps `bigint` to JS `BigInt` and `JSON.stringify` throws on it. With uuid keys the problem is gone.

- [ ] **Step 1: Find every site**

Run: `grep -rn "BigInt\|Number(query\.\|Number(dto\.\|String(dto\.\|String(req\." backend-nest/src backend-nest/test`
Expected: 13 `BigInt` references plus the coercion sites.

- [ ] **Step 2: Remove the shim and its import**

Delete `src/common/bigint.ts`; remove its import from `src/app.module.ts`; remove the `BigInt(1)` e2e assertion in `test/products.e2e-spec.ts` that pins it.

- [ ] **Step 3: Remove id coercions**

In `products.service.ts`, `where.store_id = Number(query.storeId)` becomes `where.store_id = query.storeId`. Same for `category` and `store_category_id`. In `orders.service.ts`, the `Number(item.product?.store_id)` comparisons become direct string comparisons. In `products.service.ts` the `String(dto.store_id) !== String(callerStore.id)` ownership check can stay — both sides are already strings, and leaving it is harmless — but simplify it to `dto.store_id !== callerStore.id`.

- [ ] **Step 4: Run the full suite and type check**

Run: `cd backend-nest && env -u DATABASE_URL npm test && env -u DATABASE_URL npm run test:e2e && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A backend-nest
git commit -m "NestJS: drop BigInt shim and integer id coercions"
```

---

## Task 10: NestJS — regenerate the Prisma schema

**Files:**
- Modify: `backend-nest/prisma/schema.prisma`

**Interfaces:**
- Produces: a schema whose types match the migrated database.

- [ ] **Step 1: Introspect the dry-run database**

With `DATABASE_URL` pointed at the dry-run copy:

Run: `cd backend-nest && npx prisma db pull`
Expected: every `id BigInt @id @default(autoincrement())` becomes `id String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid`, every FK becomes `String? @db.Uuid`, and `stores` gains `user_id String? @db.Uuid` plus `legacy_id` columns.

- [ ] **Step 2: Confirm the model names survived introspection**

`prisma db pull` renames models from table names. Check that `Category`, `Store`, `Product`, `Order`, `OrderItem`, `PlatformSetting`, `StoreCategory`, `ProductView`, `ProductReview` and their `@@map` directives are intact; restore them if introspection flattened them.

- [ ] **Step 3: Generate and type check**

Run: `cd backend-nest && npx prisma generate && npx tsc --noEmit`
Expected: clean. Any error here is a real type mismatch between the code and the migrated schema.

- [ ] **Step 4: Run everything**

Run: `cd backend-nest && env -u DATABASE_URL npm test && env -u DATABASE_URL npm run test:e2e`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend-nest/prisma/schema.prisma
git commit -m "NestJS: regenerate Prisma schema against the uuid database"
```

---

## Task 11: Owner-assignment runbook

**Files:**
- Create: `docs/runbooks/assign-store-owner.md`

**Interfaces:**
- Consumes: the unowned-store list from Task 4 Step 5.
- Produces: the documented procedure replacing an admin endpoint until finding #3 lands.

An "assign store to user" API built now, before admin auth exists, would be an unauthenticated total-compromise endpoint. This is deliberately manual.

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/assign-store-owner.md`:

````markdown
# Assign an owner to a store

Used when a store has `user_id IS NULL` and a seller needs access. Run in the
Supabase SQL editor. This is deliberately manual: an unauthenticated
assign-ownership endpoint would be worse than the vulnerability it replaces.
Replace with an admin UI once security finding #3 (admin auth) ships.

## 1. Find the store

```sql
select id, name, phone, status, user_id
from public.stores
where user_id is null
order by status, name;
```

## 2. Find the account

```sql
select id, email, created_at, last_sign_in_at
from auth.users
where email ilike '%<fragment>%'
order by created_at;
```

## 3. Verify before writing

Confirm with the seller, out of band, that the email is theirs. The phone
column is NOT proof of ownership — trusting it is exactly the vulnerability
this migration removed.

## 4. Assign

```sql
update public.stores
set user_id = '<auth-user-uuid>'
where id = '<store-uuid>' and user_id is null;
```

The `and user_id is null` guard prevents silently reassigning an owned store.
Expect `UPDATE 1`. `UPDATE 0` means it already has an owner — stop and
investigate.

## 5. Confirm

```sql
select s.id, s.name, s.user_id, u.email
from public.stores s join auth.users u on u.id = s.user_id
where s.id = '<store-uuid>';
```

Then have the seller log in. The unique index on `user_id` means one account
owns at most one store; assigning a user who already owns another store fails
with a constraint violation rather than corrupting either.
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/assign-store-owner.md
git commit -m "Add store owner assignment runbook"
```

---

## Task 12: Production cutover — GATED

**Files:** none.

**Interfaces:**
- Consumes: a passing dry run from Task 4 and merged code from Tasks 5-10.

> **STOP. Do not begin this task autonomously.** It mutates production data
> irreversibly-in-practice and takes the storefront down briefly. It requires
> explicit human approval immediately beforehand, and a human present
> throughout.

- [ ] **Step 1: Confirm the gate**

Confirm with the human: dry run passed, counts matched, orphans zero, ownership numbers reviewed, code merged, maintenance window agreed.

- [ ] **Step 2: Full backup**

Supabase Dashboard → Database → Backups → take an on-demand backup. Record its identifier.

- [ ] **Step 3: Baseline**

Run: `node backend/migrations/verify_integrity.mjs > /tmp/prod-before.txt`

- [ ] **Step 4: Apply**

Run `001_uuid_v7_function.sql` then `002_uuid_v7_migration.sql` in the production SQL editor.
Expected: `COMMIT`. Any exception rolls the whole transaction back — the database is unchanged and the migration can be fixed and retried.

- [ ] **Step 5: Verify**

Run: `node backend/migrations/verify_uuid_v7.mjs && node backend/migrations/verify_integrity.mjs > /tmp/prod-after.txt && diff /tmp/prod-before.txt /tmp/prod-after.txt`
Expected: identical row counts, zero orphans, ownership section added.

- [ ] **Step 6: Deploy the Express changes**

Deploy `backend/` with Tasks 5-6 merged. The schema and the code must move together — Express resolving by `user_id` against an unmigrated database fails closed (403 for every seller), which is safe but is an outage.

- [ ] **Step 7: Invalidate all sessions**

Sign out all users, so nobody carries a stale integer `seller_store_id` in `localStorage`. With ~17 accounts the support cost is negligible; the alternative is silent failures in sellers' browsers.

- [ ] **Step 8: Smoke test**

Run: `BASE=<production-url> EMAIL=<seller> PASSWORD=<seller> node backend/migrations/smoke_auth.mjs`
Expected: `PASS`, including `the resolved store has user_id set`.

Also load the public storefront and one store page — those paths are unauthenticated and exercise the new uuid keys end to end.

- [ ] **Step 9: Assign owners to the unowned approved stores**

Follow `docs/runbooks/assign-store-owner.md` for the approved stores the backfill left null (expected: 2). Contact those sellers first — they cannot log in today either, so this is a fix, not a regression.

- [ ] **Step 10: Reopen traffic and record the outcome**

Append the result to the ledger: rows migrated, stores owned, stores left unowned, and anything that surprised you.

---

## Rollback

Within the transaction: any exception rolls everything back automatically; the database is untouched.

After commit: the `legacy_id` and `legacy_*_id` columns are retained precisely for this. Reverting means swapping the primary keys back to `legacy_id`, restoring the old foreign keys from the `legacy_*_id` columns, and redeploying the previous `backend/` build. Code and schema must revert together.

If that fails, restore the Task 12 Step 2 backup.

## What this plan does NOT cover

Security findings #1 (order price tampering), #2 (orders IDOR), #3 (admin auth) and #4 (pending stores in public listings), all described in `docs/superpowers/specs/2026-08-24-security-hardening-scope.md`. Dropping the `legacy_*` columns is also deliberately excluded — that is a later cleanup once the migration has proven itself.
