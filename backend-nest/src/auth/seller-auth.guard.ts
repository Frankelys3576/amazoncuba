import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@supabase/supabase-js';
import { Store } from '@prisma/client';
import { RequestWithStore } from './request-with-store.interface';

// The payload SellerAuthStrategy.validate() resolves to. Named here so
// handleRequest can narrow its `user` parameter to something more useful
// than `any` without concretely typing the return value — see the note on
// the method below for why that distinction matters.
interface StrategyPayload {
  user: User;
  store: Store;
}

@Injectable()
export class SellerAuthGuard extends AuthGuard('bearer') {
  // SellerAuthStrategy.validate() returns { user, store }, but
  // @nestjs/passport's AuthGuard assigns that entire object to a single
  // request property (req.user) — it has no concept of a second value.
  // Split it here: stash `store` on the request as `req.store`, and return
  // the bare `user` so the base implementation's `request[...] = user` line
  // sets `req.user` to the real Supabase user, satisfying RequestWithStore.
  //
  // Deferred item, now bundled: keep the base class's generic `<TUser = any>`
  // signature and return `realUser as TUser` rather than concretely typing
  // the return as `User` — a prior attempt at narrowing this "broke tsc" only
  // because it let the return type infer as the concrete `User` type, which
  // doesn't structurally satisfy every call site's expectations of the
  // generic `IAuthGuard.handleRequest<TUser>` signature.
  handleRequest<TUser = any>(
    err: any,
    user: StrategyPayload | false,
    info: any,
    context: ExecutionContext,
    ...rest: unknown[]
  ): TUser {
    // Preserve the base class's error propagation exactly: an error or a
    // falsy payload (e.g. no user) must still throw before we touch the
    // request, so SellerAuthStrategy's UnauthorizedException / ForbiddenException
    // (and their Spanish messages) reach the client unchanged, and no
    // unauthenticated request is allowed through.
    //
    // IMPORTANT 6: when passport-http-bearer has no Authorization header at
    // all, it calls fail() directly — SellerAuthStrategy.validate() never
    // runs, so its 'Token inválido o expirado' message is never produced.
    // A bare `new UnauthorizedException()` here would render Nest's default
    // {"error":"Unauthorized"}, dropping the Spanish message Express's
    // auth.middleware.js:14-16 returns ({"error":"Token no proporcionado"})
    // for the same missing-header case.
    if (err || !user) {
      throw err || new UnauthorizedException('Token no proporcionado');
    }
    void rest; // unused: accepted only for signature compatibility with the base class's `status` arg

    const { user: realUser, store } = user;
    const request = context.switchToHttp().getRequest<RequestWithStore>();
    request.store = store;
    return realUser as TUser;
  }
}
