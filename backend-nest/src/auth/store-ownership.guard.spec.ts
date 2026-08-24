import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { StoreOwnershipGuard } from './store-ownership.guard';
import { SellerAuthGuard } from './seller-auth.guard';

describe('StoreOwnershipGuard', () => {
  const guard = new StoreOwnershipGuard();
  const sellerAuthGuard = new SellerAuthGuard();

  // Build the request the way Passport actually produces it: run the
  // strategy's { user, store } payload through SellerAuthGuard.handleRequest
  // (which assigns req.store as a side effect) rather than hand-writing a
  // request object shaped to whatever this guard happens to read.
  const makeContext = (storeId: number, paramId: string): ExecutionContext => {
    const req: any = { params: { id: paramId } };
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const store = { id: storeId, phone: '5551234' };
    const authContext = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
    sellerAuthGuard.handleRequest(
      null,
      { user, store } as any,
      null,
      authContext,
      undefined,
    );

    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;
  };

  it('allows access when the store id matches the route param', () => {
    expect(guard.canActivate(makeContext(7, '7'))).toBe(true);
  });

  it('throws ForbiddenException when the store id does not match', () => {
    expect(() => guard.canActivate(makeContext(7, '9'))).toThrow(
      ForbiddenException,
    );
  });
});
