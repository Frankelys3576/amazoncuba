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

// For raw-row responses that don't go through a full `format*` helper
// (e.g. create/update/delete endpoints that intentionally return the bare
// Prisma row, matching Express's bare `res.json(data[0])`). Coerces only
// the named Decimal columns, leaving every other field on the row
// untouched — using the full `format*` helper here would additionally
// reshape the response (adding joined/derived fields Express never
// returns on these routes), trading a type divergence for a shape
// divergence.
export function coerceDecimalFields<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  fields: readonly K[],
): T {
  const result = { ...row };
  for (const field of fields) {
    result[field] = toPlainNumber(
      row[field] as Prisma.Decimal | number | null | undefined,
    ) as T[K];
  }
  return result;
}
