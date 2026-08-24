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
// tolerateErrorCodes: PostgREST error codes (e.g. '42703' undefined column)
// that should be swallowed as "not applicable yet" rather than a real
// failure — used for the user_id ownership check, which is expected to 404
// before the migration adds the column. Any other non-OK response is a
// genuine failure and gates the exit code.
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
      if (tolerateErrorCodes.includes(code)) return null;
      fail(`GET ${path} -> ${r.status} ${body}`);
      return rows;
    }
    const batch = await r.json();
    rows.push(...batch);
    const range = r.headers.get('content-range') || '';
    const total = range.includes('/') ? Number(range.split('/')[1]) : rows.length;
    if (batch.length === 0 || rows.length >= total) {
      if (Number.isFinite(total) && rows.length !== total) {
        fail(`${path} returned ${rows.length} rows but Content-Range reported total ${total}`);
      }
      return rows;
    }
    offset += pageSize;
  }
}

const count = async (t) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${t}?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return (r.headers.get('content-range') || '?/?').split('/')[1];
};

const TABLES = ['stores', 'products', 'orders', 'order_items', 'categories', 'store_categories', 'platform_settings', 'product_views', 'product_reviews'];

console.log('== row counts ==');
let total = 0;
for (const t of TABLES) {
  const c = await count(t);
  total += Number(c) || 0;
  console.log(`${t.padEnd(20)} ${c}`);
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
  const parentIds = new Set(parentRows.map(r => String(r.id)));
  const orphans = kids.filter(k => !parentIds.has(String(k[col])));
  console.log(`${(child + '.' + col).padEnd(34)} ${orphans.length}`);
  if (orphans.length > 0) {
    orphanTotal += orphans.length;
    fail(`${child}.${col}: ${orphans.length} orphan(s) referencing missing ${parent}.id, e.g. ${orphans.slice(0, 5).map(o => o[col]).join(', ')}`);
  }
}

// Ownership, meaningful only after the migration adds the column. Before the
// migration, stores.user_id doesn't exist yet (PostgREST error 42703) — that
// is the expected pre-migration state, not a failure, so it's tolerated and
// the section is simply omitted.
const stores = await fetchAll('stores?select=id,status,user_id', { tolerateErrorCodes: ['42703'] });
if (stores && stores.length && 'user_id' in stores[0]) {
  const owned = stores.filter(s => s.user_id).length;
  const unownedApproved = stores.filter(s => !s.user_id && s.status === 'approved').length;
  console.log(`\n== ownership ==\nstores with user_id: ${owned}/${stores.length}`);
  console.log(`APPROVED stores with NO owner (need the runbook): ${unownedApproved}`);
} else if (stores === null) {
  console.log('\n== ownership ==\n(stores.user_id column not present — expected before the migration)');
}

console.log(failures === 0
  ? `\nPASS: ${total} total rows, 0 orphaned foreign keys`
  : `\n${failures} assertion(s) failed (${orphanTotal} orphaned row(s) total)`);
process.exit(failures === 0 ? 0 : 1);
