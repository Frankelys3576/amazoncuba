import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

    this.client = createClient(supabaseUrl, supabaseKey);
  }
}
