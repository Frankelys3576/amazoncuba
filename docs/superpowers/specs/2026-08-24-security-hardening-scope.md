# Security Hardening — Scope (sub-project 2/4)

> Status: **scoping only**. No implementation decisions are locked in. This document records
> what was found, the evidence, and the shape of the work — it is the input to a brainstorming
> and planning pass, not a plan.

## Where these came from

Findings #1-#4 were surfaced during the `backend-nest` NestJS + Prisma migration (sub-project
1/4, merged as `fe02272`). #0 was found afterwards, by a security scan of the pushed branch.
All were verified against the running Express source, not inferred.

**None is a regression introduced by that migration** — all five are live in production today
via `backend/`, and the port reproduces them faithfully because porting faithfully was that
project's binding constraint. In #0's case the port is in fact *stricter* than Express, and
still exploitable.

## The constraint that shapes all of this work

`backend/` still serves 100% of traffic. `backend-nest/` is merged but deployed nowhere and
no frontend points at it.

**Fixing only `backend-nest/` changes nothing for users.** Each item below therefore has to
resolve one of:

- fix in `backend/` now (fast, but adds work to the codebase being retired), or
- fix in `backend-nest/` and cut the relevant frontend over (slower, but the fix lands once), or
- fix in both (safest during the overlap; costs double implementation).

That sequencing choice applies to #1-#4 at once rather than per-item. **#0 is the exception:
it must be fixed in `backend/` regardless, because that is what serves traffic today.**

---

## 0. Seller account takeover via the email→store heuristic — most severe finding

**Found after the initial draft**, by a security scan of the pushed branch. It outranks everything
below and changes the ordering again.

**What:** A seller's identity is bound to their store by *parsing the local part of their login
email*. There is no column linking `stores` to `auth.users` — the Express middleware says so in a
comment: *"no existe una columna user_id que vincule stores <-> auth.users"*. Anyone who can
create an account with a chosen local part therefore inherits whichever store matches it.

**Evidence — every link verified:**

1. `POST /api/auth/register` is **unauthenticated** (`backend/src/routes/auth.routes.js:7`; the
   port matches).
2. The email is validated as an email and nothing more — `RegisterDto.email` carries only
   `@IsEmail()`. **No server-side check constrains the domain to `@cubaamazon.com`**; that
   convention lives entirely in the frontends.
3. Identity resolution is `email.split('@')[0]`, with `+` and whitespace stripped
   (`backend/src/middleware/auth.middleware.js`, and the port's shared
   `extract-phone-from-email.util.ts` — behaviourally identical).
4. Store phone numbers are **published**: `frontend/src/pages/StoreDetails.jsx:171-233` renders
   them as click-to-WhatsApp links on every store page.

**The exploit is four steps and needs no privileged access:**

1. Read a target store's phone from its public page — say `5551234`.
2. Register `5551234@anything.com`. Supabase only requires the *full* email be unique, and the
   victim's is `5551234@cubaamazon.com`, so this is accepted.
3. Log in normally and receive a valid Supabase session.
4. Every seller-guarded route now resolves `req.store` to **the victim's store**.

The attacker can then edit or delete the victim's products, rewrite their store profile, and —
via `PUT /api/stores/:id/credentials` — change the store owner's **email and password**. That is
full account takeover, from an unauthenticated start, keyed on a public phone number.

**Not a regression.** Express is if anything looser: it matches with
`.ilike('phone', '%' + phone + '%')`, a substring match, so a derived phone need only be
*contained in* a store's phone. The migration tightened that to an exact match (closing the
substring-collision half) but the underlying heuristic — and this bypass — carried across intact.

**Shape of the fix:** stop deriving identity from a string. Add a real `user_id` column on
`stores` referencing `auth.users`, populate it at registration from the created user's id, and
resolve the caller's store by `user_id` from the verified session. The email local part should
stop being an authorization input entirely.

**Watch for:** this is a schema change plus a backfill of existing rows (matching current stores
to their auth users by the same phone heuristic, one last time, ideally with manual review of
collisions). Until the backfill is verified, both paths have to work. Also audit whether any
seller has *already* been created with a colliding local part — two accounts resolving to one
store is the signature.

**Interim mitigation if the full fix cannot ship immediately:** enforce the `@cubaamazon.com`
domain server-side at registration and reject a registration whose derived phone already matches
an existing store. That closes the trivial path without a migration, but it is a patch on a
heuristic, not a fix — anyone who can obtain a `@cubaamazon.com` address still inherits the store.

**Note on the interim mitigation, from the audit below:** the domain check alone is not enough.
Several stores hold a *username* in the `phone` column rather than a number, so a legitimate
owner's real-world email is what resolves them. Forcing `@cubaamazon.com` would lock those owners
out while still leaving the collision surface open. The mitigation has to handle non-numeric
`phone` values explicitly.

### Production audit — run 2026-08-24

Run against production with the service-role key, read-only. 36 stores, 17 auth accounts. The
script is not committed (its output contains account emails); it is reproducible from the
definitions here — derive `email.split('@')[0]` with `+` and whitespace stripped, then compare
against `stores.phone` both exactly (backend-nest) and as a substring (Express, live).

**No evidence of exploitation.** Every anomaly has an innocent explanation: a legacy
`@phone.<domain>` email convention that was later changed, and stores whose `phone` column holds a
username, whose owners therefore registered with their ordinary personal email.

**But the flaw is demonstrably reachable, by accident, today:**

- **One store has `phone` set to the literal string `admin`.** Every account named `admin@` at any
  domain resolves to it. Two already do, differing only in TLD. No attacker was involved — this is
  the vulnerability occurring spontaneously.
- **One seller's account matches two stores at once** under Express's substring lookup: their own
  store, and a second store whose phone is the same number carrying a `53` country-code prefix.
  Express selects with `.limit(1)` and **no `ORDER BY`**, so which store that seller receives is
  arbitrary. The colliding store is currently `rejected` test data, so present impact is
  negligible — but the mechanism is live, and country-code prefixing makes the collision class
  ordinary rather than exotic.

**Cutover risk, now quantified.** Eight of 36 stores have no auth account matching their `phone`
exactly, so they would receive 403 from `backend-nest`'s exact match where Express's substring
match currently finds them. Six of the eight are `rejected` seed data. **Two approved, real stores
would lose seller login:**

| Store | `phone` shape | Why it fails exact match |
|---|---|---|
| (id 31) | `"NN NNNNNNNN"` | embedded space |
| (id 32) | `"Wa.me//+NNNNNNNNNN"` | a WhatsApp URL, not a number |

Store 32 works today *only* because the substring match finds the digits inside the URL.

**This is a two-row data fix, not a code change** — normalise those two `phone` values before any
frontend is cut over to `backend-nest`, and the exact-match hardening ships without locking anyone
out. It also closes the long-standing question raised during the migration about whether legacy
non-digit phone data would break the tightened lookup: it would, for exactly two live stores.

**What the audit means for the `user_id` backfill.** The mapping is small and bounded — 36 stores,
17 accounts — but three stores map ambiguously (the `admin` store, and the two sides of the
country-code collision) and need a human decision rather than an automated rule. Budget an
afternoon of careful mapping with review, not a migration project.

---

## 1. Order price tampering — second-highest financial impact

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

Revised twice. An earlier draft paired #1 and #2 with #3 after them; that was wrong because #2
has an admin caller. Then #0 was found, which outranks all of them.

1. **#0 — seller account takeover.** Unauthenticated → full takeover of any store, keyed on a
   public phone number. Do this first, and treat the interim mitigation as same-day work if the
   schema change needs longer. Note it must land in `backend/` regardless of the sequencing
   decision below, because that is what serves traffic.
2. **Sequencing decision** (`backend/` vs `backend-nest/` vs both) — blocks the rest.
3. **#1 — order price tampering.** Genuinely independent: it is fixed entirely server-side by
   computing totals from product rows, and needs no identity work. Highest financial impact, so
   it should not wait behind the auth build. Do it first.
4. **#3 — admin auth.** Largest, and on the critical path: it gates both the admin write
   endpoints and #2's admin read path.
5. **#2 — orders IDOR.** The seller half could technically land with #1, but splitting it means
   touching the same endpoint twice and shipping an interim state where the admin path is still
   open. Cleaner to do it once, after #3.
6. **#4 — pending stores in public listings.** Smallest and fully independent; can land any
   time after the sequencing decision, including in parallel with the others.

If #2's exposure is judged too severe to wait on #3, the interim option is to lock the seller
path immediately and leave the admin path open behind a documented, time-boxed exception —
but that is a deliberate risk acceptance, not a fix, and it should be recorded as one.

## Related

- Migration spec: `docs/superpowers/specs/2026-08-23-backend-nestjs-prisma-migration-design.md`
- Migration plan: `docs/superpowers/plans/2026-08-23-backend-nestjs-prisma-migration.md`
- Merge commit `fe02272` lists the defects caught during the port itself.
