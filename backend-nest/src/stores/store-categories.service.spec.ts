import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StoreCategoriesService } from './store-categories.service';

describe('StoreCategoriesService', () => {
  it('creates a category scoped to the given store', async () => {
    const created = { id: 1, store_id: 7, name: 'Bebidas', image_url: null };
    const prisma = { storeCategory: { create: jest.fn().mockResolvedValue(created), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() } } as any;
    const service = new StoreCategoriesService(prisma);

    const result = await service.create(7, { name: 'Bebidas' });

    expect(prisma.storeCategory.create).toHaveBeenCalledWith({
      data: { store_id: 7, name: 'Bebidas', image_url: undefined },
    });
    expect(result).toEqual(created);
  });

  it('throws NotFoundException when updating a category that does not belong to the store', async () => {
    const prisma = { storeCategory: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } } as any;
    const service = new StoreCategoriesService(prisma);

    await expect(service.update(7, 99, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  // Parity fix: Express's updateStoreCategory 400s on an empty body *before*
  // ever looking the category up (storeCategory.controller.js:47-49). The
  // brief's Step 11 code dropped that check entirely, which would have let
  // an empty PUT silently no-op through Prisma. findFirst is asserted as
  // never-called here to prove the check runs before any DB lookup, exactly
  // matching Express's control flow.
  it('throws BadRequestException for an empty body without touching the database', async () => {
    const prisma = { storeCategory: { findFirst: jest.fn(), update: jest.fn() } } as any;
    const service = new StoreCategoriesService(prisma);

    await expect(service.update(7, 1, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.storeCategory.findFirst).not.toHaveBeenCalled();
  });

  it('updates only the provided fields once the category is confirmed to belong to the store', async () => {
    const existing = { id: 1, store_id: 7, name: 'Old', image_url: null };
    const updated = { id: 1, store_id: 7, name: 'New', image_url: null };
    const prisma = {
      storeCategory: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(updated),
      },
    } as any;
    const service = new StoreCategoriesService(prisma);

    const result = await service.update(7, 1, { name: 'New' });

    expect(prisma.storeCategory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'New' },
    });
    expect(result).toEqual(updated);
  });
});
