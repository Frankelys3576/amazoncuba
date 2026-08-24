import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestWithAdmin } from './request-with-admin.interface';

// El rol vive en app_metadata, que sólo se puede escribir con la
// SERVICE_ROLE_KEY. user_metadata NO sirve: cualquier usuario autenticado
// puede modificar el suyo con updateUser.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
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

    const appMetadata = user.app_metadata as { role?: string } | null;
    if (!appMetadata || appMetadata.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos de administrador');
    }

    request.admin = user;
    return true;
  }
}
