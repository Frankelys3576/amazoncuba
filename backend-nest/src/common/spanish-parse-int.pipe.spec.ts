import { BadRequestException } from '@nestjs/common';
import { SpanishParseIntPipe } from './spanish-parse-int.pipe';

describe('SpanishParseIntPipe', () => {
  // M3: the built-in ParseIntPipe's default exceptionFactory produces the
  // English "Validation failed (numeric string is expected)" message. Every
  // other validation failure in this app is in Spanish; this pins that a
  // non-numeric route param now throws the Spanish message instead.
  it('throws a BadRequestException with a Spanish message for a non-numeric value', async () => {
    const pipe = new SpanishParseIntPipe();

    await expect(
      pipe.transform('abc', { type: 'param' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform('abc', { type: 'param' } as any),
    ).rejects.toThrow('El identificador debe ser un número entero');
  });

  it('parses a numeric string to a number', async () => {
    const pipe = new SpanishParseIntPipe();

    await expect(pipe.transform('42', { type: 'param' } as any)).resolves.toBe(
      42,
    );
  });
});
