import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  describe('findAll', () => {
    // Named risk: Express filters twice — first narrowing which orders come
    // back (order.controller.js:13-33), then filtering order_items *within*
    // each returned order (order.controller.js:49-55) so a seller viewing an
    // order that spans multiple stores only sees their own line items.
    // Dropping the second filter leaks another store's line items.
    it("scopes both the order list and each order's items to the given store", async () => {
      const orderItem = { order_id: 1, product: { store_id: 7 } };
      const prisma = {
        orderItem: { findMany: jest.fn().mockResolvedValue([orderItem]) },
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: 1,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { store_id: 7, price: new Prisma.Decimal(20) },
                },
                {
                  product_id: 2,
                  quantity: 1,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { store_id: 9, price: new Prisma.Decimal(20) },
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: '7' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [1] } } }),
      );
      expect(result[0].order_items).toHaveLength(1);
      expect(result[0].order_items[0].products!.store_id).toBe(7);
    });

    it('returns an empty array without querying orders when the store has no matching order_items', async () => {
      const prisma = {
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        order: { findMany: jest.fn() },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: '7' });

      expect(result).toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    // Prisma's Order.id/OrderItem.order_id/Product.store_id are all BigInt
    // columns, so at runtime they come back as JS `bigint`, not `number`.
    // A strict `===` between a bigint and the `Number(query.storeId)` used
    // to build `storeId` is *always* false — silently emptying every
    // order's order_items instead of throwing. This regression test uses
    // real `bigint` values (as the generated client actually returns) to
    // catch that trap.
    it('scopes order_items to the store even when Prisma returns store_id as a bigint', async () => {
      const prisma = {
        orderItem: {
          findMany: jest.fn().mockResolvedValue([{ order_id: BigInt(1) }]),
        },
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: 1,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { store_id: BigInt(7) },
                },
                {
                  product_id: 2,
                  quantity: 1,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { store_id: BigInt(9) },
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: '7' });

      expect(result[0].order_items).toHaveLength(1);
      expect(result[0].order_items[0].products!.store_id).toBe(BigInt(7));
    });

    it('intersects the ids query param with the store-scoped order ids', async () => {
      const prisma = {
        orderItem: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ order_id: 1 }, { order_id: 2 }]),
        },
        order: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await service.findAll({ storeId: '7', ids: '2,3' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [2] } } }),
      );
    });

    it('filters orders by the ids query param when no storeId is given', async () => {
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await service.findAll({ ids: '5,abc,9' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [5, 9] } } }),
      );
    });

    it('queries all orders (no where clause) and sorts by created_at desc when no filters are given', async () => {
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await service.findAll({});

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    // Ruling: order.total, order_items[].price_at_purchase, and
    // order_items[].product.{price,price_usd,rating_avg} are all Decimal
    // columns that come back from Prisma as real Prisma.Decimal instances
    // (JSON-serialize as strings) rather than the plain JS numbers PostgREST
    // gave Express. Assert coercion at all three nesting levels, not just
    // the top-level total — a top-level-only assertion would pass even if
    // the nested item/product coercion were missing entirely.
    it('coerces Decimal fields to plain numbers at all three nesting levels (order, item, product)', async () => {
      const prisma = {
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: 1,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: {
                    id: 1,
                    price: new Prisma.Decimal(20),
                    price_usd: new Prisma.Decimal(0.8),
                    rating_avg: new Prisma.Decimal(4.5),
                  },
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({});
      const [order] = result;
      const [item] = order.order_items;

      expect(typeof order.total).toBe('number');
      expect(order.total).toBe(40);

      expect(typeof item.price_at_purchase).toBe('number');
      expect(item.price_at_purchase).toBe(20);

      expect(typeof item.products!.price).toBe('number');
      expect(item.products!.price).toBe(20);
      expect(typeof item.products!.price_usd).toBe('number');
      expect(item.products!.price_usd).toBe(0.8);
      expect(typeof item.products!.rating_avg).toBe('number');
      expect(item.products!.rating_avg).toBe(4.5);

      const json = JSON.stringify(result);
      expect(json).not.toMatch(
        /"(total|price_at_purchase|price|price_usd|rating_avg)":"/,
      );
    });

    it('leaves null Decimal fields null (not 0) at every nesting level', async () => {
      const prisma = {
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: 1,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: {
                    id: 1,
                    price: new Prisma.Decimal(20),
                    price_usd: null,
                    rating_avg: null,
                  },
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({});

      expect(result[0].order_items[0].products!.price_usd).toBeNull();
      expect(result[0].order_items[0].products!.rating_avg).toBeNull();
    });

    it('leaves order_items[].product null when the product relation is null', async () => {
      const prisma = {
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: null,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: null,
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({});

      expect(result[0].order_items[0].products).toBeNull();
    });

    // IMPORTANT 3: Express's nested select aliases the joined product row
    // as `products` (order.controller.js: '*, order_items(*, products(*))'),
    // and seller-frontend/src/SellerOrders.jsx:30 reads item.products.name
    // — falling back to `Producto {id}` whenever that key is missing. The
    // Prisma relation is named `product`, so this pins the response actually
    // carries the `products` key Express used and NOT the raw relation name.
    it("keys the joined product as `products` (Express's alias), not the Prisma relation name `product`", async () => {
      const prisma = {
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: 1,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { id: 1, name: 'Café', price: new Prisma.Decimal(5) },
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({});
      const [item] = result[0].order_items;

      expect((item as any).products).toMatchObject({ id: 1, name: 'Café' });
      expect((item as any).product).toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates the order with status pending and defaults payment_method to cash_on_delivery', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: 1, total: new Prisma.Decimal(40) });
      const prisma = {
        order: { create },
        orderItem: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      } as any;
      const service = new OrdersService(prisma);

      await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        total: 40,
        items: [],
      } as any);

      expect(create.mock.calls[0][0].data).toMatchObject({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        status: 'pending',
        payment_method: 'cash_on_delivery',
      });
    });

    it('inserts order_items with price_at_purchase mapped from item.price', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = {
        order: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 5, total: new Prisma.Decimal(20) }),
        },
        orderItem: { createMany },
      } as any;
      const service = new OrdersService(prisma);

      await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        total: 20,
        items: [{ product_id: 3, quantity: 2, price: 10 }],
      } as any);

      expect(createMany.mock.calls[0][0].data).toEqual([
        { order_id: 5, product_id: 3, quantity: 2, price_at_purchase: 10 },
      ]);
    });

    it('does not call orderItem.createMany when items is empty', async () => {
      const createMany = jest.fn();
      const prisma = {
        order: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 5, total: new Prisma.Decimal(20) }),
        },
        orderItem: { createMany },
      } as any;
      const service = new OrdersService(prisma);

      await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        total: 20,
        items: [],
      } as any);

      expect(createMany).not.toHaveBeenCalled();
    });

    // Finding-style regression: create() returns the raw prisma.order.create()
    // row (no nested order_items), so `total` must still be coerced even
    // though this response path has no nesting to worry about.
    it('coerces the Decimal total on the returned order to a plain number', async () => {
      const prisma = {
        order: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 1, total: new Prisma.Decimal(40) }),
        },
        orderItem: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        total: 40,
        items: [],
      } as any);

      expect(typeof result.order.total).toBe('number');
      expect(result.order.total).toBe(40);
      expect(result.message).toBe('Pedido creado exitosamente');
    });
  });

  describe('update', () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      { code: 'P2025', clientVersion: '5.0.0' },
    );

    it('throws NotFoundException on a P2025 (zero-row update)', async () => {
      const prisma = {
        order: { update: jest.fn().mockRejectedValue(notFoundError) },
      } as any;
      const service = new OrdersService(prisma);

      await expect(service.update(999, 'shipped')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates a non-P2025 error unchanged', async () => {
      const dbError = new Error('connection terminated unexpectedly');
      const prisma = {
        order: { update: jest.fn().mockRejectedValue(dbError) },
      } as any;
      const service = new OrdersService(prisma);

      await expect(service.update(1, 'shipped')).rejects.toBe(dbError);
    });

    it('coerces the Decimal total on the returned order to a plain number', async () => {
      const prisma = {
        order: {
          update: jest.fn().mockResolvedValue({
            id: 1,
            status: 'shipped',
            total: new Prisma.Decimal(40),
          }),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.update(1, 'shipped');

      expect(typeof result.total).toBe('number');
      expect(result.total).toBe(40);
    });
  });
});
