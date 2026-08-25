import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { OrdersQueryAuthGuard } from './orders-query-auth.guard';
import { AdminGuard } from './admin.guard';

const contextFor = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('OrdersQueryAuthGuard', () => {
  it('con query.ids resuelve true sin consultar Supabase', async () => {
    const getUser = jest.fn();
    const supabaseService = { client: { auth: { getUser } } };
    const prisma = { store: { findUnique: jest.fn() } };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrdersQueryAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({ query: { ids: 'a,b' }, headers: {} }),
      ),
    ).resolves.toBe(true);

    expect(getUser).not.toHaveBeenCalled();
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
    expect(adminGuard.canActivate).not.toHaveBeenCalled();
  });

  it('con query.storeId y sin token, rechaza con UnauthorizedException', async () => {
    const supabaseService = { client: { auth: { getUser: jest.fn() } } };
    const prisma = { store: { findUnique: jest.fn() } };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrdersQueryAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({ query: { storeId: 's1' }, headers: {} }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Token no proporcionado'));
  });

  it('con query.storeId y cabecera "Bearer" sin token, rechaza sin consultar a Supabase', async () => {
    // getUser(undefined) recae en la sesión guardada del cliente compartido y
    // devuelve el último usuario que inició sesión. No debemos llamarlo.
    const getUser = jest.fn();
    const supabaseService = { client: { auth: { getUser } } };
    const prisma = { store: { findUnique: jest.fn() } };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrdersQueryAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({ query: { storeId: 's1' }, headers: { authorization: 'Bearer' } }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Token no proporcionado'));

    expect(getUser).not.toHaveBeenCalled();
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
  });

  it('con query.storeId, token válido, pero tienda distinta, rechaza con ForbiddenException', async () => {
    const user = { id: 'u1' };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = {
      store: {
        findUnique: jest.fn().mockResolvedValue({ id: 'store-own', user_id: 'u1' }),
      },
    };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrdersQueryAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          query: { storeId: 'other-store' },
          headers: { authorization: 'Bearer t' },
        }),
      ),
    ).rejects.toThrow(new ForbiddenException('No tienes permiso sobre esta tienda'));
  });

  it('con query.storeId, token válido, tienda propia, resuelve true', async () => {
    const user = { id: 'u1' };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = {
      store: {
        findUnique: jest.fn().mockResolvedValue({ id: 'store-own', user_id: 'u1' }),
      },
    };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrdersQueryAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          query: { storeId: 'store-own' },
          headers: { authorization: 'Bearer t' },
        }),
      ),
    ).resolves.toBe(true);
  });

  describe('sin storeId ni ids, cae en la comprobación de admin', () => {
    it('token no admin: propaga el ForbiddenException de AdminGuard', async () => {
      const supabaseService = { client: { auth: { getUser: jest.fn() } } };
      const prisma = { store: { findUnique: jest.fn() } };
      const adminGuard = {
        canActivate: jest
          .fn()
          .mockRejectedValue(
            new ForbiddenException('No tienes permisos de administrador'),
          ),
      };

      const guard = new OrdersQueryAuthGuard(
        supabaseService as never,
        prisma as never,
        adminGuard as never,
      );

      const ctx = contextFor({ query: {}, headers: { authorization: 'Bearer t' } });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new ForbiddenException('No tienes permisos de administrador'),
      );
      expect(adminGuard.canActivate).toHaveBeenCalledWith(ctx);
    });

    it('token admin: delega en AdminGuard y resuelve true', async () => {
      const supabaseService = { client: { auth: { getUser: jest.fn() } } };
      const prisma = { store: { findUnique: jest.fn() } };
      const adminGuard = { canActivate: jest.fn().mockResolvedValue(true) };

      const guard = new OrdersQueryAuthGuard(
        supabaseService as never,
        prisma as never,
        adminGuard as never,
      );

      const ctx = contextFor({ query: {}, headers: { authorization: 'Bearer t' } });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(adminGuard.canActivate).toHaveBeenCalledWith(ctx);
    });
  });
});
