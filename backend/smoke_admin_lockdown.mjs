// Comprueba el cierre de la API administrativa.
//
// Antes de este cambio la API administrativa no comprobaba nada:
// `GET /api/users` listaba a todos los usuarios y `PUT /api/users/:id`
// cambiaba la contraseña de cualquiera, sin credencial alguna.
//
// Uso:
//   BASE=http://localhost:5001 ADMIN_KEY=... EMAIL=... PASSWORD=... \
//     node backend/smoke_admin_lockdown.mjs
//
// Sólo escribe cuando la petición debe ser RECHAZADA (y entonces no llega al
// controlador). Las rutas mutantes nunca se ejercitan con credencial válida.
const BASE = process.env.BASE || 'http://localhost:5001';
const ADMIN_KEY = process.env.ADMIN_KEY;
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
};

const call = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.status;
};

const FAKE = '00000000-0000-7000-8000-000000000000';
const admin = { 'x-admin-key': ADMIN_KEY ?? '' };

console.log('-- sin credencial: toda ruta administrativa debe rechazar --');
check(await call('/api/users') === 401, 'GET /api/users rechaza sin credencial');
check(await call(`/api/users/${FAKE}`, { method: 'PUT', body: { password: 'no-debe-aplicarse' } }) === 401,
  'PUT /api/users/:id rechaza sin credencial (cambio de contraseña ajeno)');
check(await call(`/api/users/${FAKE}`, { method: 'DELETE' }) === 401, 'DELETE /api/users/:id rechaza sin credencial');
check(await call('/api/settings', { method: 'POST', body: { key: 'x', value: 'y' } }) === 401,
  'POST /api/settings rechaza sin credencial');
check(await call(`/api/stores/${FAKE}/status`, { method: 'PUT', body: { status: 'approved' } }) === 401,
  'PUT /api/stores/:id/status rechaza sin credencial');
check(await call(`/api/stores/${FAKE}/zelle`, { method: 'PUT', body: { zelle_info: {} } }) === 401,
  'PUT /api/stores/:id/zelle rechaza sin credencial');
check(await call(`/api/stores/${FAKE}/admin-details`) === 401, 'GET /api/stores/:id/admin-details rechaza sin credencial');

console.log('\n-- credencial incorrecta --');
check(await call('/api/users', { headers: { 'x-admin-key': 'clave-incorrecta' } }) === 403,
  'GET /api/users rechaza una credencial incorrecta con 403');

console.log('\n-- lo que debe seguir siendo público --');
check(await call('/api/settings') === 200, 'GET /api/settings sigue siendo público (lo lee la tienda)');
check(await call('/api/stores') === 200, 'GET /api/stores sigue siendo público');
check(await call('/api/products') === 200, 'GET /api/products sigue siendo público');

console.log('\n-- GET /api/orders: los tres llamantes --');
check(await call('/api/orders') === 401, 'sin filtro exige administración (hallazgo #2)');
check(await call(`/api/orders?ids=${FAKE}`) === 200, 'con ?ids= responde al cliente');
check(await call(`/api/orders?storeId=${FAKE}`) === 401, 'con ?storeId= exige sesión de vendedor');

if (ADMIN_KEY) {
  console.log('\n-- con credencial de administrador --');
  check(await call('/api/users', { headers: admin }) === 200, 'GET /api/users responde con credencial válida');
  check(await call('/api/orders', { headers: admin }) === 200, 'GET /api/orders responde con credencial válida');
} else {
  console.log('\n(sin ADMIN_KEY: no se comprueba el camino autorizado)');
}

if (EMAIL && PASSWORD) {
  console.log('\n-- sesión de vendedor --');
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const lj = await lr.json().catch(() => ({}));
  const token = lj?.session?.access_token;
  const storeId = lj?.store?.id;
  check(Boolean(token && storeId), 'el vendedor inicia sesión y resuelve su tienda');
  if (token && storeId) {
    const auth = { Authorization: `Bearer ${token}` };
    check(await call(`/api/orders?storeId=${storeId}`, { headers: auth }) === 200,
      'el vendedor ve los pedidos de SU tienda');
    check(await call(`/api/orders?storeId=${FAKE}`, { headers: auth }) === 403,
      'el vendedor NO ve los pedidos de otra tienda');
    check(await call(`/api/stores/${storeId}/stats`, { headers: auth }) === 200,
      'el vendedor ve las estadísticas de SU tienda');
    check(await call(`/api/stores/${FAKE}/stats`, { headers: auth }) === 403,
      'el vendedor NO ve las estadísticas de otra tienda');
  }
} else {
  console.log('\n(sin EMAIL/PASSWORD: no se comprueba el camino del vendedor)');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL: ${failures} comprobación(es)`);
process.exit(failures === 0 ? 0 : 1);
