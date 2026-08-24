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
});
