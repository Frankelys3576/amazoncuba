import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// e2e coverage for Task 3 (public surface hardening): GET /api/stores used to
// have no status filter (pending/rejected stores were public) and formatStore
// spread `...store`, so the response also carried legacy_id, user_id, and the
// raw zelle_info blob. The payee subset of zelle_info (name/email_phone/
// description) is back on purpose — Checkout.jsx renders it — but the rest of
// the blob stays out. Only the external boundaries (PrismaService,
// SupabaseService's client) are stubbed here — StoresController's own
// admin-detection and StoresService/formatStore are all real, so a
// regression to the old spread-everything/no-filter behaviour shows up as a
// genuinely wrong HTTP response, not a mocked assertion.
describe('GET /api/stores (e2e) — status filter + column whitelist', () => {
  let app: INestApplication;

  const ADMIN_TOKEN = 'admin-token';
  const INVALID_TOKEN = 'not-a-real-token';

  const APPROVED_STORE = {
    id: '11111111-1111-1111-1111-111111111111',
    legacy_id: 1n,
    name: 'Cafeteria Aprobada',
    status: 'approved',
    user_id: '99999999-9999-9999-9999-999999999999',
    phone: '5551234',
    zelle_info: {
      name: 'Titular Zelle',
      email_phone: 'titular@example.com',
      description: 'Poner el número de pedido',
      lat: 23.1,
      lng: -82.3,
      gallery: ['a.jpg'],
    },
  };
  const PENDING_STORE = {
    id: '22222222-2222-2222-2222-222222222222',
    legacy_id: 2n,
    name: 'Tienda Pendiente',
    status: 'pending',
    user_id: '88888888-8888-8888-8888-888888888888',
    phone: '5555678',
    zelle_info: {},
  };
  const REJECTED_STORE = {
    id: '33333333-3333-3333-3333-333333333333',
    legacy_id: 3n,
    name: 'Tienda Rechazada',
    status: 'rejected',
    user_id: '77777777-7777-7777-7777-777777777777',
    phone: '5559999',
    zelle_info: {},
  };

  let findMany: jest.Mock;
  let getUser: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn((args: any) => {
      const all = [APPROVED_STORE, PENDING_STORE, REJECTED_STORE];
      if (args?.where?.status === 'approved') {
        return Promise.resolve(all.filter((s) => s.status === 'approved'));
      }
      return Promise.resolve(all);
    });

    getUser = jest.fn((token: string) => {
      if (token === ADMIN_TOKEN) {
        return Promise.resolve({
          data: { user: { id: 'admin-u1', app_metadata: { role: 'admin' } } },
          error: null,
        });
      }
      return Promise.resolve({
        data: { user: null },
        error: { message: 'invalid token' },
      });
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ store: { findMany } })
      .overrideProvider(SupabaseService)
      .useValue({ client: { auth: { getUser } } })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. an anonymous caller (no Authorization header) sees only approved stores', () => {
    return request(app.getHttpServer())
      .get('/api/stores')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe(APPROVED_STORE.id);
        expect(findMany).toHaveBeenCalledWith({ where: { status: 'approved' } });
      });
  });

  it('2. a caller with an invalid/expired token is treated as anonymous, not rejected', () => {
    return request(app.getHttpServer())
      .get('/api/stores')
      .set('Authorization', `Bearer ${INVALID_TOKEN}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe(APPROVED_STORE.id);
      });
  });

  it('3. an admin caller sees pending and rejected stores too (the property AdminStores.jsx depends on)', () => {
    return request(app.getHttpServer())
      .get('/api/stores')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect((res) => {
        const ids = res.body.map((s: any) => s.id);
        expect(ids).toEqual(
          expect.arrayContaining([APPROVED_STORE.id, PENDING_STORE.id, REJECTED_STORE.id]),
        );
        expect(findMany).toHaveBeenCalledWith({ where: {} });
      });
  });

  it('4. the response never carries user_id or legacy_id, but does carry phone', () => {
    return request(app.getHttpServer())
      .get('/api/stores')
      .expect(200)
      .expect((res) => {
        const store = res.body[0];
        expect(store).not.toHaveProperty('user_id');
        expect(store).not.toHaveProperty('legacy_id');
        expect(store.phone).toBe(APPROVED_STORE.phone);
      });
  });

  // I3: la ruta pública nunca devuelve 401, así que un administrador con la
  // sesión caducada veía el listado recortado (cero tiendas pendientes) y
  // ningún error -- indistinguible de un panel que funciona. Con ?as=admin el
  // llamante declara que espera datos de administrador y el fallo es ruidoso.
  describe('?as=admin (I3): la ruta falla fuerte cuando se piden datos de administrador', () => {
    it('sin credencial responde 401', () => {
      return request(app.getHttpServer()).get('/api/stores?as=admin').expect(401);
    });

    it('con un token caducado/ inválido responde 401, no un 200 recortado', () => {
      return request(app.getHttpServer())
        .get('/api/stores?as=admin')
        .set('Authorization', `Bearer ${INVALID_TOKEN}`)
        .expect(401);
    });

    it('con token de administrador devuelve el listado completo', () => {
      return request(app.getHttpServer())
        .get('/api/stores?as=admin')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(3);
          expect(findMany).toHaveBeenCalledWith({ where: {} });
        });
    });
  });

  // C1: dropping zelle_info entirely took the Zelle payment block off the
  // air (Checkout.jsx reads store.zelle_info.name / .email_phone). Only the
  // payee subset comes back; the rest of the blob must not.
  it('5. zelle_info carries exactly the three payee keys, and nothing else from the blob', () => {
    return request(app.getHttpServer())
      .get('/api/stores')
      .expect(200)
      .expect((res) => {
        const store = res.body[0];
        expect(Object.keys(store.zelle_info).sort()).toEqual([
          'description',
          'email_phone',
          'name',
        ]);
        expect(store.zelle_info.name).toBe('Titular Zelle');
        expect(store.zelle_info.email_phone).toBe('titular@example.com');
        expect(store.zelle_info.description).toBe('Poner el número de pedido');
      });
  });
});
