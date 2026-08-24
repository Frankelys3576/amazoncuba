import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// M3 (see spanish-parse-int.pipe.ts, now removed): Nest's built-in
// ParseUUIDPipe's default exceptionFactory produces the English "Validation
// failed (uuid is expected)" message on a malformed :id route param. Every
// other validation failure in this app returns a Spanish message (see
// class-validator DTOs throughout); a bare `ParseUUIDPipe` on a route param
// would be the one place that broke that consistency. Defined once here and
// reused across every controller that parses a uuid route param, instead of
// repeating an options object at each of the 19 call sites.
//
// Primary keys became uuid v7 as part of the uuid migration, so this
// replaces SpanishParseIntPipe: an integer string like '42' — a valid id
// under the old schema — must now be rejected here with a clean 400 rather
// than reaching Prisma and failing there with a 500.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SpanishParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) {
      throw new BadRequestException('El identificador debe ser un UUID válido');
    }
    return value;
  }
}
