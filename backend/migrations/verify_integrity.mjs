// Row counts and referential integrity, before and after migration.
// This is the only automated check that the migration preserved the data:
// run it once against production before the migration and once after, then
// diff the two outputs.
// Usage: node backend/migrations/verify_integrity.mjs > before.txt
//
// Read-only: only ever issues GET requests via PostgREST. Never run this
// against production expecting it to write, create, or execute SQL — it
// doesn't.
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
  ? `\nPASS: ${total} total rows, 0 orphaned foreign keys`
  : `\n${failures} assertion(s) failed (${orphanTotal} orphaned row(s) total)`);
process.exit(failures === 0 ? 0 : 1);
