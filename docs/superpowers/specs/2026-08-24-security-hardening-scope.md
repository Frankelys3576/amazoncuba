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
`req.store` — so there the change is a guard plus reading `req.store.id`. In Express it means
applying `authenticateSeller` and ignoring `req.query.storeId`.

**Watch for:** the port already reproduces Express's two-level filtering (which orders are
returned, then which line items within each order). Whatever replaces the query parameter must
keep both levels, or a seller sees other stores' line items on orders that span multiple stores.

---

## 3. No server-side admin auth — the root cause behind most findings

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

1. **Sequencing decision** (`backend/` vs `backend-nest/` vs both) — blocks everything else.
2. **#1 and #2 together.** Both are unauthenticated, both are in orders, and both are fixed by
   the same shift: derive trust from the server rather than the request body.
3. **#3.** Largest, and the prerequisite for closing the admin table properly.
4. **#4.** Smallest and independent; can land any time after the sequencing decision.

## Related

- Migration spec: `docs/superpowers/specs/2026-08-23-backend-nestjs-prisma-migration-design.md`
- Migration plan: `docs/superpowers/plans/2026-08-23-backend-nestjs-prisma-migration.md`
- Merge commit `fe02272` lists the defects caught during the port itself.
