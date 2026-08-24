import { formatStore } from './store-format.util';

describe('formatStore', () => {
  it('falls back to zelle_info fields when the direct columns are empty', () => {
    const store = {
      id: 1,
      province: null,
      municipality: null,
      address: null,
      lat: null,
      lng: null,
      price_per_night: null,
      zelle_info: {
        province: 'La Habana',
        municipality: 'Playa',
        address: 'Calle 1',
        lat: 23.1,
        lng: -82.4,
        price_per_night: 40,
        gallery: ['a.png'],
      },
    };

    expect(formatStore(store as any)).toMatchObject({
      province: 'La Habana',
      municipality: 'Playa',
      address: 'Calle 1',
      lat: 23.1,
      lng: -82.4,
      price_per_night: 40,
      gallery: ['a.png'],
    });
  });

  it('prefers direct columns over zelle_info when both are set', () => {
    const store = {
      id: 1,
      province: 'Matanzas',
      municipality: null,
      address: null,
      lat: null,
      lng: null,
      price_per_night: null,
      zelle_info: { province: 'La Habana' },
    };

    expect(formatStore(store as any).province).toBe('Matanzas');
  });

  it('returns falsy input unchanged', () => {
    expect(formatStore(null as any)).toBeNull();
  });
});
