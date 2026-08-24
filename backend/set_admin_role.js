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
