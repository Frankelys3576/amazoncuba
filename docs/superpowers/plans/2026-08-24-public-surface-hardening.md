# Public Surface Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four vulnerabilities that are live in production and do not depend on the pending UUID migration.

**Architecture:** The server stops trusting the client for authorization and for money. Order status gains a caller model and a value allowlist; order totals are recomputed from the database per currency; the public store listing is filtered and column-whitelisted; and four public endpoints gain per-IP limits plus input validation. Every change lands in both backends so the eventual NestJS cutover cannot reopen anything.

**Tech Stack:** Express 5 + `@supabase/supabase-js`; NestJS 11 + Prisma; React 19 + Vite; `express-rate-limit`; `@nestjs/throttler`.

**Spec:** `docs/superpowers/specs/2026-08-24-public-surface-hardening-design.md`

**Base branch:** `security-admin-lockdown` — **not `main`**. This work consumes `resolveOrdersCaller` and `authenticateAdmin`, which exist only there.

## Global Constraints

- All user-facing strings and API error messages in **Spanish**, matching surrounding style.
- **No database schema change.** Coupling these fixes to a migration is what this batch exists to avoid; migration 002 is still unapplied.
- `backend/` has **no test runner** (`npm test` is a stub that exits 1). Verification is `backend/smoke_public_surface.mjs` against a local Supabase stack, plus reading. Never claim a test run that did not happen.
- `backend-nest/` must end green on all three: `npx tsc --noEmit` (0 errors), `npm test`, `npm run test:e2e`. Report real numbers. Baseline entering this plan: **155 unit, 38 e2e**.
- **Never** connect to, read from, or write to production. All verification runs against a local Supabase stack (`npx supabase@2.115.0 start`). Docker is available.
- Never commit a key, token, password or `.env`. `backend/` has no `.env` in this worktree and must not get one.
- The order status allowlist is exactly **`pending`, `shipped`, `delivered`** — the only three values the codebase uses.
- Rate limits are **approximate** on serverless and must never be described as guarantees.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/middleware/auth.middleware.js` | **Modify.** Add `authorizeOrderUpdate`. |
| `backend/src/controllers/order.controller.js` | **Modify.** Status allowlist; server-side per-currency totals. |
| `backend/src/routes/order.routes.js` | **Modify.** Guard `PUT /:id`. |
| `backend/src/controllers/store.controller.js` | **Modify.** Status filter; whitelist `formatStore`. |
| `backend/src/controllers/product.controller.js` | **Modify.** Review input validation. |
| `backend/src/middleware/rate-limit.middleware.js` | **Create.** The four limiters. |
| `backend/src/routes/{product,auth,upload}.routes.js` | **Modify.** Apply limiters. |
| `backend/smoke_public_surface.mjs` | **Create.** Executable evidence. |
| `backend-nest/src/auth/order-update-auth.guard.ts` (+ spec) | **Create.** Mirrors `authorizeOrderUpdate`. |
| `backend-nest/src/orders/orders.service.ts` | **Modify.** Status allowlist; per-currency totals. |
| `backend-nest/src/stores/stores.service.ts`, `store-format.util.ts` | **Modify.** Filter and whitelist. |
| `backend-nest/src/products/dto/create-product-review.dto.ts` | **Modify.** Rating and length validation. |
| `admin-frontend/src/services/api.js` | **Modify.** `getStores` sends the admin token. |
| `frontend/src/pages/{Checkout,MyOrders}.jsx` | **Modify.** Read `totals` from the response. |

---

## Task 1: Order status — allowlist and caller authorization

**Files:**
- Modify: `backend/src/middleware/auth.middleware.js`, `backend/src/controllers/order.controller.js`, `backend/src/routes/order.routes.js`
- Create: `backend-nest/src/auth/order-update-auth.guard.ts`, `backend-nest/src/auth/order-update-auth.guard.spec.ts`
- Modify: `backend-nest/src/auth/guards.module.ts`, `backend-nest/src/orders/orders.controller.ts`, `backend-nest/src/orders/orders.service.ts`

**Interfaces:**
- Consumes: `resolveOrdersCaller(req)` from `backend/src/middleware/auth.middleware.js`, already exported. It returns `{ kind: 'anonymous' | 'admin' | 'seller' | 'user', user?, store?, error? }` — `anonymous` when there is no token or the token is invalid (with `error` carrying the Spanish message), `admin` when `app_metadata.role === 'admin'`, `seller` when the user owns a `stores` row, `user` otherwise.
- Produces: `authorizeOrderUpdate(req, res, next)` exported from the same file; `ORDER_STATUSES` exported from `order.controller.js`.

**Why:** `PUT /api/orders/:id` has no authorization at all, and `status` is never validated — any caller can write any string as any order's status.

- [ ] **Step 1: Add the allowlist and validate it**

In `backend/src/controllers/order.controller.js`, beside the existing `UUID` constant:

```javascript
// Los tres únicos estados que usa la aplicación. Antes no se validaba nada:
// updateOrder escribía la cadena que viniera en el cuerpo, así que el estado
// de un pedido podía quedar en cualquier texto arbitrario, que luego se
// mostraba en los paneles del vendedor y del administrador.
const ORDER_STATUSES = ['pending', 'shipped', 'delivered'];
```

Export it alongside the existing exports. In `updateOrder`, after the uuid check:

```javascript
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado de pedido no válido' });
    }
```

- [ ] **Step 2: Add the authorization middleware**

In `backend/src/middleware/auth.middleware.js`:

```javascript
// Estados que un vendedor puede fijar. Un cliente sólo puede marcar
// 'delivered' ("marcar como recibido"), y un administrador cualquiera de la
// lista.
const SELLER_ORDER_STATUSES = ['shipped', 'delivered'];

// ¿Contiene el pedido algún producto de esta tienda?
const sellerOwnsOrder = async (storeId, orderId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, products!inner(store_id)')
    .eq('order_id', orderId)
    .eq('products.store_id', storeId)
    .limit(1);

  if (error) throw error;
  return Boolean(data && data.length > 0);
};

// Autorización de PUT /api/orders/:id. Tres llamantes, tres reglas:
//
//   cliente        sin credencial. Conocer el id del pedido ES la credencial,
//                  igual que en ?ids=. Sólo puede marcar 'delivered'.
//   vendedor       sesión válida Y el pedido contiene un producto suyo.
//                  Sólo estados de gestión.
//   administrador  cualquier estado de la lista.
//
// Antes de esto la ruta no comprobaba NADA: cualquiera podía fijar cualquier
// estado en cualquier pedido recorriendo los ids.
const authorizeOrderUpdate = async (req, res, next) => {
  try {
    const { status } = req.body || {};

    if (!req.headers.authorization) {
      if (status !== 'delivered') {
        return res.status(403).json({ error: 'No tienes permiso para cambiar este pedido' });
      }
      return next();
    }

    const caller = await resolveOrdersCaller(req);

    if (caller.kind === 'anonymous') {
      return res.status(401).json({ error: caller.error });
    }

    if (caller.kind === 'admin') {
      req.admin = caller.user;
      return next();
    }

    if (caller.kind !== 'seller') {
      return res.status(403).json({ error: 'No se encontró una tienda asociada a este usuario' });
    }

    if (!SELLER_ORDER_STATUSES.includes(status)) {
      return res.status(403).json({ error: 'No tienes permiso para cambiar este pedido' });
    }

    if (!(await sellerOwnsOrder(caller.store.id, req.params.id))) {
      return res.status(403).json({ error: 'No tienes permiso sobre este pedido' });
    }

    req.user = caller.user;
    req.store = caller.store;
    return next();
  } catch (error) {
    console.error('Error in authorizeOrderUpdate:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

Export it.

**Ordering note:** the status allowlist is enforced in the controller (Step 1) and the middleware also reads `status`. A request with an invalid status and no credential reaches the middleware first and gets 403, not 400. That is acceptable — it leaks less — but do not "fix" it by dropping the controller check, which is the one that protects the admin path.

- [ ] **Step 3: Guard the route**

In `backend/src/routes/order.routes.js`, import `authorizeOrderUpdate` and apply it to `router.put('/:id', ...)`. Leave `POST /` and `GET /` unchanged.

- [ ] **Step 4: Verify it parses**

Run: `for f in backend/src/routes/order.routes.js backend/src/middleware/auth.middleware.js backend/src/controllers/order.controller.js; do node --check "$f" || echo "FAIL $f"; done`
Expected: no failures.

- [ ] **Step 5: Mirror it in NestJS**

Create `OrderUpdateAuthGuard` as a plain `CanActivate` (not a passport strategy — the `'bearer'` name is taken by `SellerAuthStrategy`, and `AuthGuard` overwrites `request.user`, which has already caused a silent defect in this project). It must reproduce Task 1's decision table branch-for-branch, with the same statuses and the same Spanish strings. Inject `SupabaseService`, `PrismaService` and `AdminGuard` the way `OrdersQueryAuthGuard` already does — read that file and follow it.

Add the guard to `GuardsModule`'s providers and exports, apply `@UseGuards(OrderUpdateAuthGuard)` to the orders controller's `@Put(':id')`, and enforce the same allowlist in `orders.service.ts`'s `update`.

**`OrdersModule` already imports `GuardsModule`** (added when `OrdersQueryAuthGuard` landed), so no module wiring changes here. Verify that rather than assuming it.

The shape, so the decision order is not left to interpretation:

```typescript
@Injectable()
export class OrderUpdateAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly adminGuard: AdminGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithStore & { admin?: unknown }>();
    const status = (request.body as { status?: string })?.status;

    // Cliente sin credencial: sólo 'delivered'. No se consulta a Supabase.
    if (!request.headers.authorization) {
      if (status !== 'delivered') {
        throw new ForbiddenException('No tienes permiso para cambiar este pedido');
      }
      return true;
    }

    // ... token inválido -> UnauthorizedException con el mismo mensaje que Express
    // ... admin -> this.adminGuard.canActivate(context)
    // ... vendedor -> estado en SELLER_ORDER_STATUSES Y el pedido contiene un
    //     producto suyo (prisma.orderItem.findFirst con product.store_id)
    // ... cualquier otro -> ForbiddenException
  }
}
```

- [ ] **Step 5b: Add e2e coverage and prove the guard is load-bearing**

The unit spec alone would not notice the guard being detached from the route. Add an e2e case in `backend-nest/test/orders.e2e-spec.ts` following the file's existing pattern: `PUT /api/orders/:id` with no credential and `status: 'shipped'` → **403**.

Then remove `@UseGuards(OrderUpdateAuthGuard)` from the controller, run `npm run test:e2e`, confirm it goes **red**, and restore it. Report the result. A guard whose absence leaves the suite green is a guard nothing is protecting.

- [ ] **Step 6: Write the guard's unit spec**

Cover every branch, and make the anonymous cases explicit:

```typescript
it('cliente sin credencial: permite marcar delivered', async () => { /* expect true */ });
it('cliente sin credencial: rechaza cualquier otro estado', async () => { /* expect ForbiddenException */ });
it('vendedor: permite shipped en un pedido con un producto suyo', async () => { /* expect true */ });
it('vendedor: rechaza un pedido sin productos suyos', async () => { /* expect ForbiddenException */ });
it('vendedor: rechaza un estado que no es de gestión', async () => { /* expect ForbiddenException */ });
it('administrador: permite cualquier estado de la lista', async () => { /* expect true */ });
```

For the "cliente sin credencial" cases, assert the Supabase double was **not** called — otherwise the test passes whether the guard short-circuits or authenticates first, and those are different behaviours.

- [ ] **Step 7: Run everything green**

Run: `cd backend-nest && npx tsc --noEmit && npm test && npm run test:e2e`
Expected: 0 type errors; unit count up by the new spec; e2e still passing. If an e2e test hits `PUT /api/orders/:id` it will now need a status from the allowlist — fix the test, do not widen the allowlist.

- [ ] **Step 8: Commit**

```bash
git add backend/src backend-nest/src
git commit -m "Authorize order status changes and validate the value"
```

---

## Task 2: Order totals recomputed server-side, per currency

**Files:**
- Modify: `backend/src/controllers/order.controller.js`
- Modify: `backend-nest/src/orders/orders.service.ts`, `backend-nest/src/orders/dto/create-order.dto.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `POST /api/orders` responses gain `totals`, an object keyed by currency: `{ "USD": 45.00, "CUP": 12000 }`. Task 5 consumes it.

**Why:** `createOrder` takes `total` and every `price_at_purchase` from the request body with no database lookup. `POST /api/orders` with `total: 0.01` creates a real order at that price.

- [ ] **Step 1: Recompute in Express**

Replace `createOrder`'s body. `total` and `item.price` from the request are **ignored entirely** — do not destructure them.

```javascript
const createOrder = async (req, res) => {
  try {
    const { customer_name, customer_email, customer_address, customer_phone, items, payment_method, payment_proof_url } = req.body;

    // El total y los precios NO se leen del cuerpo. Antes sí: un cliente podía
    // enviar total: 0.01 y el pedido se guardaba con ese importe.
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido no tiene artículos' });
    }

    const productIds = [...new Set(items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, currency')
      .in('id', productIds);

    if (productsError) throw productsError;

    const byId = new Map((products || []).map((p) => [String(p.id), p]));
    if (productIds.some((id) => !byId.has(String(id)))) {
      return res.status(400).json({ error: 'Uno o más productos no existen' });
    }

    // Los importes se calculan por moneda: cada producto lleva la suya y un
    // carrito puede mezclarlas, así que un único número no significaría nada.
    const totals = {};
    const lines = [];

    for (const item of items) {
      const product = byId.get(String(item.product_id));
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'La cantidad de cada artículo debe ser un entero positivo' });
      }

      const unitPrice = Number(product.price);
      const currency = product.currency || 'USD';

      totals[currency] = (totals[currency] || 0) + unitPrice * quantity;
      lines.push({ product_id: product.id, quantity, price_at_purchase: unitPrice });
    }

    // orders.total es NOT NULL y se conserva por compatibilidad: es la suma
    // sin distinguir moneda, exactamente lo que se guardaba antes. El dato
    // bueno es `totals`; los frontales deben leer ese.
    const legacyTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ customer_name, customer_email, customer_address, customer_phone, total: legacyTotal, status: 'pending', payment_method: payment_method || 'cash_on_delivery', payment_proof_url }])
      .select();

    if (orderError) throw orderError;

    const newOrderId = orderData[0].id;

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(lines.map((line) => ({ ...line, order_id: newOrderId })));

    if (itemsError) throw itemsError;

    res.status(201).json({ message: 'Pedido creado exitosamente', order: orderData[0], totals });
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ error: 'Error al crear el pedido' });
  }
};
```

- [ ] **Step 2: Verify it parses**

Run: `node --check backend/src/controllers/order.controller.js`
Expected: no output, exit 0.

- [ ] **Step 3: Mirror it in NestJS**

`orders.service.ts`'s `create` must do the same: look products up with `prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, price: true, currency: true } })`, reject a missing product and a non-positive non-integer quantity with `BadRequestException` carrying the same Spanish messages, build `totals` per currency, write `price_at_purchase` from the database price, and return `totals` alongside `order`.

Remove `total` from `CreateOrderDto` — accepting a field the server ignores invites someone to wire it back up. Prisma `Decimal` values need `Number(...)` before arithmetic; the codebase already has `toPlainNumber`/`coerceDecimalFields` helpers — reuse rather than reinvent.

- [ ] **Step 4: Unit-test the recomputation**

Add specs asserting: a submitted `total` and `price` are ignored in favour of the database values; a two-currency cart yields two keys; a nonexistent product id is rejected; `quantity: 0`, `quantity: -1` and `quantity: 1.5` are rejected.

The first of those is the one that matters — assert the **stored** `price_at_purchase` equals the database price and not the submitted one. A test that only checks the response shape would pass with the vulnerability intact.

- [ ] **Step 5: Run everything green**

Run: `cd backend-nest && npx tsc --noEmit && npm test && npm run test:e2e`
Expected: all three green, real numbers reported.

- [ ] **Step 6: Commit**

```bash
git add backend/src backend-nest/src
git commit -m "Compute order totals from the database, per currency"
```

---

## Task 3: Store listing — status filter and column whitelist

**Files:**
- Modify: `backend/src/controllers/store.controller.js`
- Modify: `backend-nest/src/stores/stores.service.ts`, `backend-nest/src/stores/store-format.util.ts`
- Modify: `admin-frontend/src/services/api.js`

**Interfaces:**
- Consumes: `resolveOrdersCaller(req)` (contract in Task 1); `adminHeaders()` in `admin-frontend/src/services/api.js`.
- Produces: nothing later tasks consume.

**Why:** `GET /api/stores` has no status filter, so `pending` and `rejected` stores are public, and `formatStore` spreads `...store`, returning `phone`, `zelle_info`, `user_id` and `legacy_*`.

**The trap:** `admin-frontend/src/AdminStores.jsx:35` calls this same public `getStores()` and filters by status **client-side**. Filter it naively and store approval breaks — the admin can never see a pending store to approve. That is why Step 3 exists, and it must land in the same commit as Step 1.

- [ ] **Step 1: Filter by status unless the caller is an admin**

In `getStores`, before building the query:

```javascript
    // Un administrador ve todas las tiendas; cualquier otro llamante sólo las
    // aprobadas. AdminStores.jsx usa ESTE mismo endpoint para aprobar tiendas
    // pendientes, así que el filtro sin la excepción rompería la aprobación.
    const caller = await resolveOrdersCaller(req);
    const isAdmin = caller.kind === 'admin';

    let query = supabase.from('stores').select('*');
    if (!isAdmin) {
      query = query.eq('status', 'approved');
    }
```

`resolveOrdersCaller` returns `{ kind: 'anonymous' }` without any network call when there is no `Authorization` header, so anonymous listings cost nothing extra.

- [ ] **Step 2: Whitelist the columns**

Rewrite `formatStore` so it names what it returns instead of spreading:

```javascript
// Antes hacía `...store`, así que la respuesta pública incluía todas las
// columnas: phone, el blob zelle_info, y tras la migración user_id y las
// columnas legacy_*. Ahora se enumera lo que el frontal usa.
const formatStore = (store) => {
  if (!store) return store;
  const info = store.zelle_info || {};
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
    lat: store.lat !== undefined && store.lat !== null ? store.lat : (info.lat !== undefined ? info.lat : null),
    lng: store.lng !== undefined && store.lng !== null ? store.lng : (info.lng !== undefined ? info.lng : null),
    price_per_night: store.price_per_night || info.price_per_night || null,
    gallery: info.gallery || []
  };
};
```

`zelle_info` itself is dropped; the fields the storefront reads are already derived from it above.

- [ ] **Step 3: Make the admin panel send its token**

In `admin-frontend/src/services/api.js`, `getStores` must send `headers: adminHeaders()` and call `handleAuthFailure(response)` like the other admin calls. Without this the panel silently loses pending stores.

- [ ] **Step 4: Verify**

Run: `node --check backend/src/controllers/store.controller.js && cd admin-frontend && npm run build`
Expected: parses; build succeeds.

Run: `grep -n "zelle_info" backend/src/controllers/store.controller.js`
Expected: `zelle_info` appears only where fields are derived from it, never returned whole.

- [ ] **Step 5: Mirror it in NestJS**

`stores.service.ts`'s `findAll` gains the same admin/approved split, and `store-format.util.ts`'s `formatStore` gains the same whitelist with its `FormattedStore` type updated to match. The `findAll` signature needs the caller's admin status — pass it from the controller rather than re-resolving inside the service.

- [ ] **Step 6: Run everything green**

Run: `cd backend-nest && npx tsc --noEmit && npm test && npm run test:e2e`
Expected: green. Existing store specs that assert on dropped fields must be updated to the new shape, not deleted.

- [ ] **Step 7: Commit**

```bash
git add backend/src backend-nest/src admin-frontend/src
git commit -m "Publish only approved stores, and only public columns"
```

---

## Task 4: Rate limiting and review input validation

**Files:**
- Create: `backend/src/middleware/rate-limit.middleware.js`
- Modify: `backend/src/routes/product.routes.js`, `backend/src/routes/auth.routes.js`, `backend/src/routes/upload.routes.js`, `backend/src/controllers/product.controller.js`, `backend/package.json`
- Modify: `backend-nest/src/products/dto/create-product-review.dto.ts`, `backend-nest/src/app.module.ts`, `backend-nest/package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks consume.

**Why:** nothing is throttled. `rating` is unbounded, so one request can set `999` and skew a product's average.

- [ ] **Step 1: Install and write the limiters**

Run: `cd backend && npm install express-rate-limit`

Create `backend/src/middleware/rate-limit.middleware.js`:

```javascript
const rateLimit = require('express-rate-limit');

// AVISO: en Vercel cada invocación puede ser una instancia distinta, así que
// este contador en memoria limita POR INSTANCIA, no globalmente. Sube mucho el
// coste de abusar de estas rutas, pero NO es una garantía. Un límite real
// necesitaría un almacén compartido (Redis), que hoy no compensa.
const build = (windowMs, max) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }
});

const loginLimiter = build(15 * 60 * 1000, 10);
const reviewLimiter = build(60 * 60 * 1000, 5);
const viewLimiter = build(60 * 60 * 1000, 60);
const uploadLimiter = build(60 * 60 * 1000, 20);

module.exports = { loginLimiter, reviewLimiter, viewLimiter, uploadLimiter };
```

- [ ] **Step 2: Apply them**

`auth.routes.js`: `loginLimiter` on `POST /login`. `product.routes.js`: `reviewLimiter` on `POST /:id/reviews`, `viewLimiter` on `POST /:id/view`. `upload.routes.js`: `uploadLimiter` on `POST /`, before `upload.single('image')` so a rejected request never buffers 5 MB.

- [ ] **Step 3: Validate review input**

In `addProductReview`, after the existing required-fields check:

```javascript
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'La valoración debe ser un número entero del 1 al 5' });
    }
    if (typeof customer_name !== 'string' || customer_name.length > 100) {
      return res.status(400).json({ error: 'El nombre no puede superar los 100 caracteres' });
    }
    if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.length > 1000)) {
      return res.status(400).json({ error: 'El comentario no puede superar los 1000 caracteres' });
    }
```

Insert `numericRating`, not `rating`.

- [ ] **Step 4: Verify**

Run: `for f in backend/src/middleware/rate-limit.middleware.js backend/src/routes/*.routes.js backend/src/controllers/product.controller.js; do node --check "$f" || echo "FAIL $f"; done`
Expected: no failures.

- [ ] **Step 5: Mirror it in NestJS**

Run: `cd backend-nest && npm install @nestjs/throttler`

Register `ThrottlerModule` in `AppModule` and apply per-route throttles matching the four limits above. Add `class-validator` decorators to `CreateProductReviewDto`: `@IsInt()` with `@Min(1)` and `@Max(5)` on `rating`, `@MaxLength(100)` on `customer_name`, `@IsOptional()` with `@MaxLength(1000)` on `comment`. The global `ValidationPipe` already runs with `whitelist: true`, so the decorators take effect once added.

Carry the same "approximate, not a guarantee" warning in a comment.

- [ ] **Step 6: Run everything green**

Run: `cd backend-nest && npx tsc --noEmit && npm test && npm run test:e2e`
Expected: green, real numbers.

- [ ] **Step 7: Commit**

```bash
git add backend/src backend/package.json backend/package-lock.json backend-nest/src backend-nest/package.json backend-nest/package-lock.json
git commit -m "Rate-limit the public write endpoints and bound review input"
```

---

## Task 5: Frontends consume the server's totals

**Files:**
- Modify: `frontend/src/pages/Checkout.jsx`, `frontend/src/pages/MyOrders.jsx`

**Interfaces:**
- Consumes: `totals` from Task 2's `POST /api/orders` response — an object keyed by currency, e.g. `{ "USD": 45.00, "CUP": 12000 }`.

**Why:** the client currently displays its own computed `cartTotal`, which the server no longer trusts. If the two disagree — because a seller changed a price after the item entered the cart — the customer must see what was actually charged.

- [ ] **Step 1: Display the server's totals on the confirmation**

In `Checkout.jsx`, `createOrder`'s response now carries `totals`. Use it for the confirmation modal, the receipt text and the WhatsApp message instead of `cartTotal`, rendering one line per currency:

```javascript
const formatTotals = (totals) =>
  Object.entries(totals || {})
    .map(([currency, amount]) => `${Number(amount).toFixed(2)} ${currency}`)
    .join(' + ');
```

Keep `cartTotal` for the pre-submit basket summary — before the order exists there is nothing else to show — but everything after the response uses `totals`.

- [ ] **Step 2: Handle a stored order with no totals**

`MyOrders.jsx` reads orders from `localStorage`, and orders placed before this change have no `totals`. Fall back to the stored `total` when `totals` is absent, so existing customers' order history keeps rendering.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "Show the totals the server actually charged"
```

---

## Task 6: End-to-end verification against a local stack

**Files:**
- Create: `backend/smoke_public_surface.mjs`

**Interfaces:**
- Consumes: everything built in Tasks 1-5.
- Produces: `PASS`/`FAIL` plus a written result.

**Why:** `backend/` has no test runner, and NestJS's suites mock Prisma and Supabase. This project has already produced a case where 148 green mocked tests coexisted with an authentication bypass that only appeared when a real process met a real database.

- [ ] **Step 1: Write the smoke script**

Follow `backend/smoke_admin_auth.mjs` — same `check()` helper, Spanish labels, environment-variable configuration, no `.env` reading, and a `MODE=local` / `MODE=production` split where only local mode writes.

Assertions:

*Order status*
- `PUT /api/orders/:id` no credential, `status: 'delivered'` → **200**
- no credential, `status: 'shipped'` → **403**
- no credential, `status: 'cualquier cosa'` → **403**
- admin token, `status: 'cualquier cosa'` → **400** (allowlist, not authorization)
- seller token, `shipped` on an order containing their product → **200**
- seller token, `shipped` on an order that does not → **403**

*Order totals*
- `POST /api/orders` with `total: 0.01` and `price: 0.01` → the created order's stored total and `price_at_purchase` come from the database, not the body
- a cart with two products in different currencies → `totals` has two keys
- a nonexistent `product_id` → **400**
- `quantity: 0` → **400**

*Store listing*
- anonymous `GET /api/stores` → every returned store has `status === 'approved'`
- anonymous response contains no `user_id`, no `legacy_` key and no `zelle_info`
- admin token → `pending` and `rejected` stores appear

*Rate limiting and review input*
- 6 rapid review posts → the last returns **429**
- `rating: 999` → **400**; `rating: -1` → **400**; `rating: 3` → **201**
- a 2000-character comment → **400**

- [ ] **Step 2: Run it against a local stack**

Bring up Supabase, push the pre-migration schema, seed, apply `backend/migrations/001_...sql` and `002_...sql`, grant and `notify pgrst`. Register a seller and an admin (`node backend/set_admin_role.js <correo>`). Boot Express with local credentials as environment variables.

Run: `MODE=local BASE=http://127.0.0.1:5001 ... node backend/smoke_public_surface.mjs`
Expected: `PASS`, every assertion `ok`.

- [ ] **Step 3: Prove each protection is load-bearing**

For each of the four fixes in turn: revert it, re-run, confirm the assertions covering it go **red**, restore it, confirm green.

- the order-status guard removed → the `shipped`-without-credential assertion passes when it should fail
- the totals recomputation reverted → the `total: 0.01` assertion stores 0.01
- the store status filter removed → a `pending` store appears anonymously
- the rating validation removed → `rating: 999` is accepted

Report all four results. A test that passes with its protection removed is not testing the protection, and this project has already shipped one of those.

- [ ] **Step 4: Tear down and commit**

Stop the stack (`npx supabase@2.115.0 stop --no-backup`), shred any credential file, confirm `git status --porcelain` is clean apart from the new script.

```bash
git add backend/smoke_public_surface.mjs
git commit -m "Add the public-surface smoke check"
```

---

## What this plan does NOT cover

- **`POST /api/upload`'s authentication.** All three frontends call it, customers included, for payment proofs. Rate limiting reduces flooding and cost; who may upload needs its own design.
- **The `accepts_zelle → 'CUP'` override** at `seller-frontend/src/SellerProducts.jsx:109`, which overrides the seller's chosen currency. It looks like a bug and affects pricing, but it is a product decision.
- **Stock enforcement.** `products.stock` is never decremented, so the platform can oversell.
- **Snapshotting currency onto `order_items`.** Currency is read from the product, so if a seller later changes it, historical orders report the new one. The fix is a schema change and belongs with a later migration.
- Findings #0, #2 and #3 from the scope document, already fixed and awaiting deployment.
