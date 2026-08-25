import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Almacenamiento que descarta todo lo que se le da y nunca devuelve nada.
// Es lo que convierte al cliente compartido en un cliente SIN sesión.
const almacenamientoQueNoGuardaNada = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL as string;
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY) as string;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Faltan credenciales de Supabase en el archivo .env');
    }

    // ESTE CLIENTE NO DEBE GUARDAR NUNCA UNA SESIÓN DE USUARIO.
    //
    // AuthService.login llama a signInWithPassword sobre este mismo cliente
    // compartido. Si la librería recuerda la sesión resultante, cualquier
    // llamada posterior a client.auth.getUser(undefined) —que es exactamente
    // lo que produce una cabecera "Authorization: Bearer" sin token— deja de
    // fallar: recae en la sesión guardada y devuelve el último usuario que
    // inició sesión. Si ese último usuario era el administrador, un atacante
    // que envíe "Authorization: Bearer" a secas queda autenticado como él.
    //
    // OJO: `persistSession: false` NO basta en @supabase/supabase-js 2.x. En
    // ese caso la librería no deja de guardar la sesión: se fabrica un
    // almacenamiento en memoria propio (memoryLocalStorageAdapter) y la
    // recuerda durante toda la vida del proceso. Comprobado contra la versión
    // instalada. La única forma de que no recuerde nada es inyectar
    // `storage`, y `storage` sólo se tiene en cuenta cuando `persistSession`
    // es true. De ahí la combinación de abajo, que parece contradictoria y no
    // lo es: "persiste" en un almacenamiento que tira todo a la basura.
    //
    // signInWithPassword sigue devolviendo la sesión en el cuerpo de la
    // respuesta, que es lo único que usa login para responder al cliente.
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: almacenamientoQueNoGuardaNada,
      },
    });
  }
}
