import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SellerAuthStrategy } from './seller-auth.strategy';

describe('SellerAuthStrategy', () => {
  const makeStrategy = (supabaseGetUser: any, prismaFindFirst: any) => {
    const supabaseService = {
      client: { auth: { getUser: supabaseGetUser } },
    } as any;
    const prismaService = { store: { findFirst: prismaFindFirst } } as any;
    return new SellerAuthStrategy(supabaseService, prismaService);
  };

  it('resolves { user, store } for a valid token whose email phone matches a store', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const store = { id: 7, phone: '5551234' };
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

  it('looks up the store by an exact phone match, not a substring match', async () => {
    // Regression test for a substring-match authorization bypass: a `contains`
    // lookup would let a user whose derived phone is a substring of another
    // store's phone (e.g. "1234" inside "5551234") resolve to that OTHER
    // store, granting them guarded write access to it. Must be exact equality.
    const user = { id: 'u1', email: '1234@cubaamazon.com' };
    const findFirst = jest.fn().mockResolvedValue(null);
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      findFirst,
    );

    await expect(strategy.validate('valid-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findFirst).toHaveBeenCalledWith({ where: { phone: '1234' } });
  });
});
