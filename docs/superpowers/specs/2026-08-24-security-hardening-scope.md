# Security Hardening — Scope (sub-project 2/4)

> Status: **scoping only**. No implementation decisions are locked in. This document records
> what was found, the evidence, and the shape of the work — it is the input to a brainstorming
> and planning pass, not a plan.

## Where these came from

Every finding below was surfaced during the `backend-nest` NestJS + Prisma migration
(sub-project 1/4, merged as `fe02272`) and verified against the running Express source, not
inferred. **None is a regression introduced by that migration** — all four are live in
production today via `backend/`, and the port reproduces them faithfully because porting
faithfully was that project's binding constraint.

## The constraint that shapes all of this work

`backend/` still serves 100% of traffic. `backend-nest/` is merged but deployed nowhere and
no frontend points at it.

**Fixing only `backend-nest/` changes nothing for users.** Each item below therefore has to
resolve one of:

- fix in `backend/` now (fast, but adds work to the codebase being retired), or
- fix in `backend-nest/` and cut the relevant frontend over (slower, but the fix lands once), or
- fix in both (safest during the overlap; costs double implementation).

That sequencing choice is the first thing to settle, and it applies to all four items at once
rather than per-item.

---

## 1. Order price tampering — highest financial impact

**What:** `total` and each line item's `price_at_purchase` are taken from the request body and
written to the database. Nothing ever compares them to the product's actual price.

**Evidence:** `backend/src/controllers/order.controller.js:68-90` destructures `total` from
`req.body` and inserts it directly; `price_at_purchase: item.price` comes from the client's
own item payload. `POST /api/orders` has no auth (`backend/src/routes/order.routes.js:9`).

**Impact:** A crafted request buys anything at any price. `total: 0.01` is accepted and stored
as the order's real value. No authentication is needed to do it.

**Shape of the fix:** the server resolves each `product_id`, reads the real `price`/`price_usd`
from the database, computes the line totals and the order total itself, and ignores whatever
the client sent. Client-supplied prices should not be accepted at all rather than validated.

**Watch for:** the storefront currently computes and displays a total before submitting; if the
server-computed total can differ (stale cart, price changed mid-session, currency selection),
decide deliberately whether that is a hard rejection or a silent correction, and make the
storefront surface it either way. `Product.price` is `Decimal` — see the Decimal notes in the
migration ledger before doing arithmetic on it.

---

## 2. `GET /api/orders` IDOR over customer PII

**What:** No authentication, and the store scope comes from a caller-supplied query parameter.

**Evidence:** `backend/src/routes/order.routes.js:6` mounts `getOrders` with no middleware.
`backend/src/controllers/order.controller.js:13-33` reads `storeId` straight off `req.query`
and returns every order matching it.

**Impact:** Any anonymous caller can pass an arbitrary `storeId` and read that store's complete
order history — `customer_name`, `customer_email`, `customer_phone` and delivery address are
all on the order row. This is bulk customer PII disclosure, trivially enumerable by iterating
integer store ids.

**Shape of the fix:** derive the store from the authenticated caller instead of trusting a
query parameter. `backend-nest/` already has the machinery — `SellerAuthGuard` populates
`req.store` — so for the *seller* path the change is a guard plus reading `req.store.id`. In
Express it means applying `authenticateSeller` and ignoring `req.query.storeId`.

**This endpoint has a second, non-seller caller, and it changes the fix.** `admin-frontend`
consumes it to show a store's orders in the admin directory
(`admin-frontend/src/AdminDirectory.jsx` calls `getOrders({ storeId: store.id })`). An admin is
not the store's owner and would have no `req.store`, so "derive the store from the caller"
breaks that page outright. The endpoint needs two legitimate access paths:

- **seller** — scope forced to their own store, `storeId` from the session, query parameter ignored;
- **admin** — may pass an explicit `storeId`, but only once there is a verified admin identity
  to check it against.

The admin half cannot be built before #3 exists. **#3 is therefore a prerequisite for #2, not a
parallel track** — see Suggested order.

**Watch for:** the port already reproduces Express's two-level filtering (which orders are
returned, then which line items within each order). Whatever replaces the query parameter must
keep both levels, or a seller sees other stores' line items on orders that span multiple stores.
The admin path likely wants the *unfiltered* second level (an admin should see the whole order,
not one store's slice), so the two paths differ in more than just how the scope is derived.

**Note on how this second caller surfaced:** it was found in uncommitted work in progress on
`AdminDirectory.jsx` during the migration's merge, not in the migration itself. That work is
still in flight, so confirm the call shape before building against it — but the dependency it
reveals holds regardless of whether that particular page ships.

---

## 3. No server-side admin auth — the root cause, and a prerequisite for #2

**What:** There is no admin authentication anywhere in the system. `admin-frontend` stores a
hardcoded `'master_token'` string in `localStorage` and no server ever verifies it.

**Evidence:** `admin-frontend/src/AdminAuth.jsx`; documented in `CLAUDE.md` as an existing
architectural fact. The endpoints left unguarded as a direct consequence:

| Endpoint | Exposure |
|---|---|
| `DELETE /api/users/:id` | delete any user account |
| `PUT /api/users/:id` | change any user's email or password |
| `POST /api/settings` | flip platform settings, e.g. `auto_approve_sellers` |
| `PUT /api/stores/:id/status` | approve or reject any store |
| `PUT /api/stores/:id/zelle` | rewrite any store's payment details |
| `GET /api/stores/:id/admin-details`, `/stats` | read any store's business metrics |
| `POST /api/upload` | anonymous upload into the public `store-images` bucket |

`PUT /api/stores/:id/zelle` deserves particular attention: it is unguarded while the routes
immediately above and below it in the same file *are* guarded
(`backend/src/routes/store.routes.js:13-16`), which reads more like an oversight than a
decision. Rewriting a store's payment details is a direct route to payment redirection.

**Shape of the fix:** a real admin identity with server-side verification, then guards on the
table above. `backend-nest/` is the better place to build it — it already has Passport, a guard
abstraction, and DI — whereas Express has no authz layer at all. Worth deciding early whether
admins are Supabase Auth users with a role claim (reuses the existing tenant) or a separate
mechanism.

**Watch for:** `POST /api/upload` is used by seller *registration*, before any session exists,
so it cannot simply be put behind the seller guard. It likely needs rate limiting and a size/
type budget rather than authentication.

**Also gates #2.** Beyond the table above, the admin identity built here is what lets
`GET /api/orders` distinguish "a seller asking for their own orders" from "an admin asking for
a specific store's orders." Until it exists, #2 can only be half-fixed — the seller path can be
locked down, but the admin path either stays unauthenticated or the admin directory breaks.
Scoping #3 should therefore include that read path explicitly, not just the write endpoints in
the table.

---

## 4. Pending stores appear in public listings

**What:** The public store listing applies no status filter, so stores awaiting approval are
publicly visible.

**Evidence:** `backend/src/controllers/store.controller.js:27-67` — `getStores` filters
optionally on `store_type`, then province/municipality/`q` in JS. There is no `status` filter
anywhere in it. `CLAUDE.md` documents the intended behaviour ("public listings should filter to
`approved`"), so the code and the documented design disagree.

**Impact:** Lower severity than the others — a visibility/moderation bug rather than a
compromise — but it defeats the pending→approved workflow that `AdminStores.jsx` exists to
operate.

**Note on how this was found:** during the migration I initially instructed the implementer to
add the `approved` filter to the port, treating `CLAUDE.md` as authoritative. That was wrong —
it would have been an unreviewed behaviour change smuggled in under a port. The implementer
flagged the contradiction rather than guessing, and the port was left matching Express. Fixing
it is a deliberate product change and belongs here.

**Watch for:** confirm whether any legitimate surface *depends* on pending stores being
listed (a seller previewing their own store before approval is the plausible one) before
filtering them out globally.

---

## Suggested order

Revised — an earlier draft of this document put #1 and #2 together and #3 after them. That was
wrong: #2 has an admin caller (see #2's "second, non-seller caller"), so it cannot be finished
before #3 exists.

1. **Sequencing decision** (`backend/` vs `backend-nest/` vs both) — blocks everything else.
2. **#1 — order price tampering.** Genuinely independent: it is fixed entirely server-side by
   computing totals from product rows, and needs no identity work. Highest financial impact, so
   it should not wait behind the auth build. Do it first.
3. **#3 — admin auth.** Largest, and now on the critical path: it gates both the admin write
   endpoints and #2's admin read path.
4. **#2 — orders IDOR.** The seller half could technically land with #1, but splitting it means
   touching the same endpoint twice and shipping an interim state where the admin path is still
   open. Cleaner to do it once, after #3.
5. **#4 — pending stores in public listings.** Smallest and fully independent; can land any
   time after the sequencing decision, including in parallel with the others.

If #2's exposure is judged too severe to wait on #3, the interim option is to lock the seller
path immediately and leave the admin path open behind a documented, time-boxed exception —
but that is a deliberate risk acceptance, not a fix, and it should be recorded as one.

## Related

- Migration spec: `docs/superpowers/specs/2026-08-23-backend-nestjs-prisma-migration-design.md`
- Migration plan: `docs/superpowers/plans/2026-08-23-backend-nestjs-prisma-migration.md`
- Merge commit `fe02272` lists the defects caught during the port itself.
