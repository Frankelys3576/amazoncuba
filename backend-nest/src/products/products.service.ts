import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { formatProduct } from './product-format.util';
import type { StoreCaller } from '../auth/store-caller.service';
import { coerceDecimalFields } from '../common/decimal.util';

// price/price_usd/rating_avg are Decimal/Decimal? columns on `products`.
// Applied to raw create/update/delete row responses (see Finding 2), which
// intentionally do NOT go through `formatProduct` — Express returns the
// bare Supabase row on these routes too, and running the full formatter
// here would add store_name/store_slug/etc fields Express never returns.
const DECIMAL_FIELDS = ['price', 'price_usd', 'rating_avg'] as const;

const STORE_INCLUDE = {
  store: {
    select: { accepts_zelle: true, name: true, phone: true, slug: true, has_delivery: true, id: true },
  },
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: {
      storeId?: string;
      q?: string;
      category?: string;
      province?: string;
      municipality?: string;
      store_category_id?: string;
      requireImage?: string;
    },
    caller: StoreCaller,
  ) {
    const where: Record<string, unknown> = {};

    // I2, la tercera puerta: este listado no filtraba por el estado de la
    // tienda y publica store_name, store_phone y store_slug, así que una
    // tienda 'pending' tenía catálogo público y comprable -- y de paso
    // regalaba el slug que GET /api/stores/:id se niega a confirmar.
    //
    // El filtro NO se aplica al administrador ni al vendedor dueño:
    // seller-frontend lista su propio catálogo con ?storeId=<suyo> y debe
    // seguir viéndolo mientras espera aprobación. Espejo de getProducts en
    // backend/src/controllers/product.controller.js, donde el mismo filtro se
    // expresa como `stores!inner(...)` + status/or: un producto sin tienda
    // tampoco pasa el filtro relacional de Prisma, igual que no pasa el INNER
    // JOIN de PostgREST.
    if (!caller.isAdmin) {
      const visible: Record<string, unknown>[] = [{ store: { status: 'approved' } }];
      if (caller.storeId) visible.push({ store_id: caller.storeId });
      where.OR = visible;
    }
    // Product.store_id/category_id/store_category_id are uuid columns now,
    // so the query string values are used as-is — no numeric coercion.
    if (query.storeId) where.store_id = query.storeId;
    if (query.category) where.category_id = query.category;
    if (query.store_category_id) where.store_category_id = query.store_category_id;
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.requireImage) where.image_url = { not: null, notIn: [''] };

    if (query.province && query.municipality) {
      where.delivery_locations = {
        hasSome: [
          `${query.province}:${query.municipality}`,
          `${query.province}:Toda la provincia`,
          'Toda Cuba:Toda Cuba',
        ],
      };
    } else if (query.province) {
      where.delivery_locations = {
        hasSome: [`${query.province}:Toda la provincia`, 'Toda Cuba:Toda Cuba'],
      };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: STORE_INCLUDE,
      // Finding 1: Express opts in explicitly to `nullsFirst: false` (i.e.
      // NULLS LAST) on this column (product.controller.js:33). Prisma's
      // bare 'desc' falls through to Postgres's native DESC default, which
      // is NULLS FIRST — the opposite — so this must be spelled out.
      orderBy: [{ is_featured: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
    });

    return products.map(formatProduct);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: STORE_INCLUDE,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return formatProduct(product);
  }

  async create(dto: CreateProductDto, callerStore: Store) {
    if (dto.store_id !== callerStore.id) {
      throw new ForbiddenException('No tienes permiso para crear productos en esta tienda');
    }

    const delivery_locations = dto.delivery_locations || [`${dto.province}:${dto.municipality}`];
    const currency = dto.currency || 'USD';

    const product = await this.prisma.product.create({
      data: { ...dto, currency, delivery_locations },
    });
    return coerceDecimalFields(product, DECIMAL_FIELDS);
  }

  async update(id: string, dto: UpdateProductDto, callerStore: Store) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    if (existing.store_id !== callerStore.id) {
      throw new ForbiddenException('No tienes permiso para editar este producto');
    }

    const data: Record<string, unknown> = { ...dto };
    if (data.currency === null) data.currency = 'USD';

    const product = await this.prisma.product.update({ where: { id }, data });
    return coerceDecimalFields(product, DECIMAL_FIELDS);
  }

  async remove(id: string, callerStore: Store) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    if (existing.store_id !== callerStore.id) {
      throw new ForbiddenException('No tienes permiso para eliminar este producto');
    }

    await this.prisma.orderItem.deleteMany({ where: { product_id: id } });
    const product = await this.prisma.product.delete({ where: { id } });
    return {
      message: 'Producto eliminado correctamente',
      product: coerceDecimalFields(product, DECIMAL_FIELDS),
    };
  }

  async registerView(id: string) {
    await this.prisma.productView.create({ data: { product_id: id } });
    return { message: 'View registered' };
  }

  findReviews(id: string) {
    return this.prisma.productReview.findMany({
      where: { product_id: id },
      orderBy: { created_at: 'desc' },
    });
  }

  addReview(id: string, dto: CreateProductReviewDto) {
    return this.prisma.productReview.create({
      data: { product_id: id, ...dto },
    });
  }
}
