import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { OrderUpdateAuthGuard } from './order-update-auth.guard';
import { AdminGuard } from './admin.guard';

const contextFor = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('OrderUpdateAuthGuard', () => {
  it('cliente sin credencial: permite marcar delivered', async () => {
    const getUser = jest.fn();
    const supabaseService = { client: { auth: { getUser } } };
    const prisma = { store: { findUnique: jest.fn() }, orderItem: { findFirst: jest.fn() } };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          headers: {},
          body: { status: 'delivered' },
          params: { id: 'order-1' },
        }),
      ),
    ).resolves.toBe(true);

    expect(getUser).not.toHaveBeenCalled();
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
    expect(prisma.orderItem.findFirst).not.toHaveBeenCalled();
    expect(adminGuard.canActivate).not.toHaveBeenCalled();
  });

  it('cliente sin credencial: rechaza cualquier otro estado', async () => {
    const getUser = jest.fn();
    const supabaseService = { client: { auth: { getUser } } };
    const prisma = { store: { findUnique: jest.fn() }, orderItem: { findFirst: jest.fn() } };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          headers: {},
          body: { status: 'shipped' },
          params: { id: 'order-1' },
        }),
      ),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permiso para cambiar este pedido'),
    );

    expect(getUser).not.toHaveBeenCalled();
  });

  it('vendedor: permite shipped en un pedido con un producto suyo', async () => {
    const user = { id: 'u1' };
    const store = { id: 'store-own', user_id: 'u1' };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = {
      store: { findUnique: jest.fn().mockResolvedValue(store) },
      orderItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }) },
    };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer t' },
      body: { status: 'shipped' },
      params: { id: 'order-1' },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(prisma.orderItem.findFirst).toHaveBeenCalledWith({
      where: { order_id: 'order-1', product: { store_id: 'store-own' } },
    });
    expect(request.user).toBe(user);
    expect(request.store).toBe(store);
  });

  it('vendedor: rechaza un pedido sin productos suyos', async () => {
    const user = { id: 'u1' };
    const store = { id: 'store-own', user_id: 'u1' };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = {
      store: { findUnique: jest.fn().mockResolvedValue(store) },
      orderItem: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          headers: { authorization: 'Bearer t' },
          body: { status: 'shipped' },
          params: { id: 'order-ajeno' },
        }),
      ),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permiso sobre este pedido'),
    );
  });

  it('vendedor: rechaza un estado que no es de gestión', async () => {
    const user = { id: 'u1' };
    const store = { id: 'store-own', user_id: 'u1' };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = {
      store: { findUnique: jest.fn().mockResolvedValue(store) },
      orderItem: { findFirst: jest.fn() },
    };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          headers: { authorization: 'Bearer t' },
          body: { status: 'pending' },
          params: { id: 'order-1' },
        }),
      ),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permiso para cambiar este pedido'),
    );

    // Un vendedor con un estado fuera de la lista de gestión no debe
    // siquiera comprobarse la propiedad del pedido.
    expect(prisma.orderItem.findFirst).not.toHaveBeenCalled();
  });

  it('administrador: permite cualquier estado de la lista', async () => {
    const user = { id: 'admin-u1', app_metadata: { role: 'admin' } };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = { store: { findUnique: jest.fn() }, orderItem: { findFirst: jest.fn() } };
    const adminGuard = { canActivate: jest.fn().mockResolvedValue(true) };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    const context = contextFor({
      headers: { authorization: 'Bearer t' },
      body: { status: 'pending' },
      params: { id: 'order-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(adminGuard.canActivate).toHaveBeenCalledWith(context);
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
    expect(prisma.orderItem.findFirst).not.toHaveBeenCalled();
  });

  it('token inválido: rechaza con UnauthorizedException con el mismo mensaje que Express', async () => {
    const supabaseService = {
      client: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'invalid token' },
          }),
        },
      },
    };
    const prisma = { store: { findUnique: jest.fn() }, orderItem: { findFirst: jest.fn() } };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          headers: { authorization: 'Bearer bad' },
          body: { status: 'shipped' },
          params: { id: 'order-1' },
        }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Token inválido o expirado'));
  });

  it('autenticado pero sin tienda propia: rechaza con ForbiddenException', async () => {
    const user = { id: 'u1' };
    const supabaseService = {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
      },
    };
    const prisma = {
      store: { findUnique: jest.fn().mockResolvedValue(null) },
      orderItem: { findFirst: jest.fn() },
    };
    const adminGuard = { canActivate: jest.fn() };

    const guard = new OrderUpdateAuthGuard(
      supabaseService as never,
      prisma as never,
      adminGuard as never,
    );

    await expect(
      guard.canActivate(
        contextFor({
          headers: { authorization: 'Bearer t' },
          body: { status: 'shipped' },
          params: { id: 'order-1' },
        }),
      ),
    ).rejects.toThrow(
      new ForbiddenException('No se encontró una tienda asociada a este usuario'),
    );
  });
});
