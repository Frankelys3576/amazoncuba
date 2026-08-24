// Row counts and referential integrity, before and after migration.
// This is the only automated check that the migration preserved the data:
// run it once against production before the migration and once after, then
// diff the two outputs.
// Usage: node backend/migrations/verify_integrity.mjs > before.txt
//
// Read-only: only ever issues GET requests via PostgREST. Never run this
// against production expecting it to write, create, or execute SQL — it
// doesn't.
//
// Three things are checked: row counts, orphaned foreign keys, and (after the
// migration, using the retained legacy_* columns) mis-mapped foreign keys —
// a child row that resolves to a valid but WRONG parent, which no orphan
// check can see.
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

let failures = 0;
const fail = (m) => { console.error('FAIL:', m); failures++; };

// PostgREST caps a response at its configured max-rows (1000 by default) and
// signals the true total via the Content-Range response header
// ("start-end/total"). Every table here is currently far below that cap, but
// if a select ever did get truncated, the orphan checks below would compare
// child rows against an INCOMPLETE parent-id set and report false orphans —
// noise that could halt a migration for no real reason. fetchAll() pages
// through Range until it has collected as many rows as Content-Range says
// exist, so a truncated single response can never masquerade as the full
// table.
//
// Return value contract (callers must check for both sentinels):
//   - array   -> success, full row set.
//   - null    -> a genuine failure (bad HTTP status, or the paged fetch
//                couldn't reconcile against Content-Range's reported total).
//                fail() has already been called; callers must NOT print a
//                numeric count derived from this — that would silently
//                misrepresent a failure as data in the before/after diff.
//   - undefined -> the request failed with an error code the caller opted
//                into tolerating via `tolerateErrorCodes` (e.g. '42703'
//                undefined column, before the migration adds it). This is
//                an *expected* absence, not a failure — no fail() call.
async function fetchAll(path, { tolerateErrorCodes = [] } = {}) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...H, Prefer: 'count=exact', Range: `${offset}-${offset + pageSize - 1}` },
    });
    if (!r.ok) {
      const body = await r.text();
      let code;
      try { code = JSON.parse(body).code; } catch { /* not JSON */ }
      if (tolerateErrorCodes.includes(code)) return undefined;
      fail(`GET ${path} -> ${r.status} ${body}`);
      return null;
    }
    const batch = await r.json();
    rows.push(...batch);
    const range = r.headers.get('content-range') || '';
    const total = range.includes('/') ? Number(range.split('/')[1]) : rows.length;
    if (batch.length === 0 || rows.length >= total) {
      if (Number.isFinite(total) && rows.length !== total) {
        fail(`${path} returned ${rows.length} rows but Content-Range reported total ${total}`);
        return null;
      }
      return rows;
    }
    offset += pageSize;
  }
}

// Same success/failure contract as fetchAll: returns the count as a string
// on success, or null on a genuine failure (bad HTTP status, or a missing/
// unparseable Content-Range header) after calling fail(). Never returns a
// value that looks like a count but isn't — a failed count silently folded
// into TOTAL, or printed as "0"/"?" without failing the run, would let the
// script print PASS while a real problem (e.g. an RLS change, an outage,
// an auth failure) went unnoticed.
const count = async (t) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${t}?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) {
    fail(`GET ${t}?select=id (count) -> ${r.status} ${await r.text()}`);
    return null;
  }
  const range = r.headers.get('content-range');
  if (!range || !range.includes('/')) {
    fail(`GET ${t}?select=id (count) -> missing/unparseable Content-Range header: ${JSON.stringify(range)}`);
    return null;
  }
  return range.split('/')[1];
};

const TABLES = ['stores', 'products', 'orders', 'order_items', 'categories', 'store_categories', 'platform_settings', 'product_views', 'product_reviews'];

console.log('== row counts ==');
let total = 0;
for (const t of TABLES) {
  const c = await count(t);
  console.log(`${t.padEnd(20)} ${c === null ? 'ERROR' : c}`);
  if (c !== null) total += Number(c) || 0;
}
console.log(`${'TOTAL'.padEnd(20)} ${total}`);

// Referential integrity: every non-null FK must resolve to a parent row.
// ids are integers before the migration and uuid strings after — String(...)
// on both sides of the comparison keeps this check meaningful across both
// runs instead of silently comparing "1" (number) to 1 (number) pre-migration
// and then failing to match types post-migration, or vice versa.
const CHECKS = [
  ['products', 'category_id', 'categories'],
  ['products', 'store_id', 'stores'],
  ['products', 'store_category_id', 'store_categories'],
  ['order_items', 'order_id', 'orders'],
  ['order_items', 'product_id', 'products'],
  ['product_views', 'product_id', 'products'],
  ['product_reviews', 'product_id', 'products'],
  ['store_categories', 'store_id', 'stores'],
];

console.log('\n== orphaned foreign keys (all must be 0) ==');
let orphanTotal = 0;
for (const [child, col, parent] of CHECKS) {
  const kids = await fetchAll(`${child}?select=${col}&${col}=not.is.null`);
  const parentRows = await fetchAll(`${parent}?select=id`);
  const label = (child + '.' + col).padEnd(34);
  // A failed child or parent fetch already called fail() inside fetchAll.
  // Printing a numeric count here would be actively misleading: "0" reads as
  // "no orphans" when it may mean "the child fetch failed", and an empty
  // parent set (from a failed parent fetch) would make every real child id
  // look orphaned. The before/after diff is the primary way a human judges
  // whether this migration preserved data, so a wrong number here is worse
  // than an admittedly ugly one.
  if (kids === null || parentRows === null) {
    console.log(`${label} ERROR`);
    continue;
  }
  const parentIds = new Set(parentRows.map(r => String(r.id)));
  const orphans = kids.filter(k => !parentIds.has(String(k[col])));
  console.log(`${label} ${orphans.length}`);
  if (orphans.length > 0) {
    orphanTotal += orphans.length;
    fail(`${child}.${col}: ${orphans.length} orphan(s) referencing missing ${parent}.id, e.g. ${orphans.slice(0, 5).map(o => o[col]).join(', ')}`);
  }
}

// Mis-mapped foreign keys. The orphan check above cannot see one: after the
// migration every child points at SOME valid parent by construction, so a
// cross-wired join in section B — a copy-paste error in one of its eight
// `update ... from ...` statements — passes with 0 orphans. Reproduced
// against a postgres:17 + PostgREST rebuild of this schema by pointing
// products.new_store_category_id at store_categories via p.store_id: two of
// four products ended up under the wrong store_category and this script
// still printed "PASS: 25 total rows, 0 orphaned foreign keys".
//
// Because the migration keeps the legacy_* columns, the real check is cheap:
// the child's legacy_*_id must equal the parent row's legacy_id. Expressed
// here as PostgREST resource embedding (`parent:<table>!<fk>(legacy_id)`),
// which is a plain GET — PostgREST cannot run arbitrary SQL and this file
// deliberately has no RPC to call.
//
// The `!products_store_id_fkey` hint is doing double duty. PostgREST resolves
// an embed through a named foreign key in its schema cache, so if any of the
// eight constraints is missing or renamed after the migration the request
// comes back PGRST200 ("Searched for a foreign key relationship ... using the
// hint '<name>' ... but no matches were found") rather than data — which is
// the assertion that the eight foreign keys still EXIST, and is what would
// have caught section E re-adding them wrong. fetchAll() prints that body
// verbatim in its FAIL line, so the missing constraint names itself. The
// flip side: section E preserves whatever name production actually uses, so
// if a constraint there is named something other than the eight below, this
// reports ERROR/PGRST200 for a healthy database — fix the name here, not the
// migration.
//
// Before the migration the legacy_* columns don't exist yet, so PostgREST
// answers 42703 and the section reports n/a — same tolerated-absence contract
// the ownership block below uses. That makes these eight lines change between
// the before and after runs by design; every other line must still diff clean.
const MAPPING = [
  ['products',         'legacy_category_id',       'categories',       'products_category_id_fkey'],
  ['products',         'legacy_store_id',          'stores',           'products_store_id_fkey'],
  ['products',         'legacy_store_category_id', 'store_categories', 'products_store_category_id_fkey'],
  ['order_items',      'legacy_order_id',          'orders',           'order_items_order_id_fkey'],
  ['order_items',      'legacy_product_id',        'products',         'order_items_product_id_fkey'],
  ['product_views',    'legacy_product_id',        'products',         'product_views_product_id_fkey'],
  ['product_reviews',  'legacy_product_id',        'products',         'product_reviews_product_id_fkey'],
  ['store_categories', 'legacy_store_id',          'stores',           'store_categories_store_id_fkey'],
];

console.log('\n== mis-mapped foreign keys (child legacy id vs parent legacy_id, all must be 0) ==');
let mismapTotal = 0;
let mismapChecked = false;
for (const [child, legacyCol, parent, fkName] of MAPPING) {
  const rows = await fetchAll(
    `${child}?select=${legacyCol},parent:${parent}!${fkName}(legacy_id)&${legacyCol}=not.is.null`,
    { tolerateErrorCodes: ['42703'] },
  );
  const label = (child + '.' + legacyCol).padEnd(34);
  // Same reasoning as the orphan loop: never print a number derived from a
  // failed fetch. "0" here would read as "every row maps correctly".
  if (rows === null) {
    console.log(`${label} ERROR`);
    continue;
  }
  if (rows === undefined) {
    console.log(`${label} n/a (legacy columns not present — expected before the migration)`);
    continue;
  }
  mismapChecked = true;
  // String() on both sides for the same reason the orphan check does it, and
  // a missing embedded parent (null) counts as a mismatch rather than being
  // skipped — String(undefined) never equals a real legacy id.
  const bad = rows.filter(r => String(r[legacyCol]) !== String(r.parent?.legacy_id));
  console.log(`${label} ${bad.length}`);
  if (bad.length > 0) {
    mismapTotal += bad.length;
    fail(`${child}.${legacyCol}: ${bad.length} row(s) now point at the WRONG ${parent} — section B's join for this column is cross-wired, e.g. ${legacyCol} ${bad.slice(0, 5).map(r => `${r[legacyCol]} -> parent legacy_id ${r.parent?.legacy_id}`).join(', ')}`);
  }
}

// Ownership, meaningful only after the migration adds the column. Four
// distinct outcomes, each printed explicitly so the section never silently
// vanishes from stdout (this is what a human reads to decide whether to run
// the owner-assignment runbook — a missing section is worse than a wrong-
// looking one, because it hides that anything needed deciding at all):
//   - fetch failed for a real reason (null)              -> say so, point at FAIL above.
//   - stores.user_id doesn't exist yet (tolerated 42703, undefined) -> expected pre-migration state.
//   - stores table legitimately has zero rows            -> say so explicitly.
//   - normal case                                        -> the actual ownership summary.
const stores = await fetchAll('stores?select=id,status,user_id', { tolerateErrorCodes: ['42703'] });
if (stores === null) {
  console.log('\n== ownership ==\n(query failed, see FAIL above)');
} else if (stores === undefined) {
  console.log('\n== ownership ==\n(stores.user_id column not present — expected before the migration)');
} else if (stores.length === 0) {
  console.log('\n== ownership ==\nstores with user_id: 0/0 (no stores found)');
} else {
  const owned = stores.filter(s => s.user_id).length;
  const unownedApproved = stores.filter(s => !s.user_id && s.status === 'approved').length;
  console.log(`\n== ownership ==\nstores with user_id: ${owned}/${stores.length}`);
  console.log(`APPROVED stores with NO owner (need the runbook): ${unownedApproved}`);
}

console.log(failures === 0
  ? `\nPASS: ${total} total rows, 0 orphaned foreign keys${mismapChecked ? ', 0 mis-mapped foreign keys' : ' (fk mapping not checked — expected before the migration)'}`
  : `\n${failures} assertion(s) failed (${orphanTotal} orphaned row(s), ${mismapTotal} mis-mapped row(s))`);
process.exit(failures === 0 ? 0 : 1);
