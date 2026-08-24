// Asserts the generator actually produces RFC 9562 v7 values.
// Usage: node backend/migrations/verify_uuid_v7.mjs
// Requires public.uuid_generate_v7() to already exist and PostgREST's schema
// cache to have been reloaded — both done by 001_uuid_v7_function.sql, which
// issues `notify pgrst, 'reload schema';` as its last statement.
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

// 5. the timestamp prefix must decode to approximately now — checked at both
// ends of the run, not just the first id.
let maxDrift = 0;
for (const id of [ids[0], ids[ids.length - 1]]) {
  const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
  const drift = Math.abs(Date.now() - ms);
  maxDrift = Math.max(maxDrift, drift);
  if (drift > 60000) fail(`timestamp prefix decodes to ${new Date(ms).toISOString()}, ${drift}ms from now (${id})`);
}

// 6. the bits NOT forced by the version/variant writes must still vary.
// A wrong cast-truncation direction or substring offset would clobber them
// into constants while every other assertion above still passed: e.g. if
// octet 6 came out constant 0x70 and octet 8 constant 0x80, versions and
// variants would still read correctly, prefixes would still climb, and 200
// distinct timestamps would still guarantee no collisions. De-dashed hex
// index 13 is octet 6's low nibble (the one bit-group the version write is
// documented to leave random); octet 8's free bits are its low 6 bits, taken
// as an integer mask (`& 0x3f`) rather than by hex-char slicing, since a
// naive slice pulls in octet 9 too and would mask a clobbered octet 8 behind
// octet 9's always-random bits.
const hex = ids.map(id => id.replace(/-/g, ''));
const octet6LowNibbles = new Set(hex.map(h => h[13]));
const octet8Low6Bits = new Set(hex.map(h => parseInt(h.slice(16, 18), 16) & 0x3f));
if (octet6LowNibbles.size < 8) fail(`octet 6 low nibble has only ${octet6LowNibbles.size} distinct values in 200 (of 16 possible) — version write may be clobbering random bits`);
if (octet8Low6Bits.size < 16) fail(`octet 8 low 6 bits have only ${octet8Low6Bits.size} distinct values in 200 (of 64 possible) — variant write may be clobbering random bits`);

console.log(failures === 0
  ? `PASS: 200 ids, version 7, RFC variant, prefix non-decreasing, no collisions, timestamp within ${maxDrift}ms, tail bits vary`
  : `${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
