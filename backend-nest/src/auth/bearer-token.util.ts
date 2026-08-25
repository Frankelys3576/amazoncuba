// Extrae el token de una cabecera Authorization, o devuelve null si la
// cabecera falta o está malformada.
//
// Defensa en profundidad. El código anterior hacía authHeader.split(' ')[1],
// que para una cabecera "Bearer" a secas da undefined, y lo pasaba tal cual a
// client.auth.getUser(). getUser(undefined) NO falla: recae en la sesión que
// el cliente compartido tenga guardada (ver supabase/supabase.service.ts).
// Aunque ese cliente ya no guarda ninguna, no queremos que la autorización
// dependa de un detalle interno de una librería: exigimos aquí un esquema
// Bearer con un token no vacío antes de preguntarle nada a Supabase.
//
// Gemelo de extractBearerToken en backend/src/middleware/auth.middleware.js.
export const extractBearerToken = (
  authHeader: string | string[] | undefined,
): string | null => {
  if (typeof authHeader !== 'string') return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  if (!token) return null;

  return token;
};
