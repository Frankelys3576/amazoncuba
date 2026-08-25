# Per-Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared-key admin stopgap with authentication of an actual person, and bring NestJS to parity with the Express-only lockdown.

**Architecture:** The admin is an ordinary Supabase Auth user carrying `app_metadata.role = 'admin'`. Both backends verify the bearer token they already verify for sellers and check that claim. No new table, no second session system, no new secret.

**Tech Stack:** Express 4 + `@supabase/supabase-js`; NestJS 11 + Prisma; React 19 + Vite; Supabase Auth (GoTrue), PostgreSQL 17.6.

**Spec:** `docs/superpowers/specs/2026-08-24-per-admin-auth-design.md`

**Branch:** `security-admin-lockdown`

## Global Constraints

- All user-facing strings and API error messages are in **Spanish**. Match the surrounding style.
- The role lives in **`app_metadata`, never `user_metadata`**. Any authenticated user can write their own `user_metadata` via `updateUser`, so a role stored there is self-grantable by every seller on the platform.
- Writing `app_metadata` **merges**: read the existing object and spread it. Supabase already stores `provider` and `providers` there, and `updateUserById` replaces the keys it is given.
- `backend/` has **no test runner** (`npm test` is a stub). Verification is `backend/smoke_admin_auth.mjs` plus reading. Never claim a test run that did not happen.
- `backend-nest/` must end green on all three: `npx tsc --noEmit` (0 errors), `npm test`, `npm run test:e2e`. Report real numbers. Baseline is 132 unit / 20 e2e.
- **Never connect to, read from, or write to the production database or the production API.** All verification runs against a local Supabase stack (`npx supabase@2.115.0 start` in a scratch directory). Docker is available.
- Never commit a key, token, password, or `.env` file. `backend/.env` does not exist in this worktree and must not be created.
- Seven admin route sites in Express: `GET /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`, `POST /api/settings`, `GET /api/stores/:id/admin-details`, `PUT /api/stores/:id/status`, `PUT /api/stores/:id/zelle`.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/set_admin_role.js` | **Create.** One-off script granting the admin role by email. |
| `backend/src/middleware/auth.middleware.js` | **Modify.** Add `authenticateAdmin`; delete `requireAdmin`. |
| `backend/src/routes/{user,settings,store}.routes.js` | **Modify.** Swap `requireAdmin` → `authenticateAdmin`. |
| `backend/src/controllers/user.controller.js` | **Modify.** Refuse to modify or delete an admin account. |
| `backend/.env.example` | **Modify.** Remove `ADMIN_API_KEY` and its comment block. |
| `backend/smoke_admin_auth.mjs` | **Create** (replaces `smoke_admin_lockdown.mjs`). Local and production-safe modes. |
| `admin-frontend/src/AdminAuth.jsx` | **Modify.** Real login against `POST /api/auth/login`. |
| `admin-frontend/src/services/api.js` | **Modify.** Send the bearer token; stop swallowing 401/403. |
| `admin-frontend/src/App.jsx` | **Modify.** Comment that `PrivateRoute` is UI convenience, not security. |
| `backend-nest/src/auth/request-with-admin.interface.ts` | **Create.** Request shape carrying `admin`. |
| `backend-nest/src/auth/admin.guard.ts` (+ `.spec.ts`) | **Create.** `CanActivate` verifying token and role. |
| `backend-nest/src/auth/orders-query-auth.guard.ts` (+ `.spec.ts`) | **Create.** The three-way orders check. |
| `backend-nest/src/auth/guards.module.ts` | **Modify.** Provide and export the two new guards. |
| `backend-nest/src/{users,settings,stores,orders}/*.controller.ts` | **Modify.** Apply guards. |

---

## Task 1: Grant script

**Files:**
- Create: `backend/set_admin_role.js`

**Interfaces:**
- Consumes: `backend/src/config/supabase.js` (default export: a configured Supabase client using the service-role key).
- Produces: nothing other tasks import. It is run by hand: `node backend/set_admin_role.js <correo>`.

- [ ] **Step 1: Write the script**

```javascript
// Asigna el rol de administrador a una cuenta existente de Supabase Auth.
//
// Uso: node backend/set_admin_role.js <correo>
//
// El rol vive en app_metadata, NO en user_metadata: cualquier usuario
// autenticado puede escribir su propio user_metadata con updateUser, así que
// un rol guardado ahí se lo podría asignar cualquier vendedor. app_metadata
// sólo se puede escribir con la SERVICE_ROLE_KEY.
require('dotenv').config();
const supabase = require('./src/config/supabase');

const email = process.argv[2];

if (!email) {
  console.error('Uso: node backend/set_admin_role.js <correo>');
  process.exit(1);
}

const findUserByEmail = async (target) => {
  const wanted = target.toLowerCase();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email && u.email.toLowerCase() === wanted);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
};

const main = async () => {
  const user = await findUserByEmail(email);

  if (!user) {
    console.error(`No existe ninguna cuenta con el correo ${email}.`);
    process.exit(1);
  }

  if (user.app_metadata && user.app_metadata.role === 'admin') {
    console.log(`${email} ya tenía el rol de administrador. No se ha cambiado nada.`);
    return;
  }

  // updateUserById SUSTITUYE las claves de app_metadata que se le pasan, y
  // Supabase ya guarda ahí provider y providers. Hay que fusionar.
  const app_metadata = { ...(user.app_metadata || {}), role: 'admin' };

  const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata });
  if (error) throw error;

  console.log(`Rol de administrador asignado a ${email} (${user.id}).`);
};

main().catch((error) => {
  console.error('Error al asignar el rol:', error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it parses**

Run: `node --check backend/set_admin_role.js`
Expected: no output, exit 0.

- [ ] **Step 3: Verify against the local stack**

Start a local Supabase stack in a scratch directory, register a user through `POST /api/auth/register`, then run the script against that email with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` pointing at the local stack.

Confirm three things by re-reading the user with `supabase.auth.admin.getUserById`:
1. `app_metadata.role === 'admin'`;
2. `app_metadata.provider` and `app_metadata.providers` **still present** — this is the merge, and it is the whole reason the script reads before it writes;
3. running the script a second time prints the "ya tenía" message and does not error.

- [ ] **Step 4: Commit**

```bash
git add backend/set_admin_role.js
git commit -m "Add script granting the admin role via app_metadata"
```

---

## Task 2: Express `authenticateAdmin`

**Files:**
- Modify: `backend/src/middleware/auth.middleware.js`
- Modify: `backend/src/routes/user.routes.js`, `backend/src/routes/settings.routes.js`, `backend/src/routes/store.routes.js`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `supabase` from `../config/supabase`.
- Produces: `authenticateAdmin(req, res, next)`, exported from `backend/src/middleware/auth.middleware.js`. Sets `req.admin` to the Supabase user object. Task 3 relies on nothing from it; Task 4 tests its status codes.
- Removes: `requireAdmin`, currently exported from the same file and used at seven route sites.

- [ ] **Step 1: Add the middleware**

Add to `backend/src/middleware/auth.middleware.js`, and delete `requireAdmin` and its comment block entirely:

```javascript
// Autenticación de administrador.
//
// El rol vive en app_metadata, que sólo se puede escribir con la
// SERVICE_ROLE_KEY. En user_metadata NO serviría: cualquier usuario
// autenticado puede modificar el suyo con updateUser, así que un vendedor
// podría concederse permisos de administrador él mismo.
//
// Sustituye a requireAdmin, que comprobaba una clave compartida: cerraba el
// agujero pero no identificaba a nadie.
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (!user.app_metadata || user.app_metadata.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    req.admin = user;
    next();
  } catch (error) {
    console.error('Error in authenticateAdmin:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

Update the exports block to export `authenticateAdmin` and no longer export `requireAdmin`. Leave `authenticateSeller`, `requireStoreOwnership` and `authorizeOrdersQuery` unchanged — except that `authorizeOrdersQuery`'s final line must now call `authenticateAdmin` instead of `requireAdmin`:

```javascript
  return authenticateAdmin(req, res, next);
```

- [ ] **Step 2: Swap the seven route sites**

In `backend/src/routes/user.routes.js`, `settings.routes.js` and `store.routes.js`, change every `requireAdmin` to `authenticateAdmin`, including the `require(...)` destructuring at the top of each file. The seven sites are listed in Global Constraints. Do not change which routes are protected.

- [ ] **Step 3: Remove the shared key from the example env**

Delete the `ADMIN_API_KEY` line and its Spanish comment block from `backend/.env.example`, leaving the four original variables.

- [ ] **Step 4: Verify nothing still references the old name**

Run: `grep -rn "requireAdmin\|ADMIN_API_KEY" backend/src backend/.env.example`
Expected: no output. If anything matches, it is a missed call site.

Run: `for f in backend/src/routes/*.routes.js backend/src/middleware/auth.middleware.js; do node --check "$f" || echo "FAIL $f"; done`
Expected: no failures.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.middleware.js backend/src/routes backend/.env.example
git commit -m "Express: authenticate the admin by token instead of a shared key"
```

---

## Task 3: Self-lockout guard

**Files:**
- Modify: `backend/src/controllers/user.controller.js`

**Interfaces:**
- Consumes: `supabase` (already imported at the top of the file).
- Produces: no new exports. `updateUser` and `deleteUser` gain a 403 branch.

**Why:** there is exactly one admin. A delete or password change aimed at that account is unrecoverable through the application — no second admin exists to restore access.

- [ ] **Step 1: Add the shared check**

Add near the top of `backend/src/controllers/user.controller.js`, below the `require`:

```javascript
// Sólo hay una cuenta de administrador. Si se borra o se le cambia la
// contraseña desde el propio panel, no queda ninguna otra cuenta capaz de
// devolver el acceso: la pérdida es definitiva. Por eso las rutas de usuarios
// se niegan a tocar una cuenta con rol de administrador.
const rejectIfAdminAccount = async (id, res) => {
  const { data, error } = await supabase.auth.admin.getUserById(id);

  if (error || !data || !data.user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return true;
  }

  if (data.user.app_metadata && data.user.app_metadata.role === 'admin') {
    res.status(403).json({ error: 'No se puede modificar ni eliminar una cuenta de administrador' });
    return true;
  }

  return false;
};
```

- [ ] **Step 2: Call it from both mutating handlers**

In `deleteUser`, immediately after `const { id } = req.params;`:

```javascript
    if (await rejectIfAdminAccount(id, res)) return;
```

In `updateUser`, after the existing `if (!email && !password)` validation (so a request with no fields still returns its 400 first):

```javascript
    if (await rejectIfAdminAccount(id, res)) return;
```

- [ ] **Step 3: Verify it parses**

Run: `node --check backend/src/controllers/user.controller.js`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/user.controller.js
git commit -m "Refuse to modify or delete the admin account"
```

---

## Task 4: Smoke check

**Files:**
- Create: `backend/smoke_admin_auth.mjs`
- Delete: `backend/smoke_admin_lockdown.mjs`

**Interfaces:**
- Consumes: a running Express instance and, in local mode, a local Supabase stack. Reads `BASE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SELLER_EMAIL`, `SELLER_PASSWORD`, `MODE` from the environment. Reads no `.env` file.
- Produces: exit 0 on success, 1 on any failed assertion.

**Two modes.** `MODE=local` runs everything. `MODE=production` (the default) runs only assertions that are safe against a live system: denials, public routes, and `GET` with a valid admin token. The self-promotion assertion needs a throwaway account and therefore never runs outside local mode — creating accounts in production to prove a security property is not an acceptable trade.

- [ ] **Step 1: Write the script**

Start from this skeleton — it fixes the shape, the modes, and the helper names. `backend/smoke_admin_lockdown.mjs` (which this replaces) is a working model for the reporting style.

```javascript
// Comprueba la autenticación de administrador por token.
//
// MODE=local      ejecuta TODAS las comprobaciones, incluida la de
//                 autoascenso, que necesita crear una cuenta desechable.
// MODE=production (por defecto) sólo ejecuta lo que es seguro contra un
//                 sistema en producción: rechazos, rutas públicas y GET con
//                 un token de administrador válido.
const BASE = process.env.BASE || 'http://localhost:5001';
const MODE = process.env.MODE || 'production';

let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
};

const FAKE = '00000000-0000-7000-8000-000000000000';

// Las siete rutas administrativas, con el método que usa cada una. Los ids de
// ruta son un uuid inexistente: el middleware rechaza antes de llegar al
// controlador, así que ninguna de estas peticiones modifica nada.
const ADMIN_ROUTES = [
  ['GET',    '/api/users'],
  ['PUT',    `/api/users/${FAKE}`],
  ['DELETE', `/api/users/${FAKE}`],
  ['POST',   '/api/settings'],
  ['GET',    `/api/stores/${FAKE}/admin-details`],
  ['PUT',    `/api/stores/${FAKE}/status`],
  ['PUT',    `/api/stores/${FAKE}/zelle`],
];

const call = async (method, path, { token, body } = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.status;
};

const login = async (email, password) => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.session?.access_token ?? null;
};

const adminToken = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const sellerToken = await login(process.env.SELLER_EMAIL, process.env.SELLER_PASSWORD);
check(Boolean(adminToken), 'la cuenta de administrador inicia sesión');
check(Boolean(sellerToken), 'la cuenta de vendedor inicia sesión');

console.log('\n-- sin token: las siete rutas administrativas rechazan --');
for (const [method, path] of ADMIN_ROUTES) {
  check(await call(method, path) === 401, `${method} ${path} responde 401 sin token`);
}

console.log('\n-- con token de VENDEDOR: las siete rechazan con 403 --');
for (const [method, path] of ADMIN_ROUTES) {
  check(await call(method, path, { token: sellerToken }) === 403,
    `${method} ${path} responde 403 con token de vendedor`);
}
```

Continue with the remaining assertions, in order. Every one prints `ok`/`FAIL` with a Spanish label, and the script exits non-zero if any failed.

Both modes:
1. Each of the seven admin routes with **no** `Authorization` header → **401**. Use `00000000-0000-7000-8000-000000000000` as the id in path parameters; the middleware rejects before any controller runs, so nothing is mutated.
2. Each of the seven with a **valid seller token** → **403**. A seller must never pass an admin route. This is the assertion that would catch a role check reading the wrong metadata field.
3. `GET /api/settings`, `GET /api/stores`, `GET /api/products` with no credentials → **200**. These must stay public.
4. `GET /api/orders` with no credentials and no query → **401**; with `?ids=<uuid>` → **200**; with `?storeId=<uuid>` and no token → **401**.
5. With a valid **admin** token: `GET /api/users` → **200**, `GET /api/orders` → **200**.

Local mode only:
6. Register a throwaway user. Using that user's own session token, call Supabase's `updateUser` to set `user_metadata.role = 'admin'`, then call `GET /api/users` with that token → **403**. Writing your own `user_metadata` must grant nothing.
7. `DELETE /api/users/<admin-user-id>` with a valid admin token → **403** (self-lockout guard).
8. `PUT /api/users/<admin-user-id>` with `{"password":"..."}` and a valid admin token → **403**.

Assertions 7 and 8 are the only ones that aim a mutating request at a real account with a valid credential, and both must be **rejected** — so a passing run has still written nothing. If either returns 2xx the run fails, and the account has been modified: say so loudly in the output rather than exiting quietly.

- [ ] **Step 2: Verify it parses**

Run: `node --check backend/smoke_admin_auth.mjs`
Expected: no output, exit 0.

- [ ] **Step 3: Delete the superseded script**

Run: `git rm backend/smoke_admin_lockdown.mjs`

- [ ] **Step 4: Commit**

```bash
git add backend/smoke_admin_auth.mjs
git commit -m "Replace the lockdown smoke check with per-admin auth assertions"
```

---

## Task 5: Admin frontend

**Files:**
- Modify: `admin-frontend/src/AdminAuth.jsx`
- Modify: `admin-frontend/src/services/api.js`
- Modify: `admin-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `POST /api/auth/login`, which returns `{ message, session, user, store }`. `session.access_token` is the bearer token. `store` is `null` for an admin, which is correct and must not be treated as a failure.
- Produces: `localStorage.admin_token` now holds a real Supabase access token rather than the literal string `'master_token'`.

- [ ] **Step 1: Real login in `AdminAuth.jsx`**

Replace the `setTimeout` block that compares against the hardcoded `admin@tiendacuba.com` / `admin123` with a real call. Delete those literals — they currently ship inside the public JS bundle. Also remove the `placeholder="admin@tiendacuba.com"` and `placeholder="admin123"` attributes on the two inputs.

```javascript
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const data = await response.json();

      if (!response.ok || !data.session || !data.session.access_token) {
        setError('Acceso denegado. Credenciales de administrador inválidas.');
        setLoading(false);
        return;
      }

      // El permiso real lo comprueba el backend en cada petición. Esto sólo
      // evita entrar a un panel que va a responder 403 en todo.
      const role = data.user && data.user.app_metadata && data.user.app_metadata.role;
      if (role !== 'admin') {
        setError('Esta cuenta no tiene permisos de administrador.');
        setLoading(false);
        return;
      }

      localStorage.setItem('admin_token', data.session.access_token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('No se pudo conectar con el servidor.');
      setLoading(false);
    }
  };
```

Import `API_URL` the way the file's siblings do — check `admin-frontend/src/services/api.js` for how the base URL is derived and reuse that export rather than duplicating the logic.

- [ ] **Step 2: Send the token, and stop hiding 401/403**

In `admin-frontend/src/services/api.js`, add a helper and use it in every call that hits a protected route (`getAdminStoreDetails`, `updateStoreStatus`, `updateZelleConfig`, `getOrders`, `getUsers`, `deleteUser`, `updateUser`, `updateSetting`):

```javascript
const adminHeaders = (extra = {}) => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
  ...extra,
});

// El panel devolvía [] cuando el backend respondía 401/403, así que una sesión
// caducada era indistinguible de una lista vacía. Ahora se limpia la sesión y
// se vuelve al login.
const handleAuthFailure = (response) => {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
    return true;
  }
  return false;
};
```

Each protected call sends `headers: adminHeaders()` (adding `'Content-Type': 'application/json'` where there is a body) and calls `handleAuthFailure(response)` before its existing `!response.ok` branch.

- [ ] **Step 3: Say what `PrivateRoute` is for**

In `admin-frontend/src/App.jsx`, replace the `// Simple protection` comment:

```javascript
// Comodidad de interfaz, NO seguridad: sólo evita pintar un panel al que el
// backend va a responder 401. El permiso se comprueba en el servidor en cada
// petición. Antes esto era la ÚNICA comprobación que existía, y el token ni
// siquiera se enviaba.
```

- [ ] **Step 4: Verify it builds**

Run: `cd admin-frontend && npm install && npm run build`
Expected: build succeeds.

Run: `grep -rn "admin123\|admin@tiendacuba.com\|master_token" admin-frontend/src`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add admin-frontend/src
git commit -m "Admin panel: real login, send the token, surface auth failures"
```

---

## Task 6: NestJS `AdminGuard`

**Files:**
- Create: `backend-nest/src/auth/request-with-admin.interface.ts`
- Create: `backend-nest/src/auth/admin.guard.ts`, `backend-nest/src/auth/admin.guard.spec.ts`
- Modify: `backend-nest/src/auth/guards.module.ts`
- Modify: `backend-nest/src/users/users.controller.ts`, `settings/settings.controller.ts`, `stores/stores.controller.ts`

**Interfaces:**
- Consumes: `SupabaseService` (`backend-nest/src/supabase/supabase.service.ts`), exposing `readonly client: SupabaseClient`.
- Produces: `AdminGuard`, exported from `GuardsModule`. Sets `request.admin` to the Supabase `User`.

**Why a plain `CanActivate` and not a passport strategy:** the `'bearer'` strategy name is already taken by `SellerAuthStrategy`, and `@nestjs/passport`'s `AuthGuard` assigns the entire `validate()` return onto one request property. That is exactly the trap that left `req.store` silently undefined earlier in this project and survived five clean reviews, because the test hand-built the request shape. Do not reach for `AuthGuard` here.

- [ ] **Step 1: Write the failing spec**

`backend-nest/src/auth/admin.guard.spec.ts`. Build the `ExecutionContext` double so it returns a **real** request object you can inspect afterwards — the guard's write to `request.admin` must be observed, not assumed. A hand-built request shape that never sees the guard's write is exactly how the `req.store` defect survived five reviews in this project.

```typescript
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const contextFor = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const guardWith = (getUserResult: unknown) =>
  new AdminGuard({
    client: { auth: { getUser: jest.fn().mockResolvedValue(getUserResult) } },
  } as never);

describe('AdminGuard', () => {
  it('rechaza sin cabecera Authorization', async () => {
    const guard = guardWith({ data: { user: null }, error: null });
    await expect(guard.canActivate(contextFor({ headers: {} })))
      .rejects.toThrow(new UnauthorizedException('Token no proporcionado'));
  });

  it('rechaza un rol admin puesto en user_metadata', async () => {
    // Autoascenso: cualquier usuario puede escribir su propio user_metadata.
    const guard = guardWith({
      data: { user: { id: 'u1', app_metadata: {}, user_metadata: { role: 'admin' } } },
      error: null,
    });
    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })))
      .rejects.toThrow(ForbiddenException);
  });

  it('acepta app_metadata.role admin y deja el usuario en request.admin', async () => {
    const user = { id: 'u1', app_metadata: { role: 'admin' } };
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer t' } };
    const guard = guardWith({ data: { user }, error: null });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.admin).toBe(user);
  });
});
```

Cover these cases in full:

- no `authorization` header → rejects with `UnauthorizedException`, message `'Token no proporcionado'`;
- `getUser` returns an error → `UnauthorizedException`, `'Token inválido o expirado'`;
- user with `app_metadata: { role: 'seller' }` → `ForbiddenException`, `'No tienes permisos de administrador'`;
- user with **`user_metadata: { role: 'admin' }` and no admin role in `app_metadata`** → `ForbiddenException`. This is the self-promotion case; it must be rejected;
- user with `app_metadata: { role: 'admin' }` → resolves `true` **and** `request.admin` is the user object.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend-nest && npm test -- admin.guard`
Expected: FAIL — cannot find module `./admin.guard`.

- [ ] **Step 3: Write the interface and the guard**

`request-with-admin.interface.ts`:

```typescript
import { Request } from 'express';
import { User } from '@supabase/supabase-js';

export interface RequestWithAdmin extends Request {
  admin?: User;
}
```

`admin.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestWithAdmin } from './request-with-admin.interface';

// El rol vive en app_metadata, que sólo se puede escribir con la
// SERVICE_ROLE_KEY. user_metadata NO sirve: cualquier usuario autenticado
// puede modificar el suyo con updateUser.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const appMetadata = user.app_metadata as { role?: string } | null;
    if (!appMetadata || appMetadata.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos de administrador');
    }

    request.admin = user;
    return true;
  }
}
```

- [ ] **Step 4: Wire it into `GuardsModule` and the controllers**

Add `AdminGuard` to `providers` and `exports` in `guards.module.ts`. `GuardsModule` already imports `PassportModule`; `AdminGuard` needs `SupabaseService`, so ensure the module providing it is imported the same way `SellerAuthStrategy` obtains it.

Apply `@UseGuards(AdminGuard)` to exactly these seven handlers:
- `users.controller.ts`: `@Get()`, `@Delete(':id')`, `@Put(':id')`
- `settings.controller.ts`: `@Post()` only — `@Get()` stays public
- `stores.controller.ts`: `@Get(':id/admin-details')`, `@Put(':id/status')`, `@Put(':id/zelle')`

- [ ] **Step 5: Run everything green**

Run: `cd backend-nest && npx tsc --noEmit && npm test && npm run test:e2e`
Expected: 0 type errors; unit suite passes with the new spec added to the 132 baseline; e2e still 20.

If an e2e test hits one of the seven now-guarded routes it will start returning 401 — update the test to send a mocked admin token rather than removing the guard.

- [ ] **Step 6: Commit**

```bash
git add backend-nest/src/auth backend-nest/src/users backend-nest/src/settings backend-nest/src/stores
git commit -m "NestJS: AdminGuard on the seven admin routes"
```

---

## Task 7: NestJS lockdown parity

**Files:**
- Create: `backend-nest/src/auth/orders-query-auth.guard.ts`, `backend-nest/src/auth/orders-query-auth.guard.spec.ts`
- Modify: `backend-nest/src/auth/guards.module.ts`
- Modify: `backend-nest/src/orders/orders.controller.ts`, `backend-nest/src/stores/stores.controller.ts`

**Interfaces:**
- Consumes: `SupabaseService`, `PrismaService` (`prisma.store.findUnique({ where: { user_id } })`), `AdminGuard` from Task 6.
- Produces: `OrdersQueryAuthGuard`, exported from `GuardsModule`.

**Why this task exists:** the lockdown that added these checks was **Express-only**. NestJS never received it, so `@Get(':id/stats')` and the orders list are still open there. Shipping Task 6 alone would leave two holes that open on the day Nest is deployed — the same failure mode as the deleted `BigInt` shim, where two individually-correct changes combined into a broken backend.

- [ ] **Step 1: Write the failing spec**

`orders-query-auth.guard.spec.ts` must cover all four branches, mirroring `authorizeOrdersQuery` in `backend/src/middleware/auth.middleware.js`:

- `query.ids` present → resolves `true` without consulting Supabase at all (assert the Supabase double was **not** called — otherwise the test passes for the wrong reason);
- `query.storeId` present, no token → `UnauthorizedException`;
- `query.storeId` present, valid seller token, but the token's store id differs → `ForbiddenException`, `'No tienes permiso sobre esta tienda'`;
- `query.storeId` present, valid seller token, matching store → `true`;
- neither present → falls through to the admin check: a non-admin token → `ForbiddenException`; an admin token → `true`.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend-nest && npm test -- orders-query-auth`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the guard**

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { RequestWithAdmin } from './request-with-admin.interface';

// Tres llamantes legítimos, tres comprobaciones distintas. Mantener en
// sintonía con authorizeOrdersQuery de backend/src/middleware/auth.middleware.js.
//
//   ?ids=...     el cliente consultando "mis pedidos". Conocer los ids ES la
//                credencial. Sólo es seguro con ids UUID v7.
//   ?storeId=... el panel del vendedor: exige sesión y que la tienda sea suya.
//   sin filtro   devuelve la tabla entera con los datos personales de cada
//                cliente. Sólo administración.
@Injectable()
export class OrdersQueryAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly adminGuard: AdminGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const { storeId, ids } = request.query as { storeId?: string; ids?: string };

    if (ids) {
      return true;
    }

    if (storeId) {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('Token no proporcionado');
      }

      const token = authHeader.split(' ')[1];
      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      const store = await this.prisma.store.findUnique({ where: { user_id: user.id } });
      if (!store) {
        throw new ForbiddenException('No se encontró una tienda asociada a este usuario');
      }

      if (String(store.id) !== String(storeId)) {
        throw new ForbiddenException('No tienes permiso sobre esta tienda');
      }

      return true;
    }

    return this.adminGuard.canActivate(context);
  }
}
```

- [ ] **Step 4: Wire it up**

Add `OrdersQueryAuthGuard` to `providers` and `exports` in `guards.module.ts`.

Apply `@UseGuards(OrdersQueryAuthGuard)` to `orders.controller.ts`'s `@Get()`.

Apply `@UseGuards(SellerAuthGuard, StoreOwnershipGuard)` to `stores.controller.ts`'s `@Get(':id/stats')`, matching how `@Put(':id/credentials')` in the same file is already guarded.

- [ ] **Step 5: Run everything green**

Run: `cd backend-nest && npx tsc --noEmit && npm test && npm run test:e2e`
Expected: 0 type errors, unit and e2e suites pass.

The orders e2e tests almost certainly call `GET /api/orders` with no query and will now get 401. Update them to exercise the real branches — one with `?ids=`, one with a mocked seller token and `?storeId=`, one with a mocked admin token and no filter — rather than loosening the guard.

- [ ] **Step 6: Commit**

```bash
git add backend-nest/src
git commit -m "NestJS: bring orders and store stats to parity with the Express lockdown"
```

---

## Task 8: End-to-end verification against a local stack

**Files:** none changed. This task produces evidence, and a report.

**Interfaces:**
- Consumes: everything built in Tasks 1-7.
- Produces: a written result appended to the SDD ledger, and a `PASS`/`FAIL` from `backend/smoke_admin_auth.mjs`.

**Why a separate task:** `backend/` has no test runner, so nothing in Tasks 2-5 has been executed against a real Supabase Auth. The NestJS suites mock Prisma and Supabase, and this project has already produced a case — the deleted `BigInt` shim — where 132 green mocked tests coexisted with a backend that returned 500 on every endpoint.

- [ ] **Step 1: Bring up a local stack**

In a scratch directory outside the repository: `npx --yes supabase@2.115.0 init --force` then `npx --yes supabase@2.115.0 start`. Read the credentials with `npx supabase status -o env`. **Never print the service-role key into the transcript.**

Apply the pre-migration schema, then `backend/migrations/001_uuid_v7_function.sql` and `002_uuid_v7_migration.sql`, so the database matches what production will look like after the cutover.

- [ ] **Step 2: Create the two accounts**

Register a seller through `POST /api/auth/register`. Register a second account and grant it the admin role with `node backend/set_admin_role.js <correo>` — this exercises Task 1 for real.

- [ ] **Step 3: Run the smoke check in local mode**

Run: `MODE=local BASE=http://127.0.0.1:5001 ADMIN_EMAIL=... ADMIN_PASSWORD=... SELLER_EMAIL=... SELLER_PASSWORD=... node backend/smoke_admin_auth.mjs`
Expected: `PASS`, every assertion `ok`.

- [ ] **Step 4: Prove the guard is load-bearing**

Temporarily change `authenticateAdmin` so the role check always passes, restart Express, and confirm the seller-token assertions now **FAIL**. Then revert the change and confirm they pass again.

A test that passes with the protection removed is not testing the protection. This project has already shipped one such case.

- [ ] **Step 5: Verify the NestJS side against the real database**

Build and boot `backend-nest` against the local stack, and confirm with real HTTP calls: a request with no token to a guarded route returns 401, a seller token returns 403, an admin token returns 200, and `GET /api/orders?ids=<uuid>` returns 200 without any token.

- [ ] **Step 6: Tear down and report**

Stop the stack with `npx supabase stop --no-backup` and shred any local credential files written during the run.

Append to the ledger: which assertions ran, the result of the load-bearing check in Step 4, the NestJS numbers, and anything surprising.

---

## Rollout (not part of implementation — run by a human)

1. `node backend/set_admin_role.js <your-email>` against production, with production credentials in the environment.
2. Deploy `backend/` and `admin-frontend/` together.
3. Run `smoke_admin_auth.mjs` against production in its default read-only mode.
4. Unset `ADMIN_API_KEY` in the backend's Vercel project.

## What this plan does NOT cover

- Login rate limiting and MFA on the admin account. The admin credential can change any user's password and rewrite any store's payment details, so the platform rests on one password. MFA is the first follow-up.
- `POST /api/upload` and `PUT /api/orders/:id`, still unauthenticated. Customers legitimately call both, so each needs its own design.
- Findings #1 (order price tampering) and #4 (pending stores in public listings).
