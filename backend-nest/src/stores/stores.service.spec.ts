import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  const makePrisma = (overrides: any) => ({
    store: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), ...overrides },
  }) as any;

  describe('findOne', () => {
    it('looks up by numeric id when the param is numeric', async () => {
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue({ id: 5, zelle_info: {} }),
      });
      const service = new StoresService(prisma, {} as any);

      await service.findOne('5');

      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('looks up by slug when the param is not numeric', async () => {
      const prisma = makePrisma({
        findFirst: jest.fn().mockResolvedValue({ id: 5, slug: 'cafeteria-juan', zelle_info: {} }),
      });
      const service = new StoresService(prisma, {} as any);

      await service.findOne('cafeteria-juan');

      expect(prisma.store.findFirst).toHaveBeenCalledWith({
        where: { slug: 'cafeteria-juan' },
      });
    });

    it('throws NotFoundException when nothing matches', async () => {
      const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
      const service = new StoresService(prisma, {} as any);

      await expect(service.findOne('999')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateCredentials', () => {
    it('updates the Supabase Auth email/password and mirrors the phone onto the store', async () => {
      const updateUserById = jest.fn().mockResolvedValue({ error: null });
      const supabase = { client: { auth: { admin: { updateUserById } } } } as any;
      const update = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, supabase);

      const result = await service.updateCredentials(
        7,
        { user: { id: 'u1' }, store: { id: 7, phone: '5551234' } } as any,
        { phone: '+53 5559999', password: 'newpass1' },
      );

      // Express's cleanPhone is `phone.replace(/[^0-9]/g, '')` — it strips
      // symbols/spaces only, it does not strip a leading country code. For
      // '+53 5559999' that yields '535559999', not '5559999'. (The brief's
      // fixture asserted '5559999', which no code path in this repo
      // produces from this input — corrected here to match Express parity.)
      expect(updateUserById).toHaveBeenCalledWith('u1', {
        email: '535559999@cubaamazon.com',
        password: 'newpass1',
      });
      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { phone: '535559999' },
      });
      expect(result).toEqual({
        message: 'Credenciales actualizadas exitosamente',
        phone: '535559999',
      });
    });
  });

  // Ruling 1: a bare `catch { throw NotFoundException }` turns every failure
  // — DB outage, constraint violation — into a 404 "store not found". Only a
  // Prisma P2025 (zero-row update) should become that 404; anything else
  // must propagate so the global filter renders a 500, matching Express's
  // distinction between "Error updating store in database" (500) and
  // "Tienda no encontrada" (404).
  describe('Ruling 1: narrowed error handling on update paths', () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError('An operation failed because it depends on one or more records that were required but not found.', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    const dbError = new Error('connection terminated unexpectedly');

    describe('updateStatus', () => {
      it('rethrows a P2025 as NotFoundException', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(notFoundError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateStatus(999, 'approved')).rejects.toBeInstanceOf(NotFoundException);
      });

      it('propagates a non-P2025 error unchanged', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(dbError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateStatus(1, 'approved')).rejects.toBe(dbError);
      });
    });

    describe('updateProfile', () => {
      it('rethrows a P2025 as NotFoundException', async () => {
        const prisma = makePrisma({
          findUnique: jest.fn().mockResolvedValue({ id: 999, zelle_info: {} }),
          update: jest.fn().mockRejectedValue(notFoundError),
        });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateProfile(999, { name: 'Nueva' } as any)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('propagates a non-P2025 error unchanged', async () => {
        const prisma = makePrisma({
          findUnique: jest.fn().mockResolvedValue({ id: 1, zelle_info: {} }),
          update: jest.fn().mockRejectedValue(dbError),
        });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateProfile(1, { name: 'Nueva' } as any)).rejects.toBe(dbError);
      });
    });

    describe('updateZelleInfo', () => {
      it('rethrows a P2025 as NotFoundException', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(notFoundError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateZelleInfo(999, { accepts_zelle: true })).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('propagates a non-P2025 error unchanged', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(dbError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateZelleInfo(1, { accepts_zelle: true })).rejects.toBe(dbError);
      });
    });
  });
});
