import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractPhoneFromEmail } from './extract-phone-from-email.util';

@Injectable()
export class SellerAuthStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async validate(token: string) {
    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user || !user.email) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const phone = extractPhoneFromEmail(user.email);
    const store = await this.prisma.store.findFirst({
      where: { phone },
    });

    if (!store) {
      throw new ForbiddenException(
        'No se encontró una tienda asociada a este usuario',
      );
    }

    return { user, store };
  }
}
