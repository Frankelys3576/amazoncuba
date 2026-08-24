import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const makeService = ({
    createUser,
    settingsFindUnique,
    storeCreate,
    signIn,
    storeFindFirst,
  }: any) => {
    const supabase = {
      client: {
        auth: {
          admin: { createUser },
          signInWithPassword: signIn,
        },
      },
    } as any;
    const prisma = {
      platformSetting: { findUnique: settingsFindUnique },
      store: { create: storeCreate, findFirst: storeFindFirst },
    } as any;
    return new AuthService(supabase, prisma);
  };

  describe('register', () => {
    it('creates the Supabase user and an accompanying pending store when store_name is given', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const createUser = jest
        .fn()
        .mockResolvedValue({ data: { user }, error: null });
      const settingsFindUnique = jest
        .fn()
        .mockResolvedValue({ key: 'auto_approve_sellers', value: 'false' });
      const storeCreate = jest.fn().mockResolvedValue({});
      const service = makeService({
        createUser,
        settingsFindUnique,
        storeCreate,
      });

      const result = await service.register({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        full_name: 'Juan Pérez',
        store_name: 'Cafetería Juan',
        store_type: 'business',
      });

      expect(createUser).toHaveBeenCalledWith({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        email_confirm: true,
        user_metadata: { full_name: 'Juan Pérez' },
      });
      expect(storeCreate).toHaveBeenCalledTimes(1);
      const createArgs = storeCreate.mock.calls[0][0];
      expect(createArgs.data.name).toBe('Cafetería Juan');
      expect(createArgs.data.slug).toBe('cafeteria-juan');
      expect(createArgs.data.status).toBe('pending');
      expect(result).toEqual({
        message: 'Usuario y tienda registrados exitosamente',
        user,
        autoApproved: false,
      });
    });

    it('marks the store approved when auto_approve_sellers is "true"', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const createUser = jest
        .fn()
        .mockResolvedValue({ data: { user }, error: null });
      const settingsFindUnique = jest
        .fn()
        .mockResolvedValue({ key: 'auto_approve_sellers', value: 'true' });
      const storeCreate = jest.fn().mockResolvedValue({});
      const service = makeService({
        createUser,
        settingsFindUnique,
        storeCreate,
      });

      const result = await service.register({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        full_name: 'Juan Pérez',
        store_name: 'Cafetería Juan',
      });

      expect(storeCreate.mock.calls[0][0].data.status).toBe('approved');
      expect(result.autoApproved).toBe(true);
    });

    // Ruling 1: a Supabase Auth failure in register is a 400 with the upstream
    // message, not a raw error that would fall through to the global filter's
    // 500. Express returns res.status(400).json({ error: error.message || ... }).
    it('throws BadRequestException with the Supabase error message when createUser fails', async () => {
      const createUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'El usuario ya está registrado' },
      });
      const settingsFindUnique = jest.fn();
      const storeCreate = jest.fn();
      const service = makeService({
        createUser,
        settingsFindUnique,
        storeCreate,
      });

      await expect(
        service.register({
          email: '5551234@cubaamazon.com',
          password: 'secret123',
          full_name: 'Juan Pérez',
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.register({
          email: '5551234@cubaamazon.com',
          password: 'secret123',
          full_name: 'Juan Pérez',
        } as any),
      ).rejects.toThrow('El usuario ya está registrado');

      expect(settingsFindUnique).not.toHaveBeenCalled();
      expect(storeCreate).not.toHaveBeenCalled();
    });

    it('falls back to a default message when the Supabase error has none', async () => {
      const createUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: {},
      });
      const service = makeService({
        createUser,
        settingsFindUnique: jest.fn(),
        storeCreate: jest.fn(),
      });

      await expect(
        service.register({
          email: '5551234@cubaamazon.com',
          password: 'secret123',
          full_name: 'Juan Pérez',
        } as any),
      ).rejects.toThrow('Error al registrar el usuario');
    });

    // Ruling 2: a failed store creation must not fail the whole request — the
    // Supabase Auth user has already been created by that point, so Express
    // deliberately swallows the store-insert error and still returns 201.
    it('still returns the success response when store creation fails', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const createUser = jest
        .fn()
        .mockResolvedValue({ data: { user }, error: null });
      const settingsFindUnique = jest
        .fn()
        .mockResolvedValue({ key: 'auto_approve_sellers', value: 'false' });
      const storeCreate = jest
        .fn()
        .mockRejectedValue(new Error('duplicate slug'));
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const service = makeService({
        createUser,
        settingsFindUnique,
        storeCreate,
      });

      const result = await service.register({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        full_name: 'Juan Pérez',
        store_name: 'Cafetería Juan',
      });

      expect(result).toEqual({
        message: 'Usuario y tienda registrados exitosamente',
        user,
        autoApproved: false,
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('login', () => {
    it('returns the session, user, and matching store', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const session = { access_token: 'tok' };
      const store = { id: 7, phone: '5551234' };
      const signIn = jest
        .fn()
        .mockResolvedValue({ data: { user, session }, error: null });
      const storeFindFirst = jest.fn().mockResolvedValue(store);
      const service = makeService({ signIn, storeFindFirst });

      const result = await service.login({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
      });

      expect(result).toEqual({
        message: 'Login exitoso',
        session,
        user,
        store,
      });
    });

    it('looks up the store by an exact phone match, not a substring match', async () => {
      const user = { id: 'u1', email: '1234@cubaamazon.com' };
      const session = { access_token: 'tok' };
      const signIn = jest
        .fn()
        .mockResolvedValue({ data: { user, session }, error: null });
      const storeFindFirst = jest.fn().mockResolvedValue(null);
      const service = makeService({ signIn, storeFindFirst });

      await service.login({
        email: '1234@cubaamazon.com',
        password: 'secret123',
      });

      expect(storeFindFirst).toHaveBeenCalledWith({ where: { phone: '1234' } });
    });

    it('tolerates a missing store and still returns the session/user', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const session = { access_token: 'tok' };
      const signIn = jest
        .fn()
        .mockResolvedValue({ data: { user, session }, error: null });
      const storeFindFirst = jest.fn().mockResolvedValue(null);
      const service = makeService({ signIn, storeFindFirst });

      const result = await service.login({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
      });

      expect(result.store).toBeNull();
    });

    it('throws UnauthorizedException with a generic message on invalid credentials', async () => {
      const signIn = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });
      const service = makeService({ signIn, storeFindFirst: jest.fn() });

      await expect(
        service.login({ email: 'nope@cubaamazon.com', password: 'wrong' }),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('deleteAccount', () => {
    it('deletes order items and products for the store, then the store itself', async () => {
      const orderItemDeleteMany = jest.fn().mockResolvedValue({});
      const productDeleteMany = jest.fn().mockResolvedValue({});
      const productFindMany = jest
        .fn()
        .mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const storeDelete = jest.fn().mockResolvedValue({});
      const prisma = {
        product: { findMany: productFindMany, deleteMany: productDeleteMany },
        orderItem: { deleteMany: orderItemDeleteMany },
        store: { delete: storeDelete },
      } as any;
      const service = new AuthService({} as any, prisma);

      const result = await service.deleteAccount(7);

      expect(productFindMany).toHaveBeenCalledWith({
        where: { store_id: 7 },
        select: { id: true },
      });
      expect(orderItemDeleteMany).toHaveBeenCalledWith({
        where: { product_id: { in: [1, 2] } },
      });
      expect(productDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });
      expect(storeDelete).toHaveBeenCalledWith({ where: { id: 7 } });
      expect(result).toEqual({ message: 'Cuenta eliminada exitosamente' });
    });

    it('skips order-item/product deletion when the store has no products', async () => {
      const orderItemDeleteMany = jest.fn();
      const productDeleteMany = jest.fn();
      const productFindMany = jest.fn().mockResolvedValue([]);
      const storeDelete = jest.fn().mockResolvedValue({});
      const prisma = {
        product: { findMany: productFindMany, deleteMany: productDeleteMany },
        orderItem: { deleteMany: orderItemDeleteMany },
        store: { delete: storeDelete },
      } as any;
      const service = new AuthService({} as any, prisma);

      await service.deleteAccount(7);

      expect(orderItemDeleteMany).not.toHaveBeenCalled();
      expect(productDeleteMany).not.toHaveBeenCalled();
      expect(storeDelete).toHaveBeenCalledWith({ where: { id: 7 } });
    });
  });
});
