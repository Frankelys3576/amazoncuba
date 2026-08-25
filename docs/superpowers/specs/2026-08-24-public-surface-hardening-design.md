# Public surface hardening — design

**Status:** approved, not yet implemented
**Closes:** findings #1 and #4 from `2026-08-24-security-hardening-scope.md`, plus two
vulnerabilities not in that document: an unauthenticated order-status write and the
absence of any rate limiting.
**Base branch:** `security-admin-lockdown` — **not `main`**. This work needs
`authenticateAdmin` and mirrors `authorizeOrdersQuery`, neither of which exists on `main`.

## Problem

Four vulnerabilities are live in production and, unlike the seller takeover and the open
admin API, none of them is blocked on the UUID migration. They can ship while the database
work waits.

1. **`PUT /api/orders/:id` is unauthenticated.** Anyone can set any status on any order.
2. **`createOrder` trusts the client for money.** `total` and every `price_at_purchase`
   come straight from the request body, with no lookup against the `products` table.
3. **`GET /api/stores` leaks everything.** No status filter, so `pending` and `rejected`
   stores are publicly listed, and `formatStore` spreads `...store`, returning every
   column — `phone`, `zelle_info`, and post-migration `user_id` and `legacy_*`.
4. **No rate limiting anywhere.** Public review posting (with `rating` unbounded),
   view registration, 5 MB uploads and login are all unthrottled.

## Constraints

- `backend/` (Express) serves all production traffic and **deploys as Vercel serverless
  functions**. In-process state does not reliably persist across invocations.
- `backend-nest/` is merged but deployed nowhere. It must stay at parity so the eventual
  cutover does not reopen anything.
- `backend/` has **no test runner**. Verification is `backend/smoke_admin_auth.mjs`-style
  scripts against a local Supabase stack, plus reading.
- User-facing strings and API error messages are in **Spanish**.
- **No database schema change.** Coupling these fixes to a migration is precisely what we
  are avoiding; migration 002 is still unapplied.

## Decisions

### Store listing (#3 above)

`GET /api/stores` returns **`approved` stores only** to anonymous and seller callers. A
caller presenting a valid admin token receives every status.

**This is load-bearing, not a nicety.** `admin-frontend/src/AdminStores.jsx:35` calls the
same public `getStores()` and filters by status client-side, so a naive approved-only
filter would break store approval outright — the admin could never see a pending store to
approve. `admin-frontend`'s `getStores` must therefore start sending the admin token, which
it does not today. This is the same seam that produced the "ver pedidos" logout bug: an
endpoint locked down without checking who already calls it.

`formatStore` stops spreading `...store` and returns an explicit whitelist.

- **Dropped:** `user_id`, every `legacy_*` column, and the raw `zelle_info` blob.
- **Kept:** the derived `province`, `municipality`, `address`, `lat`, `lng`,
  `price_per_night` and `gallery` — `formatStore` already computes these *from*
  `zelle_info`, so dropping the raw blob loses nothing the storefront reads — plus
  `accepts_zelle` and `phone`, which are deliberately public contact and payment-method
  data the storefront displays.

### Order status authorization (#1 above)

Three callers, three rules, structured like the existing `authorizeOrdersQuery`:

| Caller | Proof | May set |
|---|---|---|
| Customer | knows the order id | `delivered` only |
| Seller | valid session, owns a product in the order | fulfilment statuses |
| Admin | valid admin token | any status |

Today anyone can set **any** status on **any** order by walking sequential integer ids.

The customer path stays credential-free, which is a deliberate capability model: knowing
the id *is* the credential. That is only meaningful once ids are unguessable, so like the
`?ids=` path it depends on the UUID cutover. The code already rejects non-uuid ids, so the
two land together and neither is weaker than the other in the meantime.

Mirrored in `backend-nest` so the two backends stay identical.

### Order totals (#2 above)

The server stops trusting the client for money. On `createOrder` it:

1. ignores the submitted `total` and every submitted `item.price`;
2. looks each product up by id and **snapshots the price from the database** into
   `price_at_purchase`;
3. rejects the order if a referenced product does not exist;
4. computes totals **per currency** and returns them as
   `totals: { "USD": 45.00, "CUP": 12000 }`.

**No schema change.** `orders.total` is `NOT NULL`, so it continues to receive today's
single summed number as a legacy field; API responses gain the authoritative `totals`
object, and the frontends move to it. A schema change here would couple this security fix
to a database migration, which is the coupling this whole batch exists to avoid.

**Known limitation, stated rather than hidden:** currency is read from the product at
display time, not snapshotted onto `order_items`. If a seller later changes a product's
currency, historical orders will report the new one. The honest fix is an
`order_items.currency` snapshot column, which is a schema change and therefore belongs with
a later migration.

Per-currency totals are the right model because a cart can genuinely mix currencies: each
product carries one seller-chosen currency, the storefront displays each in its own, and
`Checkout.jsx` already concedes the problem in a comment — *"Asumimos USD para total mixto
o principal"*.

### Rate limiting (#4 above)

Applied to `POST /api/products/:id/reviews`, `POST /api/products/:id/view`,
`POST /api/upload` and `POST /api/auth/login`. Additionally, `rating` is clamped to 1–5
(today it is unbounded, so a single request can skew a product's average arbitrarily) and
`comment` is length-capped.

**The limit is approximate, and that is a deliberate trade.** On Vercel serverless, an
in-process counter does not hold across instances, so `express-rate-limit`'s memory store
bounds abuse per instance rather than globally. It raises the cost of review spam, view
inflation, upload flooding and login brute force by a large factor for one dependency and
no new infrastructure. A genuinely enforced global limit needs a shared store — Upstash
Redis via the Vercel marketplace — which is real money and a new dependency, and is not
warranted at this platform's size. **Do not describe these limits as guarantees.**

## Out of scope

- **`POST /api/upload`'s authentication.** All three frontends call it, customers included,
  for payment proofs. Rate limiting reduces the flooding and cost risk; deciding who may
  upload needs its own design.
- **The `accepts_zelle → 'CUP'` currency override** at
  `seller-frontend/src/SellerProducts.jsx:109`, which overrides the seller's chosen
  currency whenever their store accepts Zelle. It looks like a bug and it affects pricing,
  but it is a product decision, not a vulnerability.
- **Stock enforcement.** `products.stock` exists and is never decremented, so the platform
  can oversell. A real problem, but a business-logic one.
- Findings #0, #2 and #3 from the scope document, already fixed and awaiting deployment.

## Testing

Extend the existing smoke-script pattern, run against a local Supabase stack:

- **Store listing:** anonymous and seller callers see only `approved`; an admin token sees
  `pending` and `rejected` too; the response contains no `user_id`, no `legacy_*` and no
  raw `zelle_info`.
- **Order status:** an anonymous caller may set `delivered` and **may not** set any other
  status; a seller may set fulfilment statuses on an order containing their product and
  **not** on an order that does not; an admin may set any.
- **Order totals:** an order submitted with `total: 0.01` and `price: 0.01` is stored with
  the **database** prices, and the returned `totals` reflect them; a mixed-currency cart
  yields one entry per currency; an order naming a nonexistent product is rejected.
- **Rate limiting:** the limit triggers on repeated requests to each of the four endpoints;
  `rating: 999` and `rating: -1` are rejected.

Every one of these assertions must fail if the protection it covers is removed. NestJS
additions get unit and e2e coverage, and — as with the admin work — each new guard must be
removed in turn to confirm the suite goes red.

## Deployment note

This branch depends on `security-admin-lockdown`. It ships after, or with, that work; it
cannot ship before it.
