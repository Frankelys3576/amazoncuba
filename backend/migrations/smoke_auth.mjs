// End-to-end auth check over real HTTP. This is the only thing that
// exercises the seller login -> store-ownership path (stores.user_id FK,
// not the old email-parsing lookup) against a running server; `backend/`
// has no test runner. Run it twice: once against the dry-run database
// before the migration is trusted, and once against production immediately
// after cutover, before traffic is reopened.
//
// Usage:
//   BASE=http://localhost:5001 EMAIL=... PASSWORD=... node backend/migrations/smoke_auth.mjs
//
// Credentials come from the environment only — never hardcode EMAIL/PASSWORD
// here, and never log them. Only HTTP status codes and response bodies
// (which never contain the password) are printed, including on failure.
//
// Not read-only: performs a real login (issues a new Supabase session) and
// sends authenticated PUT requests to /api/stores/:id with an empty JSON
// body. The controller short-circuits an empty body to 400 "no fields to
// update" before touching the database, so nothing is ever created,
// modified, or deleted. A token is deliberately never sent to
// /api/auth/delete — only the no-auth/forged-auth cases hit that route,
// both of which must be rejected before reaching the delete handler.

const BASE = process.env.BASE || 'http://localhost:5001';
const { EMAIL, PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) { console.error('set EMAIL and PASSWORD'); process.exit(1); }

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

const json = async (r) => { try { return await r.json(); } catch { return null; } };

// ---- 1. login -----------------------------------------------------------
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const login = await json(loginRes);
check(loginRes.status === 200, `login returns 200 (got ${loginRes.status})`);

const token = login?.session?.access_token;
check(!!token, 'login returns a session access_token');

const authedUserId = login?.user?.id;
check(!!authedUserId, 'login returns the authenticated user id');

const store = login?.store;
check(!!store, 'login resolves a store');
check(store?.user_id != null, "the resolved store's user_id is set (row was backfilled, not left NULL/unowned)");

// A non-null user_id is not enough on its own: it would also pass if login
// resolved a *different* seller's store (e.g. an unfiltered/mis-ordered
// query grabbed the first row in the table). The only assertion that
// actually catches "resolved to the wrong store" is comparing the store's
// user_id against the id of the user this call just authenticated as.
check(
  !!store && !!authedUserId && String(store.user_id) === String(authedUserId),
  "the resolved store's user_id equals the authenticated user's id (proves it's THIS seller's store, not merely a store with some owner)"
);

// ---- 2. the token must authorize a guarded route, and that route must
// independently agree the login-resolved store is the caller's own store.
//
// PUT /api/stores/:id is the only route protected by BOTH
// authenticateSeller and requireStoreOwnership. authenticateSeller
// re-resolves the caller's store from the token's user id via a second,
// completely separate stores lookup (not reusing login's answer);
// requireStoreOwnership then compares that store's id against the :id in
// the URL. Sending an empty JSON body makes the controller itself return
// 400 "no fields to update" before any write, so these calls never mutate
// data.
//
// GET /api/stores/:id is deliberately NOT used for this: it carries no auth
// middleware at all (see backend/src/routes/store.routes.js), so it returns
// 200 for a missing, garbage, or entirely absent Authorization header. An
// assertion built on it would pass even if auth were completely broken.
if (token && store?.id) {
  const ownRes = await fetch(`${BASE}/api/stores/${store.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  check(
    ownRes.status === 400,
    `guarded route accepts the token and independently confirms ownership of the login-resolved store (PUT own store id, empty body -> expect 400 "no fields", got ${ownRes.status})`
  );
} else {
  check(false, 'guarded-route ownership check skipped: no token or store id from login');
}

// A store id the caller does NOT own must be rejected. This specifically
// targets a removed/weakened requireStoreOwnership: because the body is
// empty, a bypassed ownership check would fall through to the same 400
// "no fields to update" as the success case above — so 403 here is the
// only outcome that proves ownership was actually enforced, not merely
// that *some* 4xx came back.
if (token) {
  const foreignId = '00000000-0000-0000-0000-000000000000';
  const otherRes = await fetch(`${BASE}/api/stores/${foreignId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  check(
    otherRes.status === 403,
    `guarded route rejects a store id the caller does not own, not falling through to the empty-body 400 (got ${otherRes.status})`
  );
} else {
  check(false, 'cross-store ownership rejection check skipped: no token from login');
}

// ---- 3. unauthenticated and forged requests must be rejected, never
// silently allowed through. This is the regression that would matter most,
// and the brief's original happy-path-only draft would never have seen it.
const noAuthRes = await fetch(`${BASE}/api/auth/delete`, { method: 'POST' });
check(noAuthRes.status === 401, `no Authorization header on a guarded route returns 401, not 2xx (got ${noAuthRes.status})`);

const noAuthOwnRes = await fetch(`${BASE}/api/stores/${store?.id ?? 'missing-store-id'}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}',
});
check(noAuthOwnRes.status === 401, `no Authorization header on the ownership-guarded route also returns 401 (got ${noAuthOwnRes.status})`);

const forgedRes = await fetch(`${BASE}/api/auth/delete`, {
  method: 'POST', headers: { Authorization: 'Bearer this-is-not-a-real-token' },
});
check(forgedRes.status === 401, `a forged/garbage bearer token is rejected with 401, not silently accepted (got ${forgedRes.status})`);

console.log(failures === 0
  ? '\nPASS: login resolves the authenticated user\'s own store, the token authorizes and is ownership-checked on a guarded route, and unauthenticated/forged requests are rejected'
  : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
