import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { stripLegacyFields } from './legacy-fields.util';

// Registered once as an APP_INTERCEPTOR in AppModule rather than applied at
// each of the ~10 response paths that spread a raw Prisma row. Doing it per
// path means the guarantee is only as good as the list, and the list has
// already been wrong once: the BigInt shim was removed on the reasoning that
// "every id is a uuid string now", which is true of the *primary* keys and
// false of the 15 `legacy_*` bigint columns still on the models. A single
// boundary means a new endpoint that returns a bare row is covered the day
// it is written, and there is exactly one place to audit.
@Injectable()
export class StripLegacyFieldsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => stripLegacyFields(data)));
  }
}
