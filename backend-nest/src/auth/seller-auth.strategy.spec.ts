import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SellerAuthStrategy } from './seller-auth.strategy';

describe('SellerAuthStrategy', () => {
  const makeStrategy = (supabaseGetUser: any, prismaFindUnique: any) => {
    const supabaseService = {
      client: { auth: { getUser: supabaseGetUser } },
    } as any;
    const prismaService = { store: { findUnique: prismaFindUnique } } as any;
    return new SellerAuthStrategy(supabaseService, prismaService);
  };

  it('resolves { user, store } for a valid token whose user_id matches a store', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const store = { id: 's1', user_id: 'u1' };
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      jest.fn().mockResolvedValue(store),
    );

    const result = await strategy.validate('valid-token');
    expect(result).toEqual({ user, store });
  });

  it('throws UnauthorizedException for an invalid token', async () => {
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'bad token' },
      }),
      jest.fn(),
    );

    await expect(strategy.validate('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token vacío o ausente sin consultar a Supabase', async () => {
    // getUser(undefined) NO falla: recae en la sesión que el cliente
    // compartido tenga guardada (ver supabase.service.ts) y devuelve el
    // último usuario que inició sesión. No debemos llegar a llamarlo.
    const getUser = jest.fn();
    const findUnique = jest.fn();
    const strategy = makeStrategy(getUser, findUnique);

    for (const token of [undefined, null, '', '   '] as unknown as string[]) {
      await expect(strategy.validate(token)).rejects.toThrow(
        new UnauthorizedException('Token inválido o expirado'),
      );
    }

    expect(getUser).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when no store matches the user', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      jest.fn().mockResolvedValue(null),
    );

    await expect(strategy.validate('valid-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('resolves the store by the authenticated user id, never by the email', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const findUnique = jest.fn().mockResolvedValue({ id: 's1', user_id: 'u1' });
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      findUnique,
    );

    const result = await strategy.validate('valid-token');

    expect(findUnique).toHaveBeenCalledWith({ where: { user_id: 'u1' } });
    expect(result.store.id).toBe('s1');
  });
});
