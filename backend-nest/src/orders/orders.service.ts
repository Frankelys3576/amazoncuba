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

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { storeId?: string; ids?: string }) {
    let orderIds: number[] = query.ids
      ? query.ids
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : [];

    // Named risk, filter 1: narrow which orders are returned at all, by
    // finding order_items whose product belongs to this store
    // (order.controller.js:13-33). If no orders match, return [] early
    // without ever querying `orders`.
    let storeId: number | undefined;
    if (query.storeId) {
      storeId = Number(query.storeId);
      const items = await this.prisma.orderItem.findMany({
        where: { product: { store_id: storeId } },
        select: { order_id: true },
      });
      // order_id is a Prisma BigInt column — comes back as a JS `bigint` at
      // runtime, not `number`. Number(...) it before comparing against the
      // plain-number ids parsed from `orderIds`/`query.ids`.
      const storeOrderIds = [...new Set(items.map((i) => Number(i.order_id)))];

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
    // stores' line items. product.store_id is also a Prisma BigInt column,
    // so Number(...) it before the `===` — a bare bigint/number `===` is
    // always false and would silently empty every order's order_items.
    if (storeId !== undefined) {
      const scopedStoreId = storeId;
      return formatted.map((order) => ({
        ...order,
        order_items: order.order_items.filter(
          (item) => Number(item.product?.store_id) === scopedStoreId,
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

  async update(id: number, status: string) {
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
