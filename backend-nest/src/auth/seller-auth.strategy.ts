import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellerAuthStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async validate(token: string) {
    // Defensa en profundidad: nunca llamamos a getUser con un token vacío o
    // ausente. getUser(undefined) NO falla — recae en la sesión que el cliente
    // compartido tenga guardada (ver supabase/supabase.service.ts) y devuelve
    // el último usuario que inició sesión. passport-http-bearer ya rechaza
    // hoy una cabecera "Bearer" a secas, pero la autorización no debe
    // depender de eso.
    if (typeof token !== 'string' || token.trim() === '') {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user || !user.email) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const store = await this.prisma.store.findUnique({
      where: { user_id: user.id },
    });

    if (!store) {
      throw new ForbiddenException(
        'No se encontró una tienda asociada a este usuario',
      );
    }

    return { user, store };
  }
}
