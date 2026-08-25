import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { extractBearerToken } from './bearer-token.util';

// Lo que se resuelve sobre el llamante de una ruta PÚBLICA que además tiene
// que atender a su dueño: si es administrador, y si es vendedor, el id de SU
// PROPIA tienda (o null). No es un espejo completo de resolveOrdersCaller --
// aquí sólo hace falta saber "es admin" y "de qué tienda es dueño", nunca el
// usuario ni la tienda entera.
export type StoreCaller = { isAdmin: boolean; storeId: string | null };

// Sólo mira la credencial, NUNCA lanza (a diferencia de AdminGuard o
// SellerAuthGuard): un llamante anónimo tiene que seguir viendo el listado
// público. Sin cabecera Authorization no hay ni una llamada de red.
//
// Vive aquí, y no en un método privado de StoresController, porque
// ProductsController necesita exactamente la misma resolución: GET
// /api/products publica el catálogo de una tienda y debe ocultar el de las no
// aprobadas salvo a su dueño o a un administrador (I2).
@Injectable()
export class StoreCallerService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async resolve(req: Request): Promise<StoreCaller> {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return { isAdmin: false, storeId: null };

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) return { isAdmin: false, storeId: null };

    // El rol se mira antes que la tienda: un administrador que además
    // tuviera tienda sigue siendo administrador aquí.
    const appMetadata = user.app_metadata as { role?: string } | null;
    if (appMetadata && appMetadata.role === 'admin') {
      return { isAdmin: true, storeId: null };
    }

    const store = await this.prisma.store.findUnique({ where: { user_id: user.id } });
    return { isAdmin: false, storeId: store ? store.id : null };
  }
}
