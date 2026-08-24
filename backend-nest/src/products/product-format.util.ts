import { Product, Store } from '@prisma/client';
import { toPlainNumber } from '../common/decimal.util';

// products.service.ts's STORE_INCLUDE only selects these fields off the
// joined store (not the full Store row), so the type here mirrors that
// selection rather than the full Prisma Store type.
type ProductStore = Pick<
  Store,
  'id' | 'accepts_zelle' | 'has_delivery' | 'name' | 'phone' | 'slug'
>;

type ProductWithStore = Product & { store?: ProductStore | null };

// The real `products` table has no `store_name`/`store_phone`/`store_slug`
// columns (confirmed against the live schema in Task 2) — Express's
// `item.store_name || item.stores?.name` fallback always evaluated to the
// right-hand side in production, since `item.store_name` was always
// `undefined`. Not carried into this typed Prisma version: these fields are
// derived from the joined `store` relation only.
export const formatProduct = (product: ProductWithStore) => {
  // IMPORTANT 3 (symmetry): Express selects the joined store as `stores`
  // (product.controller.js: '*, stores(accepts_zelle, name, phone, slug,
  // has_delivery)'), while STORE_INCLUDE's Prisma key is `store`. Was
  // harmless before this rename because every current consumer
  // (ProductCard.jsx, DealProductCard.jsx) reads the store_* derived fields
  // first and only falls back to `stores?.x` — a fallback that used to
  // always be undefined here. Rename for parity with Express's actual
  // response shape (and to make that fallback actually work), rather than
  // leaving a divergent key sitting next to it.
  const { store, ...rest } = product;
  return {
    ...rest,
    // Ruling 1: schema.prisma types Product.price as non-null Decimal, plus
    // price_usd/rating_avg as Decimal?. At runtime these are Prisma.Decimal
    // instances (truthy even at 0, JSON-serializes as a string) rather than
    // plain JS numbers. Coerce all three so every product listing/detail
    // response serializes price as a JSON number, matching what PostgREST
    // gave Express. null/undefined stay null/undefined, never become 0.
    price: toPlainNumber(product.price) as number,
    price_usd: toPlainNumber(product.price_usd),
    rating_avg: toPlainNumber(product.rating_avg),
    store_accepts_zelle: store?.accepts_zelle === true,
    store_has_delivery: store?.has_delivery === true,
    store_name: store?.name,
    store_phone: store?.phone,
    store_slug: store?.slug || store?.id,
    stores: store,
  };
};
