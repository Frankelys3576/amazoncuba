import { Prisma } from '@prisma/client';
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

  // C1: el blob crudo se dejó fuera entero y con él desapareció el
  // beneficiario de Zelle, que Checkout.jsx pinta ("Titular", "Zelle
  // (Correo/Tel)"). Vuelven esas tres claves y sólo esas tres.
  describe('zelle_info (subconjunto del beneficiario)', () => {
    it('devuelve name/email_phone/description y nada más del blob', () => {
      const store = {
        id: 1,
        zelle_info: {
          name: 'Titular Zelle',
          email_phone: 'titular@example.com',
          description: 'Poner el número de pedido',
          province: 'La Habana',
          gallery: ['a.png'],
          user_id: 'no-debe-salir',
        },
      };

      const formatted = formatStore(store as any);
      expect(Object.keys(formatted.zelle_info!).sort()).toEqual([
        'description',
        'email_phone',
        'name',
      ]);
      expect(formatted.zelle_info).toEqual({
        name: 'Titular Zelle',
        email_phone: 'titular@example.com',
        description: 'Poner el número de pedido',
      });
    });

    it('devuelve null (no un objeto con las tres claves en null) cuando no hay beneficiario configurado', () => {
      expect(formatStore({ id: 1, zelle_info: null } as any).zelle_info).toBeNull();
      expect(formatStore({ id: 1, zelle_info: {} } as any).zelle_info).toBeNull();
      expect(
        formatStore({
          id: 1,
          zelle_info: { province: 'La Habana', gallery: ['a.png'] },
        } as any).zelle_info,
      ).toBeNull();
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

  // Regression: schema.prisma types price_per_night as `Decimal?`, so at
  // runtime store.price_per_night is a Prisma.Decimal instance, never a
  // plain JS number. A plain object literal fixture (`price_per_night: 40`)
  // doesn't exercise that, so these tests build real Prisma.Decimal values
  // the way the generated client actually returns them.
  describe('price_per_night with a real Prisma.Decimal direct column', () => {
    it('returns a plain JS number, not a Decimal/string, for a non-null Decimal', () => {
      const store = {
        id: 1,
        price_per_night: new Prisma.Decimal(40),
        zelle_info: {},
      };

      const result = formatStore(store as any);

      expect(typeof result.price_per_night).toBe('number');
      expect(result.price_per_night).toBe(40);
      expect(JSON.stringify({ price_per_night: result.price_per_night })).toBe(
        '{"price_per_night":40}',
      );
    });

    it('falls back to zelle_info.price_per_night when the direct column is Decimal(0), matching Express falsy-0 semantics', () => {
      const store = {
        id: 1,
        price_per_night: new Prisma.Decimal(0),
        zelle_info: { price_per_night: 25 },
      };

      const result = formatStore(store as any);

      expect(result.price_per_night).toBe(25);
    });

    it('falls back to zelle_info.price_per_night when the direct column is null', () => {
      const store = {
        id: 1,
        price_per_night: null,
        zelle_info: { price_per_night: 25 },
      };

      const result = formatStore(store as any);

      expect(result.price_per_night).toBe(25);
    });

    it('returns null, not 0, when both the direct column and zelle_info are null/absent', () => {
      const store = {
        id: 1,
        price_per_night: null,
        zelle_info: {},
      };

      const result = formatStore(store as any);

      expect(result.price_per_night).toBeNull();
    });
  });
});
