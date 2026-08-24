import { Prisma, Store } from '@prisma/client';

type ZelleInfo = {
  province?: string | null;
  municipality?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  price_per_night?: number | null;
  gallery?: string[];
};

export type FormattedStore = Omit<
  Store,
  'province' | 'municipality' | 'address' | 'lat' | 'lng' | 'price_per_night'
> & {
  province: string;
  municipality: string;
  address: string;
  lat: number | null;
  lng: number | null;
  price_per_night: number | null;
  gallery: string[];
};

// Prisma types `price_per_night` as `Decimal?`, so at runtime the direct
// column is a Prisma.Decimal instance (truthy even when it holds 0, and
// JSON-serializes as a string) rather than the plain JS number PostgREST
// gave Express. Coerce it to a number *before* the `||` fallback chain so
// both the JSON response shape and Express's falsy-0-falls-back-to-
// zelle_info behavior are preserved. null/undefined pass through unchanged
// so they don't get turned into 0.
function toPlainNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

export function formatStore(store: Store): FormattedStore;
export function formatStore(store: null | undefined): null;
export function formatStore(store: Store | null | undefined): FormattedStore | null {
  if (!store) return null;
  const info = (store.zelle_info as ZelleInfo) || {};
  return {
    ...store,
    province: store.province || info.province || '',
    municipality: store.municipality || info.municipality || '',
    address: store.address || info.address || '',
    lat: store.lat ?? info.lat ?? null,
    lng: store.lng ?? info.lng ?? null,
    // info.price_per_night comes from the zelle_info JSON blob, which Express
    // writes verbatim from req.body (see store.controller.js
    // updateStoreProfile) without any numeric coercion — so it is already
    // whatever JSON type the client sent (normally a number). No additional
    // coercion is applied here either, to match Express's behavior exactly.
    price_per_night:
      toPlainNumber(store.price_per_night) || info.price_per_night || null,
    gallery: info.gallery || [],
  };
}
