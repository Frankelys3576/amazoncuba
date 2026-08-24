import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { generateSlug } from './slug.util';

const extractPhoneFromEmail = (email: string): string =>
  email.split('@')[0].replace(/\+/g, '').replace(/\s/g, '');

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const { data, error } =
      await this.supabaseService.client.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: { full_name: dto.full_name },
      });
    // Ruling 1: Express catches everything from this call and returns
    // res.status(400).json({ error: error.message || 'Error al registrar el usuario' }).
    // A raw throw would hit the global filter as an unhandled 500 instead.
    if (error) {
      throw new BadRequestException(
        error.message || 'Error al registrar el usuario',
      );
    }

    const autoApproveSetting = await this.prisma.platformSetting.findUnique({
      where: { key: 'auto_approve_sellers' },
    });
    const isAutoApprove = autoApproveSetting?.value === 'true';

    if (dto.store_name) {
      const phoneMatch = extractPhoneFromEmail(dto.email);
      const finalPhone = dto.phone
        ? dto.phone.replace(/[^0-9]/g, '')
        : phoneMatch;
      const storeNumber = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const slug = generateSlug(dto.store_name);

      const zelleInfo = {
        province: dto.province || null,
        municipality: dto.municipality || null,
        address: dto.address || null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        price_per_night: dto.price_per_night ?? null,
      };

      try {
        // Ruling 2: the Supabase Auth user above has already been created by
        // this point. Express deliberately swallows a store-insert error and
        // still returns 201 with the created user ("Podríamos manejar este
        // error o simplemente dejarlo pasar") — failing the whole request
        // here would leave the same orphaned auth user AND return an error,
        // which is strictly worse than what Express does.
        await this.prisma.store.create({
          data: {
            name: dto.store_name,
            slug,
            description:
              dto.description ||
              (dto.store_type === 'hostal'
                ? `Hostal de ${dto.full_name}`
                : `Nueva tienda de ${dto.full_name}`),
            status: isAutoApprove ? 'approved' : 'pending',
            store_type: dto.store_type || 'business',
            phone: finalPhone,
            store_number: storeNumber,
            zelle_info: zelleInfo,
            ...(dto.store_type === 'hostal'
              ? {
                  province: dto.province || null,
                  municipality: dto.municipality || null,
                  address: dto.address || null,
                  lat: dto.lat ?? null,
                  lng: dto.lng ?? null,
                  price_per_night: dto.price_per_night ?? null,
                }
              : {}),
          },
        });
      } catch (storeError) {
        console.error('Error creating store:', storeError);
        // No relanzamos: dejamos pasar, igual que el backend Express.
      }
    }

    return {
      message: 'Usuario y tienda registrados exitosamente',
      user: data.user,
      autoApproved: isAutoApprove,
    };
  }

  async login(dto: LoginDto) {
    const { data, error } =
      await this.supabaseService.client.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });
    if (error) throw new UnauthorizedException('Credenciales inválidas');

    const phone = extractPhoneFromEmail(dto.email);
    // Exact match, not `contains` — see the same note in SellerAuthStrategy
    // (Task 4): a substring match is an authorization bypass (a short phone
    // could match inside a longer, unrelated store's phone).
    // Prisma's findFirst returns null (rather than throwing) when nothing
    // matches, so login tolerates a missing store the same way Express does
    // with its inner try/catch around Supabase's .single() lookup.
    const store = await this.prisma.store.findFirst({
      where: { phone },
    });

    return {
      message: 'Login exitoso',
      session: data.session,
      user: data.user,
      store,
    };
  }

  async deleteAccount(storeId: number | bigint) {
    const products = await this.prisma.product.findMany({
      where: { store_id: storeId },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);

    if (productIds.length > 0) {
      await this.prisma.orderItem.deleteMany({
        where: { product_id: { in: productIds } },
      });
      await this.prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
    }

    await this.prisma.store.delete({ where: { id: storeId } });

    return { message: 'Cuenta eliminada exitosamente' };
  }
}
