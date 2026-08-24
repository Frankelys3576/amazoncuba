import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithStore } from './request-with-store.interface';

@Injectable()
export class StoreOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithStore>();
    if (String(req.store.id) !== String(req.params.id)) {
      throw new ForbiddenException('No tienes permiso sobre esta tienda');
    }
    return true;
  }
}
