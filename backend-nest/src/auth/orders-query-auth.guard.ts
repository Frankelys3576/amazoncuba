import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { RequestWithAdmin } from './request-with-admin.interface';

// Tres llamantes legítimos, tres comprobaciones distintas. Mantener en
// sintonía con authorizeOrdersQuery de backend/src/middleware/auth.middleware.js.
//
//   ?ids=...     el cliente consultando "mis pedidos". Conocer los ids ES la
//                credencial. Sólo es seguro con ids UUID v7.
//   ?storeId=... el panel del vendedor: exige sesión y que la tienda sea suya.
//   sin filtro   devuelve la tabla entera con los datos personales de cada
//                cliente. Sólo administración.
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
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('Token no proporcionado');
      }

      const token = authHeader.split(' ')[1];
      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      const store = await this.prisma.store.findUnique({ where: { user_id: user.id } });
      if (!store) {
        throw new ForbiddenException('No se encontró una tienda asociada a este usuario');
      }

      if (String(store.id) !== String(storeId)) {
        throw new ForbiddenException('No tienes permiso sobre esta tienda');
      }

      return true;
    }

    return this.adminGuard.canActivate(context);
  }
}
