// Comprueba la autenticación de administrador por token.
//
// MODE=local      ejecuta TODAS las comprobaciones, incluida la de
//                 autoascenso, que necesita crear una cuenta desechable.
// MODE=production (por defecto) sólo ejecuta lo que es seguro contra un
//                 sistema en producción: rechazos, rutas públicas y GET con
//                 un token de administrador válido.
//
// Configuración por variables de entorno (nunca se lee un archivo .env):
//   BASE, ADMIN_EMAIL, ADMIN_PASSWORD, SELLER_EMAIL, SELLER_PASSWORD, MODE
//   SUPABASE_URL, SUPABASE_ANON_KEY  (sólo hacen falta en MODE=local, para
//     que la cuenta desechable pueda escribir su propio user_metadata)
import { randomUUID } from 'node:crypto';

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

const call = async (method, path, { token, body, rawAuthHeader } = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rawAuthHeader !== undefined ? { Authorization: rawAuthHeader } : {}),
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
  return { token: j?.session?.access_token ?? null, id: j?.user?.id ?? null };
};

const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const seller = await login(process.env.SELLER_EMAIL, process.env.SELLER_PASSWORD);
const adminToken = admin.token;
const adminId = admin.id;
const sellerToken = seller.token;
check(Boolean(adminToken), 'la cuenta de administrador inicia sesión');
check(Boolean(sellerToken), 'la cuenta de vendedor inicia sesión');

console.log('\n-- sin token: las siete rutas administrativas rechazan --');
for (const [method, path] of ADMIN_ROUTES) {
  check(await call(method, path) === 401, `${method} ${path} responde 401 sin token`);
}
// Un header "Authorization: Bearer" sin token deja authHeader.split(' ')[1]
// como undefined, que se pasa tal cual a supabase.auth.getUser(). Se razonó
// que fallaba cerrado pero nunca se ejecutó: lo comprobamos aquí.
check(await call('GET', '/api/users', { rawAuthHeader: 'Bearer' }) === 401,
  'GET /api/users con "Authorization: Bearer" (sin token) responde 401, no 200');

console.log('\n-- con token de VENDEDOR: las siete rechazan con 403 --');
for (const [method, path] of ADMIN_ROUTES) {
  check(await call(method, path, { token: sellerToken }) === 403,
    `${method} ${path} responde 403 con token de vendedor`);
}

console.log('\n-- lo que debe seguir siendo público --');
check(await call('GET', '/api/settings') === 200, 'GET /api/settings sigue siendo público');
check(await call('GET', '/api/stores') === 200, 'GET /api/stores sigue siendo público');
check(await call('GET', '/api/products') === 200, 'GET /api/products sigue siendo público');

console.log('\n-- GET /api/orders: los tres llamantes --');
check(await call('GET', '/api/orders') === 401, 'sin filtro exige administración');
check(await call('GET', `/api/orders?ids=${FAKE}`) === 200, 'con ?ids= responde al cliente sin credencial');
check(await call('GET', `/api/orders?storeId=${FAKE}`) === 401, 'con ?storeId= y sin token exige sesión de vendedor');

console.log('\n-- con token de ADMINISTRADOR --');
check(await call('GET', '/api/users', { token: adminToken }) === 200,
  'GET /api/users responde con token de administrador válido');
check(await call('GET', '/api/orders', { token: adminToken }) === 200,
  'GET /api/orders responde con token de administrador válido');

if (MODE === 'local') {
  console.log('\n-- autoascenso: escribir tu propio user_metadata no debe conceder nada --');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    check(false, 'faltan SUPABASE_URL/SUPABASE_ANON_KEY en el entorno: no se puede probar el autoascenso');
  } else {
    const throwawayEmail = `smoke-admin-auth-${randomUUID()}@example.com`;
    const throwawayPassword = randomUUID();

    const registerStatus = await call('POST', '/api/auth/register', {
      body: { email: throwawayEmail, password: throwawayPassword, full_name: 'Smoke Test Desechable' },
    });
    check(registerStatus === 201, 'la cuenta desechable se registra');

    const throwaway = await login(throwawayEmail, throwawayPassword);
    check(Boolean(throwaway.token), 'la cuenta desechable inicia sesión');

    if (throwaway.token) {
      const promoteResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${throwaway.token}`,
        },
        body: JSON.stringify({ data: { role: 'admin' } }),
      });
      check(promoteResp.ok, 'la cuenta desechable escribe su propio user_metadata.role = admin');

      check(await call('GET', '/api/users', { token: throwaway.token }) === 403,
        'GET /api/users con ese token responde 403: user_metadata no concede nada');

      // Limpieza: la cuenta desechable no es de administrador, así que
      // borrarla con el token de administrador es una operación normal, no
      // una de las asserciones que deben ser rechazadas.
      if (adminToken && throwaway.id) {
        try {
          await call('DELETE', `/api/users/${throwaway.id}`, { token: adminToken });
        } catch {
          // La limpieza es best-effort; no afecta el resultado del smoke test.
        }
      }
    }
  }

  console.log('\n-- bloqueo de la propia cuenta de administrador --');
  if (!adminToken || !adminId) {
    check(false, 'no hay token/id de administrador: no se puede probar el bloqueo de autoeliminación');
  } else {
    // Estas dos peticiones apuntan a la cuenta REAL de administrador con una
    // credencial válida. Ambas DEBEN ser rechazadas (403): si cualquiera
    // devuelve 2xx, la cuenta de administrador acaba de ser modificada o
    // borrada de verdad. Lo anunciamos en voz alta en vez de salir en silencio.
    const deleteStatus = await call('DELETE', `/api/users/${adminId}`, { token: adminToken });
    if (deleteStatus >= 200 && deleteStatus < 300) {
      console.log('*** PELIGRO: DELETE /api/users/<admin> devolvió 2xx: LA CUENTA DE ADMINISTRADOR PUDO SER ELIMINADA ***');
    }
    check(deleteStatus === 403, 'DELETE /api/users/<id-de-administrador> responde 403 (bloqueo de autoeliminación)');

    const updateStatus = await call('PUT', `/api/users/${adminId}`, {
      token: adminToken,
      body: { password: randomUUID() },
    });
    if (updateStatus >= 200 && updateStatus < 300) {
      console.log('*** PELIGRO: PUT /api/users/<admin> devolvió 2xx: LA CONTRASEÑA DE ADMINISTRADOR PUDO SER CAMBIADA ***');
    }
    check(updateStatus === 403, 'PUT /api/users/<id-de-administrador> con nueva contraseña responde 403 (bloqueo de auto-modificación)');
  }
} else {
  console.log('\n(MODE=production: no se comprueba autoascenso ni el bloqueo de la propia cuenta de administrador)');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL: ${failures} comprobación(es)`);
process.exit(failures === 0 ? 0 : 1);
