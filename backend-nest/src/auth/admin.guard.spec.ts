import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const contextFor = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const guardWith = (getUserResult: unknown) =>
  new AdminGuard({
    client: { auth: { getUser: jest.fn().mockResolvedValue(getUserResult) } },
  } as never);

describe('AdminGuard', () => {
  it('rechaza sin cabecera Authorization', async () => {
    const guard = guardWith({ data: { user: null }, error: null });
    await expect(guard.canActivate(contextFor({ headers: {} })))
      .rejects.toThrow(new UnauthorizedException('Token no proporcionado'));
  });

  it('rechaza un token inválido o expirado', async () => {
    const guard = guardWith({
      data: { user: null },
      error: { message: 'invalid token' },
    });
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toThrow(new UnauthorizedException('Token inválido o expirado'));
  });

  it('rechaza un usuario con app_metadata.role seller', async () => {
    const guard = guardWith({
      data: { user: { id: 'u1', app_metadata: { role: 'seller' } } },
      error: null,
    });
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permisos de administrador'),
    );
  });

  it('rechaza un rol admin puesto en user_metadata', async () => {
    // Autoascenso: cualquier usuario puede escribir su propio user_metadata.
    const guard = guardWith({
      data: { user: { id: 'u1', app_metadata: {}, user_metadata: { role: 'admin' } } },
      error: null,
    });
    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })))
      .rejects.toThrow(ForbiddenException);
  });

  it('acepta app_metadata.role admin y deja el usuario en request.admin', async () => {
    const user = { id: 'u1', app_metadata: { role: 'admin' } };
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer t' } };
    const guard = guardWith({ data: { user }, error: null });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.admin).toBe(user);
  });
});
