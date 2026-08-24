import { Order, OrderItem, Product } from '@prisma/client';
import { coerceDecimalFields, toPlainNumber } from '../common/decimal.util';

// products.price/price_usd/rating_avg are the same Decimal/Decimal? columns
// products.service.ts coerces under its own local DECIMAL_FIELDS constant.
// Declared again here (not imported) because that constant is private to
// products.service.ts and, more importantly, formatProduct in
// product-format.util.ts also injects store_accepts_zelle/store_name/etc —
// fields Express's nested `products(*)` select in order.controller.js:35
// never returns, so reusing formatProduct here would add fields Express
// doesn't. This only needs the bare column list.
const PRODUCT_DECIMAL_FIELDS = ['price', 'price_usd', 'rating_avg'] as const;

export type OrderItemWithProduct = OrderItem & { product: Product | null };
export type OrderWithItems = Order & { order_items: OrderItemWithProduct[] };

// Express's getOrders selects '*, order_items(*, products(*))'
// (order.controller.js:35), embedding orders, order items, and nested
// products. All three levels carry Decimal columns — order.total,
// order_items.price_at_purchase, and products.price/price_usd/rating_avg —
// that PostgREST serializes as JSON numbers but Prisma returns as
// Prisma.Decimal instances (JSON-serialize as strings). Coerce at every
// nesting level so the response shape matches Express exactly.
// null/undefined pass through unchanged (never become 0).
export function formatOrder(order: OrderWithItems) {
  return {
    ...order,
    total: toPlainNumber(order.total) as number,
    order_items: order.order_items.map((item) => {
      // IMPORTANT 3: Express's nested select aliases the joined product as
      // `products` (order.controller.js:37: '*, order_items(*, products(*))'),
      // and seller-frontend/src/SellerOrders.jsx:30 reads item.products.name.
      // Prisma's relation is named `product` (schema.prisma), so the key
      // must be renamed on the way out — leaving it as `product` means every
      // line item silently renders as "Producto {id}" in the seller
      // dashboard. Rename, don't just add: Express never returns a
      // `product` key here.
      const { product, ...rest } = item;
      return {
        ...rest,
        price_at_purchase: toPlainNumber(item.price_at_purchase) as number,
        products: product
          ? coerceDecimalFields(product, PRODUCT_DECIMAL_FIELDS)
          : product,
      };
    }),
  };
}
