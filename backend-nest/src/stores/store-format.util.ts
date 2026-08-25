import { Store } from '@prisma/client';
import { toPlainNumber } from '../common/decimal.util';

type ZelleInfo = {
  province?: string | null;
  municipality?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  price_per_night?: number | null;
  gallery?: string[];
};

// Espejo del whitelist en backend/src/controllers/store.controller.js. Antes
// hacía `...store`, así que la respuesta pública incluía todas las columnas:
// phone, el blob zelle_info, y tras la migración user_id y las columnas
// legacy_*. Ahora se enumera lo que el frontal usa.
export type FormattedStore = {
  id: Store['id'];
  name: Store['name'];
  description: Store['description'];
  logo_url: Store['logo_url'];
  banner_url: Store['banner_url'];
  status: Store['status'];
  created_at: Store['created_at'];
  store_type: Store['store_type'];
  slogan: Store['slogan'];
  phone: Store['phone'];
  is_open: Store['is_open'];
  has_delivery: Store['has_delivery'];
  slug: Store['slug'];
  opening_time: Store['opening_time'];
  closing_time: Store['closing_time'];
  accepts_zelle: Store['accepts_zelle'];
  store_number: Store['store_number'];
  province: string;
  municipality: string;
  address: string;
  lat: number | null;
  lng: number | null;
  price_per_night: number | null;
  gallery: string[];
};

export function formatStore(store: Store): FormattedStore;
export function formatStore(store: null | undefined): null;
export function formatStore(store: Store | null | undefined): FormattedStore | null {
  if (!store) return null;
  const info = (store.zelle_info as ZelleInfo) || {};
  return {
    id: store.id,
    name: store.name,
    description: store.description,
    logo_url: store.logo_url,
    banner_url: store.banner_url,
    status: store.status,
    created_at: store.created_at,
    store_type: store.store_type,
    slogan: store.slogan,
    phone: store.phone,
    is_open: store.is_open,
    has_delivery: store.has_delivery,
    slug: store.slug,
    opening_time: store.opening_time,
    closing_time: store.closing_time,
    accepts_zelle: store.accepts_zelle,
    store_number: store.store_number,
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
