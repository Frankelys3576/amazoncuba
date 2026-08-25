import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from './admin.guard';

// GET /api/stores es público y por eso NUNCA responde 401: un token caducado
// se resuelve como anónimo y la respuesta es un 200 con el listado de tiendas
// aprobadas. Para el panel de administración eso es una trampa: su
// handleAuthFailure (admin-frontend/src/services/api.js) sólo reacciona al
// 401, así que un administrador con la sesión caducada veía CERO tiendas
// pendientes y ningún error.
//
// Con ?as=admin el llamante declara que espera datos de administrador y
// entonces sí se exige credencial: AdminGuard responde 401 (o 403) y el panel
// vuelve al login. Sin el parámetro la ruta sigue siendo pública.
//
// Espejo de requireAdminWhenRequested en
// backend/src/middleware/auth.middleware.js.
@Injectable()
export class AdminWhenRequestedGuard implements CanActivate {
  constructor(private readonly adminGuard: AdminGuard) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.query.as !== 'admin') return true;
    return this.adminGuard.canActivate(context);
  }
}
