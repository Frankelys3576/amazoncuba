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
import { extractPhoneFromEmail } from './extract-phone-from-email.util';

// Mirrors Express's `value ? parseFloat(value) : null` at every one of its
// six lat/lng/price_per_night call sites. The frontends send these as
// strings (SellerAuth.jsx .toString()s coordinates; price_per_night comes
// from an <input type="number">, which React holds as a string), and
// Prisma's lat/lng columns are Float — an un-coerced string throws inside
// the try/catch below and silently drops the store row.
// Falsy-in/null-out is intentional and matches Express exactly, including
// the 0 -> null quirk: do not "improve" this with Number(), which turns ''
// into 0 instead of null.
const toFloatOrNull = (
  value: string | number | null | undefined,
): number | null => (value ? parseFloat(String(value)) : null);

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

    // M1: without this try/catch, a DB blip reading platform_settings here
    // — after the Supabase Auth user above has already been created — would
    // 500 the whole request and orphan that auth user. Express swallows this
    // read failure and falls back to isAutoApprove = false
    // (auth.controller.js:29-44); mirror that here with the same
    // swallow-and-log semantics already used for the store.create() call
    // immediately below (Ruling 2).
    let isAutoApprove = false;
    try {
      const autoApproveSetting = await this.prisma.platformSetting.findUnique({
        where: { key: 'auto_approve_sellers' },
      });
      isAutoApprove = autoApproveSetting?.value === 'true';
    } catch (settingsError) {
      console.error(
        'Error reading auto_approve_sellers setting:',
        settingsError,
      );
    }

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
        lat: toFloatOrNull(dto.lat),
        lng: toFloatOrNull(dto.lng),
        price_per_night: toFloatOrNull(dto.price_per_night),
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
                  lat: toFloatOrNull(dto.lat),
                  lng: toFloatOrNull(dto.lng),
                  price_per_night: toFloatOrNull(dto.price_per_night),
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
