import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { formatProduct } from './product-format.util';

const STORE_INCLUDE = {
  store: {
    select: { accepts_zelle: true, name: true, phone: true, slug: true, has_delivery: true, id: true },
  },
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    storeId?: string;
    q?: string;
    category?: string;
    province?: string;
    municipality?: string;
    store_category_id?: string;
    requireImage?: string;
  }) {
    const where: Record<string, unknown> = {};
    // Product.store_id/category_id/store_category_id are Prisma BigInt
    // columns; the generated client's where-filter types accept a plain JS
    // `number` for BigInt fields (confirmed against node_modules/.prisma/
    // client/index.d.ts — BigIntFilter's `equals` is `bigint | number`), so
    // Number(...) here is safe and matches the create/update input types too.
    if (query.storeId) where.store_id = Number(query.storeId);
    if (query.category) where.category_id = Number(query.category);
    if (query.store_category_id) where.store_category_id = Number(query.store_category_id);
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
      orderBy: [{ is_featured: 'desc' }, { created_at: 'desc' }],
    });

    return products.map(formatProduct);
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: STORE_INCLUDE,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return formatProduct(product);
  }

  async create(dto: CreateProductDto, callerStore: Store) {
    if (String(dto.store_id) !== String(callerStore.id)) {
      throw new ForbiddenException('No tienes permiso para crear productos en esta tienda');
    }

    const delivery_locations = dto.delivery_locations || [`${dto.province}:${dto.municipality}`];
    const currency = dto.currency || 'USD';

    return this.prisma.product.create({
      data: { ...dto, currency, delivery_locations },
    });
  }

  async update(id: number, dto: UpdateProductDto, callerStore: Store) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    if (String(existing.store_id) !== String(callerStore.id)) {
      throw new ForbiddenException('No tienes permiso para editar este producto');
    }

    const data: Record<string, unknown> = { ...dto };
    if (data.currency === null) data.currency = 'USD';

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: number, callerStore: Store) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    if (String(existing.store_id) !== String(callerStore.id)) {
      throw new ForbiddenException('No tienes permiso para eliminar este producto');
    }

    await this.prisma.orderItem.deleteMany({ where: { product_id: id } });
    const product = await this.prisma.product.delete({ where: { id } });
    return { message: 'Producto eliminado correctamente', product };
  }

  async registerView(id: number) {
    await this.prisma.productView.create({ data: { product_id: id } });
    return { message: 'View registered' };
  }

  findReviews(id: number) {
    return this.prisma.productReview.findMany({
      where: { product_id: id },
      orderBy: { created_at: 'desc' },
    });
  }

  addReview(id: number, dto: CreateProductReviewDto) {
    return this.prisma.productReview.create({
      data: { product_id: id, ...dto },
    });
  }
}
