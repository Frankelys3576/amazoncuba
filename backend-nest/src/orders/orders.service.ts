import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { coerceDecimalFields } from '../common/decimal.util';
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
    // must get nothing back -- never fall through to the unfiltered query
    // below. Without this, an unauthenticated GET /api/orders?ids=garbage
    // (no storeId) would return every order on the platform, PII
    // (customer_name/email/phone/address) included. Do not "simplify" this
    // away, and keep this in sync with order.controller.js's copy -- the two
    // backends must agree on this or the eventual cutover reopens the hole.
    if (query.ids && orderIds.length === 0 && !query.storeId) {
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

  async create(dto: CreateOrderDto) {
    const order = await this.prisma.order.create({
      data: {
        customer_name: dto.customer_name,
        customer_email: dto.customer_email,
        customer_address: dto.customer_address,
        customer_phone: dto.customer_phone,
        total: dto.total,
        status: 'pending',
        payment_method: dto.payment_method || 'cash_on_delivery',
        payment_proof_url: dto.payment_proof_url,
      },
    });

    if (dto.items && dto.items.length > 0) {
      await this.prisma.orderItem.createMany({
        data: dto.items.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: item.price,
        })),
      });
    }

    return {
      message: 'Pedido creado exitosamente',
      order: coerceDecimalFields(order, ORDER_DECIMAL_FIELDS),
    };
  }

  async update(id: string, status: string) {
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
