import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  describe('findAll', () => {
    // Finding 1 regression test: Express opts in explicitly to
    // `.order('is_featured', { ascending: false, nullsFirst: false })`
    // (product.controller.js:33), i.e. NULLS LAST. Prisma's `orderBy:
    // 'desc'` with no `nulls` option falls through to Postgres's native
    // DESC default, which is NULLS FIRST — the opposite. Any product row
    // with `is_featured: null` (every row that predates the column's
    // `@default(false)`) would otherwise sort to the very top of the
    // public catalog, ahead of genuinely featured products.
    it('passes orderBy with is_featured desc/nulls-last, then created_at desc', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({});

      expect(findMany.mock.calls[0][0].orderBy).toEqual([
        { is_featured: { sort: 'desc', nulls: 'last' } },
        { created_at: 'desc' },
      ]);
    });

    it('builds where.store_id from storeId', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ storeId: '5' });

      expect(findMany.mock.calls[0][0].where).toEqual({ store_id: 5 });
    });

    it('builds where.category_id from category', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ category: '3' });

      expect(findMany.mock.calls[0][0].where).toEqual({ category_id: 3 });
    });

    it('builds where.store_category_id from store_category_id', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ store_category_id: '7' });

      expect(findMany.mock.calls[0][0].where).toEqual({ store_category_id: 7 });
    });

    it('builds where.name contains (case-insensitive) from q', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ q: 'café' });

      expect(findMany.mock.calls[0][0].where).toEqual({
        name: { contains: 'café', mode: 'insensitive' },
      });
    });

    it('builds where.image_url not-null/not-empty from requireImage', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ requireImage: 'true' });

      expect(findMany.mock.calls[0][0].where).toEqual({
        image_url: { not: null, notIn: [''] },
      });
    });

    it('builds where.delivery_locations hasSome with province + municipality specific tags', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ province: 'La Habana', municipality: 'Playa' });

      expect(findMany.mock.calls[0][0].where).toEqual({
        delivery_locations: {
          hasSome: [
            'La Habana:Playa',
            'La Habana:Toda la provincia',
            'Toda Cuba:Toda Cuba',
          ],
        },
      });
    });

    it('builds where.delivery_locations hasSome with province-only tags when municipality is absent', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ province: 'La Habana' });

      expect(findMany.mock.calls[0][0].where).toEqual({
        delivery_locations: {
          hasSome: ['La Habana:Toda la provincia', 'Toda Cuba:Toda Cuba'],
        },
      });
    });

    it('omits the delivery_locations filter entirely when neither province nor municipality is given', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({});

      expect(findMany.mock.calls[0][0].where).toEqual({});
    });

    it('combines multiple filters into a single where object', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { product: { findMany } } as any;
      const service = new ProductsService(prisma);

      await service.findAll({ storeId: '5', category: '3', q: 'pan' });

      expect(findMany.mock.calls[0][0].where).toEqual({
        store_id: 5,
        category_id: 3,
        name: { contains: 'pan', mode: 'insensitive' },
      });
    });
  });

  describe('create', () => {
    it('throws ForbiddenException when store_id does not match the authenticated store', async () => {
      const prisma = { product: { create: jest.fn() } } as any;
      const service = new ProductsService(prisma);

      await expect(
        service.create({ store_id: 2 } as any, { id: 1 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('defaults currency to USD and builds delivery_locations when omitted', async () => {
      const create = jest.fn().mockResolvedValue({ id: 10 });
      const prisma = { product: { create } } as any;
      const service = new ProductsService(prisma);

      await service.create(
        { store_id: 1, name: 'Café', price: 5, province: 'La Habana', municipality: 'Playa' } as any,
        { id: 1 } as any,
      );

      expect(create.mock.calls[0][0].data).toMatchObject({
        currency: 'USD',
        delivery_locations: ['La Habana:Playa'],
      });
    });

    // Finding 2 regression: create() returns the raw prisma.product.create()
    // row (no formatProduct pass), so price/price_usd/rating_avg come back
    // as real Prisma.Decimal instances unless explicitly coerced. PostgREST
    // (what Express returns) serializes Postgres `numeric` as a JSON number,
    // so a raw Decimal here is a real divergence from Express's response.
    it('coerces Decimal columns (price, price_usd, rating_avg) on the returned row to plain numbers', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 10,
        price: new Prisma.Decimal(40),
        price_usd: new Prisma.Decimal(1.5),
        rating_avg: new Prisma.Decimal(4.5),
      });
      const prisma = { product: { create } } as any;
      const service = new ProductsService(prisma);

      const result = await service.create(
        { store_id: 1, name: 'Café', price: 40, province: 'La Habana', municipality: 'Playa' } as any,
        { id: 1 } as any,
      );

      expect(typeof result.price).toBe('number');
      expect(result.price).toBe(40);
      expect(typeof result.price_usd).toBe('number');
      expect(result.price_usd).toBe(1.5);
      expect(typeof result.rating_avg).toBe('number');
      expect(result.rating_avg).toBe(4.5);
      expect(JSON.stringify(result)).not.toMatch(/"(price|price_usd|rating_avg)":"/);
    });

    it('leaves null Decimal columns null, not 0, on the returned row', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 10,
        price: new Prisma.Decimal(40),
        price_usd: null,
        rating_avg: null,
      });
      const prisma = { product: { create } } as any;
      const service = new ProductsService(prisma);

      const result = await service.create(
        { store_id: 1, name: 'Café', price: 40, province: 'La Habana', municipality: 'Playa' } as any,
        { id: 1 } as any,
      );

      expect(result.price_usd).toBeNull();
      expect(result.rating_avg).toBeNull();
    });
  });

  describe('update', () => {
    it('coerces Decimal columns on the returned row to plain numbers', async () => {
      const prisma = {
        product: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
          update: jest.fn().mockResolvedValue({
            id: 1,
            price: new Prisma.Decimal(55),
            price_usd: new Prisma.Decimal(2.25),
            rating_avg: new Prisma.Decimal(3.75),
          }),
        },
      } as any;
      const service = new ProductsService(prisma);

      const result = await service.update(1, { price: 55 } as any, { id: 1 } as any);

      expect(typeof result.price).toBe('number');
      expect(result.price).toBe(55);
      expect(typeof result.price_usd).toBe('number');
      expect(result.price_usd).toBe(2.25);
      expect(typeof result.rating_avg).toBe('number');
      expect(result.rating_avg).toBe(3.75);
    });

    it('leaves null Decimal columns null, not 0, on the returned row', async () => {
      const prisma = {
        product: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
          update: jest.fn().mockResolvedValue({
            id: 1,
            price: new Prisma.Decimal(55),
            price_usd: null,
            rating_avg: null,
          }),
        },
      } as any;
      const service = new ProductsService(prisma);

      const result = await service.update(1, { price: 55 } as any, { id: 1 } as any);

      expect(result.price_usd).toBeNull();
      expect(result.rating_avg).toBeNull();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      const prisma = { product: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      const service = new ProductsService(prisma);

      await expect(service.remove(1, { id: 1 } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the product belongs to a different store', async () => {
      const prisma = {
        product: { findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 2 }) },
      } as any;
      const service = new ProductsService(prisma);

      await expect(service.remove(1, { id: 1 } as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    // Finding 2 regression: remove() returns { message, product } where
    // `product` is the raw prisma.product.delete() row — same Decimal leak
    // as create/update.
    it('coerces Decimal columns on the returned product row to plain numbers', async () => {
      const prisma = {
        product: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
          delete: jest.fn().mockResolvedValue({
            id: 1,
            price: new Prisma.Decimal(20),
            price_usd: new Prisma.Decimal(0.99),
            rating_avg: null,
          }),
        },
        orderItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      } as any;
      const service = new ProductsService(prisma);

      const result = await service.remove(1, { id: 1 } as any);

      expect(typeof result.product.price).toBe('number');
      expect(result.product.price).toBe(20);
      expect(typeof result.product.price_usd).toBe('number');
      expect(result.product.price_usd).toBe(0.99);
      expect(result.product.rating_avg).toBeNull();
    });
  });
});
