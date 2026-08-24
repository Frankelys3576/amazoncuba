import { Prisma } from '@prisma/client';

// Prisma types Postgres `numeric`/`decimal` columns as `Decimal` (non-null)
// or `Decimal?` (nullable), so at runtime those fields are `Prisma.Decimal`
// instances — truthy even when they hold 0, and JSON-serialized as strings
// — rather than the plain JS numbers PostgREST gave Express. Coerce to a
// number so both the JSON response shape and any falsy-0 fallback chains
// match Express's behavior. null/undefined pass through unchanged so they
// don't get turned into 0.
export function toPlainNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}
