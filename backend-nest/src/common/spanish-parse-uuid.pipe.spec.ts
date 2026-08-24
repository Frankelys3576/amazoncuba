import { BadRequestException } from '@nestjs/common';
import { SpanishParseUuidPipe } from './spanish-parse-uuid.pipe';

describe('SpanishParseUuidPipe', () => {
  const pipe = new SpanishParseUuidPipe();

  it('passes a valid uuid through unchanged', () => {
    const id = '018f3a4b-1c2d-7e3f-8a9b-0c1d2e3f4a5b';
    expect(pipe.transform(id)).toBe(id);
  });

  it('rejects a non-uuid with a Spanish message', () => {
    expect(() => pipe.transform('abc')).toThrow(BadRequestException);
    try {
      pipe.transform('abc');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toMatchObject({
        message: 'El identificador debe ser un UUID válido',
      });
    }
  });

  it('rejects an integer id, which is what the old routes accepted', () => {
    expect(() => pipe.transform('42')).toThrow(BadRequestException);
  });
});
