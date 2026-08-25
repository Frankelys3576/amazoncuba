import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  // Readable stand-ins for real uuid v7 order/product/store ids — the
  // service's own uuid-format filter on query.ids requires ids that
  // actually look like uuids.
  const ORDER_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORDER_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const ORDER_3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const PRODUCT_1 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const PRODUCT_2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const STORE_7 = '77777777-7777-7777-7777-777777777777';
  const STORE_9 = '99999999-9999-9999-9999-999999999999';

  describe('findAll', () => {
    // Named risk: Express filters twice — first narrowing which orders come
    // back (order.controller.js:13-33), then filtering order_items *within*
    // each returned order (order.controller.js:49-55) so a seller viewing an
    // order that spans multiple stores only sees their own line items.
    // Dropping the second filter leaks another store's line items.
    it("scopes both the order list and each order's items to the given store", async () => {
      const orderItem = { order_id: ORDER_1, product: { store_id: STORE_7 } };
      const prisma = {
        orderItem: { findMany: jest.fn().mockResolvedValue([orderItem]) },
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: ORDER_1,
              total: new Prisma.Decimal(40),
              order_items: [
                {
                  product_id: PRODUCT_1,
                  quantity: 2,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { store_id: STORE_7, price: new Prisma.Decimal(20) },
                },
                {
                  product_id: PRODUCT_2,
                  quantity: 1,
                  price_at_purchase: new Prisma.Decimal(20),
                  product: { store_id: STORE_9, price: new Prisma.Decimal(20) },
                },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: STORE_7 });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ORDER_1] } } }),
      );
      expect(result[0].order_items).toHaveLength(1);
      expect(result[0].order_items[0].products!.store_id).toBe(STORE_7);
    });

    it('returns an empty array without querying orders when the store has no matching order_items', async () => {
      const prisma = {
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        order: { findMany: jest.fn() },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: STORE_7 });

      expect(result).toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('intersects the ids query param with the store-scoped order ids', async () => {
      const prisma = {
        orderItem: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ order_id: ORDER_1 }, { order_id: ORDER_2 }]),
        },
        order: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await service.findAll({ storeId: STORE_7, ids: `${ORDER_2},${ORDER_3}` });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ORDER_2] } } }),
      );
    });

    // I6: the short circuit used to be skipped whenever a storeId was
    // present, so `?storeId=<uuid>&ids=garbage` handed back every order for
    // that store -- PII included -- on an unauthenticated route. It now
    // fires regardless of storeId, in both backends: when the ids ARE valid
    // the store branch already intersects them (see the test above), so an
    // empty valid-id set yielding nothing is that intersection's limit case.
    it('returns [] without querying orders when ids is supplied but every entry is invalid, even with a storeId', async () => {
      const prisma = {
        orderItem: {
          findMany: jest.fn().mockResolvedValue([{ order_id: ORDER_1 }]),
        },
        order: { findMany: jest.fn() },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: STORE_7, ids: 'not-a-uuid' });

      expect(result).toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
      expect(prisma.orderItem.findMany).not.toHaveBeenCalled();
    });

    it('filters orders by the ids query param when no storeId is given, dropping non-uuid entries', async () => {
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await service.findAll({ ids: `${ORDER_1},abc,${ORDER_2}` });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ORDER_1, ORDER_2] } } }),
      );
    });

    // I5: Express trims each entry before the uuid test
    // (order.controller.js:11-14). Without the trim the whitespace-padded
    // second id fails the regex and is silently dropped, so the same
    // tracking link returns two orders on Express and one here.
    it('trims whitespace around each id before validating it, as Express does', async () => {
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await service.findAll({ ids: `${ORDER_1}, ${ORDER_2}` });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ORDER_1, ORDER_2] } } }),
      );
    });

    // Mirrors the Express fix in order.controller.js (commit 04bc48e):
    // GET /api/orders?ids=<garbage> is unauthenticated (customer order
    // tracking). If every id in the list is invalid and no storeId narrows
    // the query, this must return [] rather than falling through to an
    // unfiltered order.findMany() -- which would dump every order on the
    // platform, PII included.
    it('returns [] without querying orders when ids is supplied but every entry is invalid and no storeId is given', async () => {
      const prisma = {
        order: { findMany: jest.fn() },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ ids: 'not-a-uuid,also-not-one' });

      expect(result).toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
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
    // This is the assertion that matters: a client that submits a low-ball
    // price must not get it stored. A test that only checks the response
    // shape (e.g. that `totals` exists) would still pass with the
    // vulnerability fully intact -- this one fails unless price_at_purchase
    // is actually read from the database row, not the request body.
    it('ignores a submitted price and total, storing the database price as price_at_purchase', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: 5, total: new Prisma.Decimal(20) });
      const createMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = {
        product: {
          findMany: jest.fn().mockResolvedValue([
            { id: PRODUCT_1, price: new Prisma.Decimal(20), currency: 'USD' },
          ]),
        },
        order: { create },
        orderItem: { createMany },
      } as any;
      const service = new OrdersService(prisma);

      await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        total: 0.01,
        items: [{ product_id: PRODUCT_1, quantity: 2, price: 0.01 }],
      } as any);

      // Stored price_at_purchase must equal the DATABASE price (20), not the
      // submitted 0.01.
      expect(createMany.mock.calls[0][0].data).toEqual([
        { order_id: 5, product_id: PRODUCT_1, quantity: 2, price_at_purchase: 20 },
      ]);
      // The order's legacy total is likewise the recomputed 40 (20 * 2),
      // not the submitted 0.01.
      expect(create.mock.calls[0][0].data.total).toBe(40);
    });

    it('creates the order with status pending and defaults payment_method to cash_on_delivery', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: 1, total: new Prisma.Decimal(40) });
      const prisma = {
        product: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: PRODUCT_1, price: new Prisma.Decimal(40), currency: 'USD' }]),
        },
        order: { create },
        orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      } as any;
      const service = new OrdersService(prisma);

      await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        items: [{ product_id: PRODUCT_1, quantity: 1, price: 40 }],
      } as any);

      expect(create.mock.calls[0][0].data).toMatchObject({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        status: 'pending',
        payment_method: 'cash_on_delivery',
      });
    });

    it('rejects an empty items array', async () => {
      const prisma = { product: { findMany: jest.fn() } } as any;
      const service = new OrdersService(prisma);

      await expect(
        service.create({
          customer_name: 'Juan',
          customer_email: 'juan@example.com',
          items: [],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('rejects an item whose product_id does not exist', async () => {
      const prisma = {
        product: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new OrdersService(prisma);

      await expect(
        service.create({
          customer_name: 'Juan',
          customer_email: 'juan@example.com',
          items: [{ product_id: PRODUCT_1, quantity: 1, price: 10 }],
        } as any),
      ).rejects.toMatchObject({
        response: { message: 'Uno o más productos no existen' },
      });
    });

    it.each([0, -1, 1.5])('rejects a quantity of %s', async (quantity) => {
      const prisma = {
        product: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: PRODUCT_1, price: new Prisma.Decimal(10), currency: 'USD' }]),
        },
      } as any;
      const service = new OrdersService(prisma);

      await expect(
        service.create({
          customer_name: 'Juan',
          customer_email: 'juan@example.com',
          items: [{ product_id: PRODUCT_1, quantity, price: 10 }],
        } as any),
      ).rejects.toMatchObject({
        response: {
          message: 'La cantidad de cada artículo debe ser un entero positivo',
        },
      });
    });

    it('returns a totals object keyed by currency for a two-currency cart', async () => {
      const prisma = {
        product: {
          findMany: jest.fn().mockResolvedValue([
            { id: PRODUCT_1, price: new Prisma.Decimal(10), currency: 'USD' },
            { id: PRODUCT_2, price: new Prisma.Decimal(100), currency: 'CUP' },
          ]),
        },
        order: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 9, total: new Prisma.Decimal(120) }),
        },
        orderItem: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        items: [
          { product_id: PRODUCT_1, quantity: 2, price: 10 },
          { product_id: PRODUCT_2, quantity: 1, price: 100 },
        ],
      } as any);

      expect(result.totals).toEqual({ USD: 20, CUP: 100 });
    });

    it('does not call orderItem.createMany when the request is rejected before insertion', async () => {
      const createMany = jest.fn();
      const prisma = {
        product: { findMany: jest.fn().mockResolvedValue([]) },
        orderItem: { createMany },
      } as any;
      const service = new OrdersService(prisma);

      await expect(
        service.create({
          customer_name: 'Juan',
          customer_email: 'juan@example.com',
          items: [{ product_id: PRODUCT_1, quantity: 1, price: 10 }],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(createMany).not.toHaveBeenCalled();
    });

    // Finding-style regression: create() returns the raw prisma.order.create()
    // row (no nested order_items), so `total` must still be coerced even
    // though this response path has no nesting to worry about.
    it('coerces the Decimal total on the returned order to a plain number', async () => {
      const prisma = {
        product: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: PRODUCT_1, price: new Prisma.Decimal(40), currency: 'USD' }]),
        },
        order: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 1, total: new Prisma.Decimal(40) }),
        },
        orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.create({
        customer_name: 'Juan',
        customer_email: 'juan@example.com',
        items: [{ product_id: PRODUCT_1, quantity: 1, price: 40 }],
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

    // I6: OrderUpdateAuthGuard deja pasar a un administrador sin más
    // comprobación, así que esta lista blanca es LO ÚNICO que hay entre un
    // token de administrador y un estado arbitrario en la base de datos.
    // Borrarla no ponía en rojo ninguna de las 228 pruebas. Se comprueba
    // aquí, en el servicio, y no sólo por HTTP: el @IsIn del DTO rechaza hoy
    // los mismos tres estados, así que una prueba e2e no distingue qué capa
    // rechazó -- ésta sí, y se pone en rojo en cuanto la comprobación
    // desaparece del servicio.
    describe('lista blanca de estados (I6)', () => {
      for (const status of ['confirmed', 'cancelled', 'cualquier cosa', '']) {
        it(`rechaza status: ${JSON.stringify(status)} con 400 y sin tocar la base de datos`, async () => {
          const update = jest.fn();
          const prisma = { order: { update } } as any;
          const service = new OrdersService(prisma);

          await expect(
            service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', status),
          ).rejects.toBeInstanceOf(BadRequestException);
          expect(update).not.toHaveBeenCalled();
        });
      }

      for (const status of ['pending', 'shipped', 'delivered']) {
        it(`acepta status: ${JSON.stringify(status)}`, async () => {
          const update = jest.fn().mockResolvedValue({ id: 1, status, total: 10 });
          const prisma = { order: { update } } as any;
          const service = new OrdersService(prisma);

          await expect(
            service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', status),
          ).resolves.toMatchObject({ status });
        });
      }
    });

    it('throws NotFoundException on a P2025 (zero-row update)', async () => {
      const prisma = {
        order: { update: jest.fn().mockRejectedValue(notFoundError) },
      } as any;
      const service = new OrdersService(prisma);

      await expect(service.update('99999999-9999-9999-9999-999999999999', 'shipped')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates a non-P2025 error unchanged', async () => {
      const dbError = new Error('connection terminated unexpectedly');
      const prisma = {
        order: { update: jest.fn().mockRejectedValue(dbError) },
      } as any;
      const service = new OrdersService(prisma);

      await expect(service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'shipped')).rejects.toBe(dbError);
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

      const result = await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'shipped');

      expect(typeof result.total).toBe('number');
      expect(result.total).toBe(40);
    });
  });
});
