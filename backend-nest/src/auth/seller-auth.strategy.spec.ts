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
