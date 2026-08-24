import { Prisma } from '@prisma/client';
import { stripLegacyFields } from './legacy-fields.util';

// Every fixture below uses a genuine `bigint` (`1n`), not a `Number`. That is
// the whole point of this file: the previous BigInt regression test was
// deleted as "unreachable" and the suite stayed green at 121/121 while
// GET /api/stores, /api/products, /api/orders and /api/stores/:id/categories
// would all have 500'd in production, because every Prisma mock in the suite
// returns plain objects with `Number` ids. A fixture that isn't a real
// bigint cannot fail when the fix is reverted, so it isn't a test.
describe('stripLegacyFields', () => {
  // Guard rail for the fixtures themselves: if this ever stops throwing,
  // Node's semantics changed (or something re-installed a
  // BigInt.prototype.toJSON shim globally) and the rest of this file is no
  // longer proving what it claims to prove.
  it('a raw row carrying a bigint legacy column cannot be JSON-serialized at all', () => {
    const raw = { id: 'a-uuid', legacy_id: 1n, name: 'Café' };
    expect(() => JSON.stringify(raw)).toThrow(TypeError);
  });

  it('removes legacy_* keys so the row serializes', () => {
    const store = {
      id: '11111111-1111-7111-8111-111111111111',
      legacy_id: 1n,
      name: 'Tienda',
    };

    const stripped = stripLegacyFields(store);

    expect(() => JSON.stringify(stripped)).not.toThrow();
    expect(JSON.parse(JSON.stringify(stripped))).toEqual({
      id: '11111111-1111-7111-8111-111111111111',
      name: 'Tienda',
    });
  });

  it('removes legacy_* FKs, not just legacy_id', () => {
    const product = {
      id: '22222222-2222-7222-8222-222222222222',
      legacy_id: 1n,
      legacy_store_id: 7n,
      legacy_category_id: 3n,
      legacy_store_category_id: null,
      store_id: '11111111-1111-7111-8111-111111111111',
    };

    const stripped = stripLegacyFields(product);

    expect(Object.keys(stripped).filter((k) => k.startsWith('legacy_'))).toEqual([]);
    expect(() => JSON.stringify(stripped)).not.toThrow();
  });

  // formatOrder returns orders -> order_items -> products, and the bigint
  // columns live at all three levels (Order.legacy_id, OrderItem.legacy_id/
  // legacy_order_id/legacy_product_id, Product.legacy_id). A shallow strip
  // would leave the nested ones and still 500 GET /api/orders.
  it('strips through arrays and nested rows', () => {
    const order = {
      id: '33333333-3333-7333-8333-333333333333',
      legacy_id: 1n,
      order_items: [
        {
          id: '44444444-4444-7444-8444-444444444444',
          legacy_id: 2n,
          legacy_order_id: 1n,
          legacy_product_id: 9n,
          products: { id: '2222', legacy_id: 9n, name: 'Café' },
        },
      ],
    };

    const stripped = stripLegacyFields(order);

    expect(() => JSON.stringify(stripped)).not.toThrow();
    expect(JSON.parse(JSON.stringify(stripped))).toEqual({
      id: '33333333-3333-7333-8333-333333333333',
      order_items: [
        {
          id: '44444444-4444-7444-8444-444444444444',
          products: { id: '2222', name: 'Café' },
        },
      ],
    });
  });

  it('strips a top-level array of rows (findMany responses)', () => {
    const rows = [
      { id: 'a', legacy_id: 1n },
      { id: 'b', legacy_id: 2n },
    ];

    expect(() => JSON.stringify(stripLegacyFields(rows))).not.toThrow();
    expect(JSON.parse(JSON.stringify(stripLegacyFields(rows)))).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  // The strip rebuilds plain objects, so anything that is *not* a plain
  // object has to come back by identity — otherwise a Decimal would lose its
  // prototype and `price` would serialize as an internal {s,e,d} blob, and a
  // Date would serialize as {}.
  it('returns class instances (Prisma.Decimal, Date) by identity', () => {
    const price = new Prisma.Decimal('12.50');
    const createdAt = new Date('2026-08-24T00:00:00.000Z');

    const stripped = stripLegacyFields({ legacy_id: 1n, price, created_at: createdAt });

    expect(stripped.price).toBe(price);
    expect(stripped.created_at).toBe(createdAt);
    expect(JSON.parse(JSON.stringify(stripped))).toEqual({
      price: '12.5',
      created_at: '2026-08-24T00:00:00.000Z',
    });
  });

  it('passes primitives and null through unchanged', () => {
    expect(stripLegacyFields(null)).toBeNull();
    expect(stripLegacyFields(undefined)).toBeUndefined();
    expect(stripLegacyFields('Pedido no encontrado')).toBe('Pedido no encontrado');
    expect(stripLegacyFields(7)).toBe(7);
  });

  // A non-Prisma key that merely starts with the same letters must not be
  // collateral damage, and a nested plain object under a non-legacy key
  // still has to be walked.
  it('only removes the legacy_ prefix, and keeps walking non-legacy branches', () => {
    const row = {
      legacyName: 'kept',
      zelle_info: { gallery: ['a.jpg'], legacy_id: 1n },
    };

    const stripped = stripLegacyFields(row);

    expect(stripped.legacyName).toBe('kept');
    expect(JSON.parse(JSON.stringify(stripped))).toEqual({
      legacyName: 'kept',
      zelle_info: { gallery: ['a.jpg'] },
    });
  });
});
