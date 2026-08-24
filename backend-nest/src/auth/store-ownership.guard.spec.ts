import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { StoreOwnershipGuard } from './store-ownership.guard';

describe('StoreOwnershipGuard', () => {
  const guard = new StoreOwnershipGuard();

  const makeContext = (storeId: number, paramId: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ store: { id: storeId }, params: { id: paramId } }),
      }),
    }) as any;

  it('allows access when the store id matches the route param', () => {
    expect(guard.canActivate(makeContext(7, '7'))).toBe(true);
  });

  it('throws ForbiddenException when the store id does not match', () => {
    expect(() => guard.canActivate(makeContext(7, '9'))).toThrow(
      ForbiddenException,
    );
  });
});
