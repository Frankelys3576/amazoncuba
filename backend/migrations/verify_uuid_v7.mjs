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

// 3. the 48-bit timestamp prefix must be non-decreasing across calls — NOT a
// strict full-id sort. UUIDv7 only guarantees ordering at millisecond
// granularity; the remaining 74 bits are random, so two ids minted in the
// same millisecond can sort arbitrarily relative to each other. Asserting
// the full ids sort in strict generation order would therefore fail against
// a *correct* implementation whenever two of these 200 calls land in the
// same millisecond. Checking that the prefix itself never decreases still
// catches a wrong-endianness or wrong-octet timestamp (the prefix would jump
// around instead of climbing), and the final strict-increase check below
// guards against a constant/missing timestamp (flat is allowed between two
// same-ms ids, but not across all 200 sequential HTTP calls, which should
// span more than one millisecond).
const prefixes = ids.map(id => parseInt(id.replace(/-/g, '').slice(0, 12), 16));
for (let i = 1; i < prefixes.length; i++) {
  if (prefixes[i] < prefixes[i - 1]) {
    fail(`timestamp prefix decreased at index ${i}: ${prefixes[i]} < ${prefixes[i - 1]} — not big-endian or wrong octets (${ids[i - 1]} -> ${ids[i]})`);
  }
}
if (prefixes[prefixes.length - 1] <= prefixes[0]) {
  fail('timestamp prefix never increased across 200 calls — timestamp may be constant or missing');
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
