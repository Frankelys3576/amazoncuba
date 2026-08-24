import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  describe('create', () => {
    it('throws ForbiddenException when store_id does not match the authenticated store', async () => {
      const prisma = { product: { create: jest.fn() } } as any;
      const service = new ProductsService(prisma);

      await expect(
        service.create({ store_id: 2 } as any, { id: 1 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('defaults currency to USD and builds delivery_locations when omitted', async () => {
      const create = jest.fn().mockResolvedValue({ id: 10 });
      const prisma = { product: { create } } as any;
      const service = new ProductsService(prisma);

      await service.create(
        { store_id: 1, name: 'Café', price: 5, province: 'La Habana', municipality: 'Playa' } as any,
        { id: 1 } as any,
      );

      expect(create.mock.calls[0][0].data).toMatchObject({
        currency: 'USD',
        delivery_locations: ['La Habana:Playa'],
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      const prisma = { product: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      const service = new ProductsService(prisma);

      await expect(service.remove(1, { id: 1 } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the product belongs to a different store', async () => {
      const prisma = {
        product: { findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 2 }) },
      } as any;
      const service = new ProductsService(prisma);

      await expect(service.remove(1, { id: 1 } as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
