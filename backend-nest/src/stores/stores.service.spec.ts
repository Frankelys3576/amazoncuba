import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
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

    // IMPORTANT 5: a Supabase Auth outage is not the caller's bad request.
    // Express returns 500 here (store.controller.js:332-335) — the exact
    // inverse of the upload module's own ruling that a Supabase failure is a
    // 500, not a 400.
    it('throws InternalServerErrorException (not BadRequestException) when Supabase Auth fails to update the user', async () => {
      const updateUserById = jest
        .fn()
        .mockResolvedValue({ error: { message: 'auth outage' } });
      const supabase = { client: { auth: { admin: { updateUserById } } } } as any;
      const prisma = makePrisma({});
      const service = new StoresService(prisma, supabase);

      await expect(
        service.updateCredentials(
          7,
          { user: { id: 'u1' }, store: { id: 7, phone: '5551234' } } as any,
          { password: 'newpass1' },
        ),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // IMPORTANT 7: SellerAuthStrategy matches store phone by exact equality
  // against the digits-only phone derived from the caller's email. If a
  // seller saves a phone with symbols/spaces through their own profile form
  // (updateProfile) while updateCredentials normalizes to digits-only, the
  // two diverge and every guarded endpoint 403s for that seller from then on.
  describe('updateProfile: phone normalization (IMPORTANT 7)', () => {
    it('strips non-digit characters from phone before writing it, matching updateCredentials', async () => {
      const update = jest.fn().mockResolvedValue({ id: 7, zelle_info: {} });
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue({ id: 7, zelle_info: {} }),
        update,
      });
      const service = new StoresService(prisma, {} as any);

      await service.updateProfile(7, { phone: '+53 5551234' } as any);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: expect.objectContaining({ phone: '535551234' }),
        }),
      );
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

  // Finding 2 (Task 11 review, ruled in scope for Task 10 too):
  // updateZelleInfo returns the raw prisma.store.update() row (no
  // formatStore pass), so price_per_night comes back as a real
  // Prisma.Decimal instance unless explicitly coerced. Express returns the
  // equivalent raw Supabase row too, but PostgREST serializes Postgres
  // `numeric` as a JSON number, so a raw Decimal here is a real divergence.
  describe('Finding 2: Decimal coercion on updateZelleInfo', () => {
    it('coerces price_per_night to a plain number on the returned row', async () => {
      const update = jest.fn().mockResolvedValue({
        id: 1,
        price_per_night: new Prisma.Decimal(75.5),
      });
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, {} as any);

      const result = await service.updateZelleInfo(1, { accepts_zelle: true });

      expect(typeof result.price_per_night).toBe('number');
      expect(result.price_per_night).toBe(75.5);
      expect(JSON.stringify(result)).not.toMatch(/"price_per_night":"/);
    });

    it('leaves price_per_night null, not 0, when the column is null', async () => {
      const update = jest.fn().mockResolvedValue({ id: 1, price_per_night: null });
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, {} as any);

      const result = await service.updateZelleInfo(1, { accepts_zelle: true });

      expect(result.price_per_night).toBeNull();
    });

    it('does not add store_name/store_slug/etc fields (must not route through formatStore)', async () => {
      const update = jest.fn().mockResolvedValue({
        id: 1,
        name: 'Casa X',
        province: null,
        zelle_info: {},
        price_per_night: new Prisma.Decimal(10),
      });
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, {} as any);

      const result = await service.updateZelleInfo(1, { accepts_zelle: true });

      // formatStore would coerce `province: null` to `''` and add a
      // `gallery` field; updateZelleInfo must not pick up that shape.
      expect(result.province).toBeNull();
      expect(result).not.toHaveProperty('gallery');
    });
  });
});
