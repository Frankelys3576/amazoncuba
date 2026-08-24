import { BadRequestException, ParseIntPipe } from '@nestjs/common';

// M3: the built-in ParseIntPipe's default exceptionFactory produces the
// English "Validation failed (numeric string is expected)" message on a
// non-numeric :id route param. Every other validation failure in this app
// returns a Spanish message (see class-validator DTOs throughout); a bare
// `ParseIntPipe` on a route param is the one place that broke that
// consistency. Defined once here and reused across every controller that
// parses a numeric route param, instead of repeating the options object at
// each of the ~18 call sites.
export class SpanishParseIntPipe extends ParseIntPipe {
  constructor() {
    super({
      exceptionFactory: () =>
        new BadRequestException('El identificador debe ser un número entero'),
    });
  }
}
