import { Prisma } from '@prisma/client';
import { formatProduct } from './product-format.util';

describe('formatProduct', () => {
  it('derives store_accepts_zelle/store_has_delivery/store_name/store_phone/store_slug from the joined store', () => {
    const product = {
      id: 1,
      store: { id: 9, accepts_zelle: true, has_delivery: false, name: 'Cafetería Juan', phone: '5551234', slug: 'cafeteria-juan' },
    };

    expect(formatProduct(product as any)).toMatchObject({
      store_accepts_zelle: true,
      store_has_delivery: false,
      store_name: 'Cafetería Juan',
      store_phone: '5551234',
      store_slug: 'cafeteria-juan',
    });
  });

  it('falls back to the store id as the slug when the store has no slug set', () => {
    const product = {
      id: 1,
      store: { id: 9, accepts_zelle: false, has_delivery: false, name: 'New Name', phone: '5551234', slug: null },
    };

    expect(formatProduct(product as any).store_slug).toBe(9);
  });

  // IMPORTANT 3 (symmetry): Express selects the joined store as `stores`
  // (product.controller.js: '*, stores(accepts_zelle, name, phone, slug,
  // has_delivery)'). The Prisma relation is named `store`, so this pins the
  // response actually carries the `stores` key, not the raw relation name.
  it("keys the joined store as `stores` (Express's alias), not the Prisma relation name `store`", () => {
    const product = {
      id: 1,
      store: { id: 9, accepts_zelle: true, has_delivery: false, name: 'Cafetería Juan', phone: '5551234', slug: 'cafeteria-juan' },
    };

    const result = formatProduct(product as any) as any;

    expect(result.stores).toMatchObject({ id: 9, name: 'Cafetería Juan' });
    expect(result.store).toBeUndefined();
  });

  it('handles a product with no joined store (store_id was null)', () => {
    const product = { id: 1, store: null };

    expect(formatProduct(product as any)).toMatchObject({
      store_accepts_zelle: false,
      store_has_delivery: false,
      store_name: undefined,
      store_phone: undefined,
      store_slug: undefined,
    });
  });

  // Ruling 1: schema.prisma types Product.price as non-null Decimal, plus
  // rating_avg Decimal? and price_usd Decimal?. At runtime those come back
  // from the generated client as real Prisma.Decimal instances (never plain
  // JS numbers), which JSON.stringify serializes as *strings*. A plain
  // object literal fixture (`price: 40`) wouldn't exercise that, so these
  // build real Prisma.Decimal values the way the generated client actually
  // returns them.
  describe('Decimal coercion (price, price_usd, rating_avg)', () => {
    it('coerces a non-null price Decimal to a plain JS number, not a Decimal/string', () => {
      const product = {
        id: 1,
        price: new Prisma.Decimal(40),
        price_usd: null,
        rating_avg: null,
        store: null,
      };

      const result = formatProduct(product as any);

      expect(typeof result.price).toBe('number');
      expect(result.price).toBe(40);
      expect(JSON.stringify({ price: result.price })).toBe('{"price":40}');
    });

    it('coerces a non-null price_usd Decimal to a plain JS number', () => {
      const product = {
        id: 1,
        price: new Prisma.Decimal(40),
        price_usd: new Prisma.Decimal(1.5),
        rating_avg: null,
        store: null,
      };

      const result = formatProduct(product as any);

      expect(typeof result.price_usd).toBe('number');
      expect(result.price_usd).toBe(1.5);
      expect(JSON.stringify({ price_usd: result.price_usd })).toBe('{"price_usd":1.5}');
    });

    it('coerces a non-null rating_avg Decimal to a plain JS number', () => {
      const product = {
        id: 1,
        price: new Prisma.Decimal(40),
        price_usd: null,
        rating_avg: new Prisma.Decimal(4.5),
        store: null,
      };

      const result = formatProduct(product as any);

      expect(typeof result.rating_avg).toBe('number');
      expect(result.rating_avg).toBe(4.5);
      expect(JSON.stringify({ rating_avg: result.rating_avg })).toBe('{"rating_avg":4.5}');
    });

    it('leaves price_usd null, not 0, when the direct column is null', () => {
      const product = {
        id: 1,
        price: new Prisma.Decimal(40),
        price_usd: null,
        rating_avg: null,
        store: null,
      };

      const result = formatProduct(product as any);

      expect(result.price_usd).toBeNull();
    });

    it('leaves rating_avg null, not 0, when the direct column is null', () => {
      const product = {
        id: 1,
        price: new Prisma.Decimal(40),
        price_usd: null,
        rating_avg: null,
        store: null,
      };

      const result = formatProduct(product as any);

      expect(result.rating_avg).toBeNull();
    });
  });
});
