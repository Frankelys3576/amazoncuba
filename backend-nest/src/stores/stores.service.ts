import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { formatStore } from './store-format.util';
import { generateSlug } from '../auth/slug.util';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { UpdateStoreCredentialsDto } from './dto/update-store-credentials.dto';
import { UpdateZelleInfoDto } from './dto/update-zelle-info.dto';
import { RequestWithStore } from '../auth/request-with-store.interface';

// Rethrows a Prisma "record to update not found" error (P2025) as the 404
// Express returns for a zero-row update, and rethrows everything else
// unchanged so the global filter renders a 500 — a DB outage or constraint
// violation must not be reported to the caller as "store not found".
const rethrowAsNotFound = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new NotFoundException('Tienda no encontrada');
  }
  throw error;
};

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async findAll(query: { type?: string; province?: string; municipality?: string; q?: string }) {
    const stores = await this.prisma.store.findMany({
      where: query.type ? { store_type: query.type } : undefined,
    });
    let formatted = stores.map((s) => formatStore(s));

    if (query.province) {
      const p = query.province.toLowerCase();
      formatted = formatted.filter((s) => s.province?.toLowerCase() === p);
    }
    if (query.municipality) {
      const m = query.municipality.toLowerCase();
      formatted = formatted.filter((s) => s.municipality?.toLowerCase() === m);
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      formatted = formatted.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q),
      );
    }

    return formatted;
  }

  async findOne(idOrSlug: string) {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const store = isNumeric
      ? await this.prisma.store.findUnique({ where: { id: Number(idOrSlug) } })
      : await this.prisma.store.findFirst({ where: { slug: idOrSlug } });

    if (!store) throw new NotFoundException('Tienda no encontrada');
    return formatStore(store);
  }

  async updateStatus(id: number, status: string) {
    try {
      const store = await this.prisma.store.update({ where: { id }, data: { status } });
      return formatStore(store);
    } catch (error) {
      return rethrowAsNotFound(error);
    }
  }

  async updateZelleInfo(id: number, dto: UpdateZelleInfoDto) {
    try {
      return await this.prisma.store.update({
        where: { id },
        data: dto as Prisma.StoreUpdateInput,
      });
    } catch (error) {
      return rethrowAsNotFound(error);
    }
  }

  async updateProfile(id: number, dto: UpdateStoreProfileDto) {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    const updates: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      updates.name = dto.name;
      updates.slug = generateSlug(dto.name);
    }
    for (const field of [
      'description',
      'slogan',
      'phone',
      'logo_url',
      'banner_url',
      'is_open',
      'has_delivery',
      'opening_time',
      'closing_time',
      'store_type',
    ] as const) {
      if (dto[field] !== undefined) updates[field] = dto[field];
    }

    const zelleFields = [
      'province',
      'municipality',
      'address',
      'lat',
      'lng',
      'price_per_night',
      'gallery',
    ] as const;
    if (zelleFields.some((f) => dto[f] !== undefined)) {
      const current = (existing?.zelle_info as Record<string, unknown>) || {};
      const zelleUpdates: Record<string, unknown> = {};
      for (const f of zelleFields) {
        if (dto[f] !== undefined) zelleUpdates[f] = dto[f];
      }
      updates.zelle_info = { ...current, ...zelleUpdates };
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const store = await this.prisma.store.update({ where: { id }, data: updates });
      return formatStore(store);
    } catch (error) {
      return rethrowAsNotFound(error);
    }
  }

  async getStats(id: number) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [viewsToday, viewsThisMonth, viewsTotal] = await Promise.all([
      this.prisma.productView.count({
        where: { product: { store_id: id }, created_at: { gte: startOfToday } },
      }),
      this.prisma.productView.count({
        where: { product: { store_id: id }, created_at: { gte: startOfMonth } },
      }),
      this.prisma.productView.count({ where: { product: { store_id: id } } }),
    ]);

    return { viewsToday, viewsThisMonth, viewsTotal };
  }

  async getAdminDetails(id: number) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Tienda no encontrada');

    const activeProductsCount = await this.prisma.product.count({ where: { store_id: id } });
    const orderItems = await this.prisma.orderItem.findMany({
      where: { product: { store_id: id } },
      select: { quantity: true },
    });
    const totalSalesCount = orderItems.reduce((acc, item) => acc + item.quantity, 0);

    return { store: formatStore(store), activeProductsCount, totalSalesCount };
  }

  async updateCredentials(id: number, req: RequestWithStore, dto: UpdateStoreCredentialsDto) {
    const updates: { email?: string; password?: string } = {};
    let cleanPhone: string | null = null;

    if (dto.phone) {
      cleanPhone = dto.phone.replace(/[^0-9]/g, '');
      updates.email = `${cleanPhone}@cubaamazon.com`;
    }
    if (dto.password) {
      updates.password = dto.password;
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No se enviaron datos para actualizar');
    }

    const { error } = await this.supabaseService.client.auth.admin.updateUserById(
      req.user.id,
      updates,
    );
    if (error) throw new BadRequestException('Error al actualizar las credenciales en Auth');

    if (cleanPhone) {
      await this.prisma.store.update({ where: { id }, data: { phone: cleanPhone } });
    }

    return {
      message: 'Credenciales actualizadas exitosamente',
      phone: cleanPhone || req.store.phone,
    };
  }
}
