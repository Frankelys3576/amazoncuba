// The uuid migration left every one of the nine migrated tables carrying its
// pre-migration integer key (and the integer FKs that pointed at it) under a
// `legacy_*` name: `legacy_id` on seven models plus `legacy_category_id`,
// `legacy_store_id`, `legacy_store_category_id`, `legacy_order_id` and
// `legacy_product_id` on five more — 15 columns in schema.prisma, all typed
// `BigInt`. They exist purely as rollback scaffolding for the migration; no
// API client has ever been given them and none should be.
//
// Those two facts (rollback-only, and the *only* BigInt columns in the
// schema) make one rule solve two problems at once:
//
//   1. The leak. Every response path spreads the whole Prisma row
//      (`...store`, `...rest` in the three format utils; the bare-row
//      returns from stores.updateZelleInfo, orders.create/update,
//      products.create/update/remove and store-categories.findAll/create),
//      so a migration-internal column reaches real clients.
//   2. The crash. `JSON.stringify({ legacy_id: 1n })` throws
//      "TypeError: Do not know how to serialize a BigInt". Since every
//      BigInt column in the schema is named `legacy_*`, removing every
//      `legacy_*` key removes every possible BigInt from the response — the
//      serializer can no longer be handed one.
//
// This is deliberately a strip and not a `BigInt.prototype.toJSON` shim: a
// shim fixes only (2), and does it by silently coercing through `Number()`,
// which is lossy past 2^53 and hands the client scaffolding it should never
// see. A strip closes both, and is the one place to look when asking "can a
// legacy column escape?".
const LEGACY_PREFIX = 'legacy_';

// Only plain objects and arrays are rebuilt. Class instances are returned
// by identity, which matters for the two that routinely appear in these
// responses: Prisma.Decimal (rebuilding it would strip its prototype and
// turn `price` into an internal `{s,e,d}` blob) and Date (`created_at`,
// which would become `{}`). Buffers from the upload path are covered by the
// same rule.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function stripLegacyFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => stripLegacyFields(entry)) as unknown as T;
  }
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith(LEGACY_PREFIX)) continue;
    result[key] = stripLegacyFields(entry);
  }
  return result as T;
}
