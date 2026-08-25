import {
  BadRequestException,
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
import { RequestWithStore } from './request-with-store.interface';
import { extractBearerToken } from './bearer-token.util';
import { UUID } from '../common/spanish-parse-uuid.pipe';

// Quién resulta ser el llamante. Espejo de resolveOrdersCaller en
// backend/src/middleware/auth.middleware.js.
type OrdersCaller =
  | { kind: 'anonymous'; error: string }
  | { kind: 'admin'; user: User }
  | { kind: 'seller'; user: User; store: Store }
  | { kind: 'user'; user: User };

// Estados que un vendedor puede fijar. Un cliente sólo puede marcar
// 'delivered' ("marcar como recibido"), y un administrador cualquiera de la
// lista completa (ORDER_STATUSES en orders.service.ts).
const SELLER_ORDER_STATUSES = ['shipped', 'delivered'];

// Autorización de PUT /api/orders/:id. Espejo de authorizeOrderUpdate en
// backend/src/middleware/auth.middleware.js. Tres llamantes, tres reglas:
//
//   cliente        sin credencial. Conocer el id del pedido ES la
//                  credencial, igual que en ?ids=. Sólo puede marcar
//                  'delivered'.
//   vendedor       sesión válida Y el pedido contiene un producto suyo.
//                  Sólo estados de gestión.
//   administrador  cualquier estado de la lista.
//
// Antes de esto la ruta no comprobaba NADA: cualquiera podía fijar
// cualquier estado en cualquier pedido recorriendo los ids.
@Injectable()
export class OrderUpdateAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly adminGuard: AdminGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithStore & { admin?: unknown }>();
    const status = (request.body as { status?: string })?.status;

    // Cliente sin credencial: sólo 'delivered'. No se consulta a Supabase.
    if (!request.headers.authorization) {
      if (status !== 'delivered') {
        throw new ForbiddenException(
          'No tienes permiso para cambiar este pedido',
        );
      }
      return true;
    }

    const caller = await this.resolveCaller(request);

    if (caller.kind === 'anonymous') {
      throw new UnauthorizedException(caller.error);
    }

    // El vendedor ya se resolvió más arriba (un solo getUser); delegar aquí
    // en AdminGuard repetiría esa llamada a Supabase para volver a derivar
    // el mismo rol. A diferencia de OrdersQueryAuthGuard (cuya rama sin
    // filtro nunca resuelve identidad antes de delegar), aquí sí la
    // tenemos: basta con fijar request.admin.
    if (caller.kind === 'admin') {
      request.admin = caller.user;
      return true;
    }

    if (caller.kind !== 'seller') {
      throw new ForbiddenException(
        'No se encontró una tienda asociada a este usuario',
      );
    }

    if (!SELLER_ORDER_STATUSES.includes(status as string)) {
      throw new ForbiddenException(
        'No tienes permiso para cambiar este pedido',
      );
    }

    const orderId = (request.params as { id?: string })?.id;

    // El vendedor sí consulta la base de datos (orderItem.findFirst), así
    // que un id malformado debe cortarse aquí con el mismo 400 que usa
    // SpanishParseUuidPipe, en vez de llegar a Prisma y convertirse en un
    // 500 antes de que el pipe del controlador tenga ocasión de rechazarlo.
    if (!orderId || !UUID.test(orderId)) {
      throw new BadRequestException('El identificador debe ser un UUID válido');
    }

    const ownedItem = await this.prisma.orderItem.findFirst({
      where: {
        order_id: orderId,
        product: { store_id: caller.store.id },
      },
    });

    if (!ownedItem) {
      throw new ForbiddenException('No tienes permiso sobre este pedido');
    }

    request.user = caller.user;
    request.store = caller.store;
    return true;
  }

  // Sólo mira la credencial; nunca lanza. El motivo del rechazo viaja en
  // `error` para no perder la distinción entre "falta la cabecera" y "el
  // token no vale": son dos 401 con mensajes distintos.
  private async resolveCaller(
    request: RequestWithStore & { admin?: unknown },
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

    // El rol se mira antes que la tienda: un administrador que además
    // tuviera tienda sigue siendo administrador aquí.
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
