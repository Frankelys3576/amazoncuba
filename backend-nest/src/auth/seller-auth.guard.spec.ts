import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SellerAuthGuard } from './seller-auth.guard';

describe('SellerAuthGuard', () => {
  const guard = new SellerAuthGuard();

  const makeContext = (req: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as any;

  it('splits the strategy payload: assigns req.store and returns the bare user', () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const store = { id: 7, phone: '5551234' };
    const req: any = {};

    const result = guard.handleRequest(
      null,
      { user, store } as any,
      null,
      makeContext(req),
      undefined,
    );

    expect(req.store).toBe(store);
    expect(result).toBe(user);
  });

  it('propagates an UnauthorizedException thrown by the strategy with its exact message', () => {
    const err = new UnauthorizedException('Token inválido o expirado');
    const req: any = {};

    expect(() =>
      guard.handleRequest(err, false, null, makeContext(req), undefined),
    ).toThrow('Token inválido o expirado');
  });

  it('propagates a ForbiddenException thrown by the strategy with its exact message', () => {
    const err = new ForbiddenException(
      'No se encontró una tienda asociada a este usuario',
    );
    const req: any = {};

    expect(() =>
      guard.handleRequest(err, false, null, makeContext(req), undefined),
    ).toThrow('No se encontró una tienda asociada a este usuario');
  });

  it('rejects when there is no error but also no user, rather than letting the request through', () => {
    const req: any = {};

    expect(() =>
      guard.handleRequest(null, false, null, makeContext(req), undefined),
    ).toThrow(UnauthorizedException);
  });

  // IMPORTANT 6: Express's auth.middleware.js:14-16 returns
  // {"error":"Token no proporcionado"} when no Authorization header is
  // present; a bare `new UnauthorizedException()` here loses that Spanish
  // message in favor of Nest's default "Unauthorized".
  it("rejects a missing Authorization header with the Spanish 'Token no proporcionado' message, not Nest's default", () => {
    const req: any = {};

    expect(() =>
      guard.handleRequest(null, false, null, makeContext(req), undefined),
    ).toThrow('Token no proporcionado');
  });
});
