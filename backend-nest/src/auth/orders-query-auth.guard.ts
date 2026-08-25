import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { Store } from '@prisma/client';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { RequestWithAdmin } from './request-with-admin.interface';
import { extractBearerToken } from './bearer-token.util';

// Quién resulta ser el llamante. Espejo de resolveOrdersCaller en
// backend/src/middleware/auth.middleware.js: describe la credencial sin
// rechazar nada, para que el guard pueda componer "el vendedor dueño de la
// tienda O un administrador" y emitir una sola respuesta final.
type OrdersCaller =
  | { kind: 'anonymous'; error: string }
  | { kind: 'admin'; user: User }
  | { kind: 'seller'; user: User; store: Store }
  | { kind: 'user'; user: User };

// Tres llamantes legítimos, tres comprobaciones distintas. Mantener en
// sintonía con authorizeOrdersQuery de backend/src/middleware/auth.middleware.js.
//
//   ?ids=...     el cliente consultando "mis pedidos". Conocer los ids ES la
//                credencial. Sólo es seguro con ids UUID v7.
//   ?storeId=... el panel del vendedor Y el panel de administración: exige
//                sesión del vendedor dueño de ESA tienda, o de un
//                administrador (que puede consultar cualquiera). Un vendedor
//                sigue sin poder leer los pedidos de otra tienda.
//   sin filtro   devuelve la tabla entera con los datos personales de cada
//                cliente. Sólo administración.
//
// La rama de ?storeId= exigía sesión de VENDEDOR y nada más, así que el panel
// de administración —que manda su propio token— recibía un 403 al pulsar "ver
// pedidos" de una tienda: el administrador no tiene fila en `stores`.
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
      const caller = await this.resolveCaller(request);

      if (caller.kind === 'anonymous') {
        throw new UnauthorizedException(caller.error);
      }

      if (caller.kind === 'admin') {
        request.admin = caller.user;
        return true;
      }

      if (caller.kind !== 'seller') {
        throw new ForbiddenException(
          'No se encontró una tienda asociada a este usuario',
        );
      }

      if (String(caller.store.id) !== String(storeId)) {
        throw new ForbiddenException('No tienes permiso sobre esta tienda');
      }

      return true;
    }

    return this.adminGuard.canActivate(context);
  }

  // Sólo mira la credencial; nunca lanza. El motivo del rechazo viaja en
  // `error` para no perder la distinción entre "falta la cabecera" y "el
  // token no vale": son dos 401 con mensajes distintos.
  private async resolveCaller(
    request: RequestWithAdmin,
  ): Promise<OrdersCaller> {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return { kind: 'anonymous', error: 'Token no proporcionado' };
    }

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) {
      return { kind: 'anonymous', error: 'Token inválido o expirado' };
    }

    // El rol se mira antes que la tienda: un administrador que además tuviera
    // tienda sigue siendo administrador aquí.
    const appMetadata = user.app_metadata as { role?: string } | null;
    if (appMetadata && appMetadata.role === 'admin') {
      return { kind: 'admin', user };
    }

    const store = await this.prisma.store.findUnique({
      where: { user_id: user.id },
    });

    if (store) {
      return { kind: 'seller', user, store };
    }

    return { kind: 'user', user };
  }
}
