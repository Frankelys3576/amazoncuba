import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('lowercases, strips accents, and hyphenates', () => {
    expect(generateSlug('Café Cubano #1')).toBe('cafe-cubano-1');
  });

  it('returns an empty string for falsy input', () => {
    expect(generateSlug('')).toBe('');
    expect(generateSlug(undefined as any)).toBe('');
  });
});
