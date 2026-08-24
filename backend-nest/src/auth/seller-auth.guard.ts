import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequestWithStore } from './request-with-store.interface';

@Injectable()
export class SellerAuthGuard extends AuthGuard('bearer') {
  // SellerAuthStrategy.validate() returns { user, store }, but
  // @nestjs/passport's AuthGuard assigns that entire object to a single
  // request property (req.user) — it has no concept of a second value.
  // Split it here: stash `store` on the request as `req.store`, and return
  // the bare `user` so the base implementation's `request[...] = user` line
  // sets `req.user` to the real Supabase user, satisfying RequestWithStore.
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    ...rest: unknown[]
  ) {
    // Preserve the base class's error propagation exactly: an error or a
    // falsy payload (e.g. no user) must still throw before we touch the
    // request, so SellerAuthStrategy's UnauthorizedException / ForbiddenException
    // (and their Spanish messages) reach the client unchanged, and no
    // unauthenticated request is allowed through.
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    void rest; // unused: accepted only for signature compatibility with the base class's `status` arg

    const { user: realUser, store } = user;
    const request = context.switchToHttp().getRequest<RequestWithStore>();
    request.store = store;
    return realUser;
  }
}
