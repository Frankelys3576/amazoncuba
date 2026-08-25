import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StoresService } from './stores.service';
import type { StoreCaller } from './stores.service';

describe('StoresService', () => {
  const makePrisma = (overrides: any) => ({
    store: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), ...overrides },
  }) as any;

  const STORE_ID = '11111111-1111-1111-1111-111111111111';
  const OTHER_STORE_ID = '22222222-2222-2222-2222-222222222222';

  // Task 3 (public surface hardening): GET /api/stores must not leak
  // pending/rejected stores to a non-admin caller. Mirrors getStores in
  // backend/src/controllers/store.controller.js.
  describe('findAll: status filter', () => {
    it('restricts to approved stores for a non-admin caller', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ findMany });
      const service = new StoresService(prisma, {} as any);

      await service.findAll({}, false);

      expect(findMany).toHaveBeenCalledWith({ where: { status: 'approved' } });
    });

    it('does not restrict by status for an admin caller', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ findMany });
      const service = new StoresService(prisma, {} as any);

      await service.findAll({}, true);

      expect(findMany).toHaveBeenCalledWith({ where: {} });
    });

    it('combines the status restriction with an explicit type filter for a non-admin caller', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ findMany });
      const service = new StoresService(prisma, {} as any);

      await service.findAll({ type: 'hostal' }, false);

      expect(findMany).toHaveBeenCalledWith({
        where: { store_type: 'hostal', status: 'approved' },
      });
    });
  });

  describe('findOne', () => {
    const ANONYMOUS: StoreCaller = { isAdmin: false, storeId: null };
    const ADMIN: StoreCaller = { isAdmin: true, storeId: null };

    it('looks up by id when the param is uuid-shaped', async () => {
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue({ id: STORE_ID, status: 'approved', zelle_info: {} }),
      });
      const service = new StoresService(prisma, {} as any);

      await service.findOne(STORE_ID, ANONYMOUS);

      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: STORE_ID } });
    });

    it('looks up by slug when the param is not uuid-shaped', async () => {
      const prisma = makePrisma({
        findFirst: jest.fn().mockResolvedValue({
          id: STORE_ID,
          slug: 'cafeteria-juan',
          status: 'approved',
          zelle_info: {},
        }),
      });
      const service = new StoresService(prisma, {} as any);

      await service.findOne('cafeteria-juan', ANONYMOUS);

      expect(prisma.store.findFirst).toHaveBeenCalledWith({
        where: { slug: 'cafeteria-juan' },
      });
    });

    it('throws NotFoundException when nothing matches a uuid-shaped id', async () => {
      const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
      const service = new StoresService(prisma, {} as any);

      await expect(
        service.findOne('99999999-9999-9999-9999-999999999999', ANONYMOUS),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when nothing matches a slug', async () => {
      const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
      const service = new StoresService(prisma, {} as any);

      await expect(service.findOne('no-such-slug', ANONYMOUS)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // Task 3 fix-round (public surface hardening, Critical): GET
    // /api/stores/:id had no status filter at all -- a pending/rejected
    // store's whole public profile (name, phone, address, gallery) was
    // fetchable by id or slug by anyone. The rule: approved -> anyone;
    // not approved -> admin, or the seller who owns it. Everyone else gets
    // the SAME 404 as "doesn't exist" (never 403 -- that would confirm the
    // store exists, which is exactly what must stay hidden).
    describe('visibility of a non-approved store', () => {
      const PENDING_STORE = { id: STORE_ID, status: 'pending', zelle_info: {} };

      it('anonymous gets 404 for a pending store', async () => {
        const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(PENDING_STORE) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.findOne(STORE_ID, ANONYMOUS)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('the owning seller (caller.storeId === store.id) gets the store back', async () => {
        const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(PENDING_STORE) });
        const service = new StoresService(prisma, {} as any);

        const result = await service.findOne(STORE_ID, { isAdmin: false, storeId: STORE_ID });

        expect(result.id).toBe(STORE_ID);
      });

      it('a different seller (caller.storeId !== store.id) gets 404, not 403', async () => {
        const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(PENDING_STORE) });
        const service = new StoresService(prisma, {} as any);

        await expect(
          service.findOne(STORE_ID, { isAdmin: false, storeId: OTHER_STORE_ID }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('an admin gets the store back', async () => {
        const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(PENDING_STORE) });
        const service = new StoresService(prisma, {} as any);

        const result = await service.findOne(STORE_ID, ADMIN);

        expect(result.id).toBe(STORE_ID);
      });

      it('an approved store stays public for an anonymous caller', async () => {
        const prisma = makePrisma({
          findUnique: jest.fn().mockResolvedValue({ id: STORE_ID, status: 'approved', zelle_info: {} }),
        });
        const service = new StoresService(prisma, {} as any);

        const result = await service.findOne(STORE_ID, ANONYMOUS);

        expect(result.id).toBe(STORE_ID);
      });
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
        STORE_ID,
        { user: { id: 'u1' }, store: { id: STORE_ID, phone: '5551234' } } as any,
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
        where: { id: STORE_ID },
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
          STORE_ID,
          { user: { id: 'u1' }, store: { id: STORE_ID, phone: '5551234' } } as any,
          { password: 'newpass1' },
        ),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // I4: the two backends share one database, so updateProfile must write the
  // phone exactly as Express does — verbatim (store.controller.js:142).
  // Normalizing here previously, while Express did not, meant the same
  // request produced different data in the same column depending on which
  // backend served it. The rationale for normalizing (SellerAuthStrategy
  // matching a store by its phone) no longer holds: the strategy resolves
  // the store by user_id.
  describe('updateProfile: phone is stored verbatim (I4)', () => {
    it('writes the phone exactly as sent, matching Express', async () => {
      const update = jest.fn().mockResolvedValue({ id: STORE_ID, zelle_info: {} });
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue({ id: STORE_ID, zelle_info: {} }),
        update,
      });
      const service = new StoresService(prisma, {} as any);

      await service.updateProfile(STORE_ID, { phone: '+53 5551234' } as any);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STORE_ID },
          data: expect.objectContaining({ phone: '+53 5551234' }),
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

        await expect(service.updateStatus(STORE_ID, 'approved')).rejects.toBeInstanceOf(NotFoundException);
      });

      it('propagates a non-P2025 error unchanged', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(dbError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateStatus(STORE_ID, 'approved')).rejects.toBe(dbError);
      });
    });

    describe('updateProfile', () => {
      it('rethrows a P2025 as NotFoundException', async () => {
        const prisma = makePrisma({
          findUnique: jest.fn().mockResolvedValue({ id: STORE_ID, zelle_info: {} }),
          update: jest.fn().mockRejectedValue(notFoundError),
        });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateProfile(STORE_ID, { name: 'Nueva' } as any)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('propagates a non-P2025 error unchanged', async () => {
        const prisma = makePrisma({
          findUnique: jest.fn().mockResolvedValue({ id: STORE_ID, zelle_info: {} }),
          update: jest.fn().mockRejectedValue(dbError),
        });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateProfile(STORE_ID, { name: 'Nueva' } as any)).rejects.toBe(dbError);
      });
    });

    describe('updateZelleInfo', () => {
      it('rethrows a P2025 as NotFoundException', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(notFoundError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateZelleInfo(STORE_ID, { accepts_zelle: true })).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('propagates a non-P2025 error unchanged', async () => {
        const prisma = makePrisma({ update: jest.fn().mockRejectedValue(dbError) });
        const service = new StoresService(prisma, {} as any);

        await expect(service.updateZelleInfo(STORE_ID, { accepts_zelle: true })).rejects.toBe(dbError);
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
        id: STORE_ID,
        price_per_night: new Prisma.Decimal(75.5),
      });
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, {} as any);

      const result = await service.updateZelleInfo(STORE_ID, { accepts_zelle: true });

      expect(typeof result.price_per_night).toBe('number');
      expect(result.price_per_night).toBe(75.5);
      expect(JSON.stringify(result)).not.toMatch(/"price_per_night":"/);
    });

    it('leaves price_per_night null, not 0, when the column is null', async () => {
      const update = jest.fn().mockResolvedValue({ id: STORE_ID, price_per_night: null });
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, {} as any);

      const result = await service.updateZelleInfo(STORE_ID, { accepts_zelle: true });

      expect(result.price_per_night).toBeNull();
    });

    it('does not add store_name/store_slug/etc fields (must not route through formatStore)', async () => {
      const update = jest.fn().mockResolvedValue({
        id: STORE_ID,
        name: 'Casa X',
        province: null,
        zelle_info: {},
        price_per_night: new Prisma.Decimal(10),
      });
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, {} as any);

      const result = await service.updateZelleInfo(STORE_ID, { accepts_zelle: true });

      // formatStore would coerce `province: null` to `''` and add a
      // `gallery` field; updateZelleInfo must not pick up that shape.
      expect(result.province).toBeNull();
      expect(result).not.toHaveProperty('gallery');
    });
  });
});
