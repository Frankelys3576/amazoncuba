import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { coerceDecimalFields, toPlainNumber } from '../common/decimal.util';
import { formatOrder } from './order-format.util';

// orders.total is the only Decimal column on the bare (non-nested) order
// row returned by create()/update() — order_items/product nesting is only
// present on findAll(), which uses formatOrder instead.
const ORDER_DECIMAL_FIELDS = ['total'] as const;

// Matches the same shape SpanishParseUuidPipe validates route ids against.
// query.ids is an unauthenticated, unvalidated query param (used for
// customer order tracking) -- anything that isn't uuid-shaped is dropped
// here rather than handed to Prisma, where it would raise a Postgres
// "invalid input syntax for type uuid" error instead of just being ignored.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Los tres únicos estados que usa la aplicación. Espejo de ORDER_STATUSES en
// order.controller.js. UpdateOrderDto's @IsIn now carries the same three
// (I6: it used to allow a wider legacy set, 'confirmed'/'cancelled'), but
// this check stays: it is the allowlist the admin path runs into, since
// OrderUpdateAuthGuard lets an admin through unconditionally, and it is what
// keeps the two backends returning the same 400 for the same body even if
// the DTO drifts. Borrar ESTA comprobación se pone en rojo con el bloque
// "lista blanca de estados (I6)" de orders.service.spec.ts; borrar además el
// @IsIn del DTO se pone en rojo con las pruebas e2e 8 y 9 de
// test/orders.e2e-spec.ts.
const ORDER_STATUSES = ['pending', 'shipped', 'delivered'];

// Tope por línea de pedido. Espejo de MAX_ITEM_QUANTITY en
// order.controller.js: sin él, quantity: 1e21 pasaba el Number.isInteger
// (1e21 SÍ es entero para JavaScript) y el pedido se creaba con
// total: 2e+22.
const MAX_ITEM_QUANTITY = 1000;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { storeId?: string; ids?: string }) {
    // I5: `.map(trim)` before the uuid test, matching
    // order.controller.js:11-14. Express trimmed and Nest did not, so
    // `?ids=<uuid>,%20<uuid>` returned two orders on Express and one on
    // Nest — a shopper's order-tracking link would show a different number
    // of orders depending on which backend served it.
    let orderIds: string[] = query.ids
      ? query.ids
          .split(',')
          .map((id) => id.trim())
          .filter((id) => UUID.test(id))
      : [];

    // Mirrors the Express fix in commit 04bc48e ("Return empty result for
    // malformed order ids instead of leaking all orders"). GET
    // /api/orders?ids=<garbage> is unauthenticated (frontend/src/services/
    // api.js uses it for customer order tracking). If the caller explicitly
    // asked for specific order ids but none of them were valid uuids, they
    // must get nothing back -- never fall through to a broader query.
    // Without this, an unauthenticated GET /api/orders?ids=garbage would
    // return every order on the platform, PII
    // (customer_name/email/phone/address) included. Do not "simplify" this
    // away, and keep this in sync with order.controller.js's copy -- the two
    // backends must agree on this or the eventual cutover reopens the hole.
    //
    // I6: this used to carry an extra `&& !query.storeId`, so the guard was
    // closed only for the no-storeId case -- `?storeId=<uuid>&ids=garbage`
    // still returned every order for that store, PII included, while the
    // comment read as though the leak was shut. Dropped in both backends:
    // when both params are supplied and the ids ARE valid, the store branch
    // below already intersects them, so an empty valid-id set returning
    // nothing is the limit case of that intersection -- falling through to
    // the whole store was the anomaly. No client sends both params.
    if (query.ids && orderIds.length === 0) {
      return [];
    }

    // Named risk, filter 1: narrow which orders are returned at all, by
    // finding order_items whose product belongs to this store
    // (order.controller.js:13-33). If no orders match, return [] early
    // without ever querying `orders`.
    let storeId: string | undefined;
    if (query.storeId) {
      storeId = query.storeId;
      const items = await this.prisma.orderItem.findMany({
        where: { product: { store_id: storeId } },
        select: { order_id: true },
      });
      const storeOrderIds = [
        ...new Set(
          items
            .map((i) => i.order_id)
            .filter((id): id is string => id !== null),
        ),
      ];

      orderIds =
        orderIds.length > 0
          ? orderIds.filter((id) => storeOrderIds.includes(id))
          : storeOrderIds;

      if (orderIds.length === 0) return [];
    }

    const orders = await this.prisma.order.findMany({
      where: orderIds.length > 0 ? { id: { in: orderIds } } : undefined,
      include: { order_items: { include: { product: true } } },
      orderBy: { created_at: 'desc' },
    });

    const formatted = orders.map(formatOrder);

    // Named risk, filter 2: also filter the order_items *within* each
    // returned order down to this store's own line items
    // (order.controller.js:49-55), so a seller viewing an order that spans
    // multiple stores only sees their own items. Dropping this leaks other
    // stores' line items.
    if (storeId !== undefined) {
      const scopedStoreId = storeId;
      return formatted.map((order) => ({
        ...order,
        // formatOrder (IMPORTANT 3) renames each item's joined product from
        // Prisma's `product` key to Express's `products` alias, so this
        // scoping filter must read the post-rename key too.
        order_items: order.order_items.filter(
          (item) => (item as { products?: { store_id?: unknown } }).products?.store_id === scopedStoreId,
        ),
      }));
    }

    return formatted;
  }

  // El total y los precios NO se leen del DTO. Antes sí: un cliente podía
  // enviar total: 0.01 y el pedido se guardaba con ese importe.
  async create(dto: CreateOrderDto) {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('El pedido no tiene artículos');
    }

    const productIds = [...new Set(dto.items.map((item) => item.product_id))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, currency: true },
    });

    const byId = new Map(products.map((p) => [p.id, p]));
    if (productIds.some((id) => !byId.has(id))) {
      throw new BadRequestException('Uno o más productos no existen');
    }

    // Los importes se calculan por moneda: cada producto lleva la suya y un
    // carrito puede mezclarlas, así que un único número no significaría nada.
    const totals: Record<string, number> = {};
    const lines: { product_id: string; quantity: number; price_at_purchase: number }[] = [];

    for (const item of dto.items) {
      const product = byId.get(item.product_id)!;
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException(
          'La cantidad de cada artículo debe ser un entero positivo',
        );
      }

      if (quantity > MAX_ITEM_QUANTITY) {
        throw new BadRequestException(
          `La cantidad de cada artículo no puede superar ${MAX_ITEM_QUANTITY} unidades`,
        );
      }

      const unitPrice = toPlainNumber(product.price) as number;
      const currency = product.currency || 'USD';

      totals[currency] = (totals[currency] || 0) + unitPrice * quantity;
      lines.push({ product_id: product.id, quantity, price_at_purchase: unitPrice });
    }

    // orders.total es NOT NULL y se conserva por compatibilidad: es la suma
    // sin distinguir moneda, exactamente lo que se guardaba antes. El dato
    // bueno es `totals`; los frontales deben leer ese.
    const legacyTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);

    const order = await this.prisma.order.create({
      data: {
        customer_name: dto.customer_name,
        customer_email: dto.customer_email,
        customer_address: dto.customer_address,
        customer_phone: dto.customer_phone,
        total: legacyTotal,
        status: 'pending',
        payment_method: dto.payment_method || 'cash_on_delivery',
        payment_proof_url: dto.payment_proof_url,
      },
    });

    await this.prisma.orderItem.createMany({
      data: lines.map((line) => ({
        order_id: order.id,
        product_id: line.product_id,
        quantity: line.quantity,
        price_at_purchase: line.price_at_purchase,
      })),
    });

    return {
      message: 'Pedido creado exitosamente',
      order: coerceDecimalFields(order, ORDER_DECIMAL_FIELDS),
      totals,
    };
  }

  async update(id: string, status: string) {
    if (!ORDER_STATUSES.includes(status)) {
      throw new BadRequestException('Estado de pedido no válido');
    }

    try {
      const order = await this.prisma.order.update({
        where: { id },
        data: { status },
      });
      return coerceDecimalFields(order, ORDER_DECIMAL_FIELDS);
    } catch (error) {
      // Only a Prisma P2025 (zero-row update — matches Express's `data.length
      // === 0` 404 check) becomes "Pedido no encontrado". Anything else (DB
      // outage, constraint violation) must propagate so the global filter
      // renders a 500, not a misleading 404.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Pedido no encontrado');
      }
      throw error;
    }
  }
}
