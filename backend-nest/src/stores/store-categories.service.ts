import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreCategoryDto, UpdateStoreCategoryDto } from './dto/store-category.dto';

@Injectable()
export class StoreCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(storeId: number) {
    return this.prisma.storeCategory.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'asc' },
    });
  }

  create(storeId: number, dto: CreateStoreCategoryDto) {
    return this.prisma.storeCategory.create({
      data: { store_id: storeId, name: dto.name, image_url: dto.image_url },
    });
  }

  async update(storeId: number, categoryId: number, dto: UpdateStoreCategoryDto) {
    // Mirrors Express's field-presence check (storeCategory.controller.js
    // updateStoreCategory), which runs *before* touching the database at
    // all — an empty body 400s even for a category id that doesn't exist.
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.image_url !== undefined) updates.image_url = dto.image_url;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const existing = await this.prisma.storeCategory.findFirst({
      where: { id: categoryId, store_id: storeId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    return this.prisma.storeCategory.update({
      where: { id: categoryId },
      data: updates,
    });
  }

  async remove(storeId: number, categoryId: number) {
    const existing = await this.prisma.storeCategory.findFirst({
      where: { id: categoryId, store_id: storeId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    await this.prisma.storeCategory.delete({ where: { id: categoryId } });
    return { message: 'Category deleted successfully' };
  }
}
