import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('lowercases, strips accents, and hyphenates', () => {
    expect(generateSlug('Café Cubano #1')).toBe('cafe-cubano-1');
  });

  it('returns an empty string for falsy input', () => {
    expect(generateSlug('')).toBe('');
    expect(generateSlug(undefined as any)).toBe('');
  });

  // M6: pins that rewriting the combining-diacritics range as the
  // \u0300-\u036f escape sequence (instead of raw combining characters
  // embedded in the regex literal) is behaviorally identical, across a
  // string with multiple distinct accented characters (i, N, u, o).
  it('strips accents from multiple distinct diacritics in one string', () => {
    expect(generateSlug('Cafetería Ñandú El Rincón')).toBe(
      'cafeteria-nandu-el-rincon',
    );
  });
});
