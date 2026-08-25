import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// e2e coverage for the Task 3 fix round (public surface hardening, Critical):
// GET /api/stores/:id had NO status filter in either backend -- a
// pending/rejected store's whole public profile (name, description, phone,
// address, gallery) was fetchable by anyone who knew (or, for a slug,
// guessed) the id. Only the external boundaries (PrismaService,
// SupabaseService's client) are stubbed here -- StoresController's real
// resolveCaller and StoresService.findOne run for real, so a regression to
// "no filter" or "403 instead of 404" shows up as a genuinely wrong HTTP
// response.
//
// The rule under test: approved -> anyone; not approved -> admin, or the
// seller who owns THAT store. Everyone else gets the SAME 404 as "doesn't
// exist" -- never 403, which would confirm the store exists.
describe('GET /api/stores/:id (e2e) — non-approved store visibility', () => {
  let app: INestApplication;

  const PENDING_STORE_ID = '11111111-1111-1111-1111-111111111111';
  const APPROVED_STORE_ID = '44444444-4444-4444-4444-444444444444';
  const OTHER_SELLER_STORE_ID = '55555555-5555-5555-5555-555555555555';

  const OWNER_TOKEN = 'owner-token'; // resolves to the seller who owns PENDING_STORE_ID
  const OTHER_SELLER_TOKEN = 'other-seller-token'; // resolves to a seller who owns a DIFFERENT store
  const ADMIN_TOKEN = 'admin-token';

  const PENDING_STORE = {
    id: PENDING_STORE_ID,
    status: 'pending',
    user_id: 'owner-u1',
    name: 'Tienda Pendiente',
    phone: '5551234',
    zelle_info: {},
  };
  const APPROVED_STORE = {
    id: APPROVED_STORE_ID,
    status: 'approved',
    user_id: null,
    name: 'Tienda Aprobada',
    phone: '5559999',
    zelle_info: {},
  };
  const stores = [PENDING_STORE, APPROVED_STORE];
  const storesByUserId: Record<string, { id: string }> = {
    'owner-u1': { id: PENDING_STORE_ID },
    'other-seller-u2': { id: OTHER_SELLER_STORE_ID },
  };

  let findUnique: jest.Mock;
  let getUser: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn(({ where }: any) => {
      // StoresController#resolveCaller's own "which store do I own" lookup.
      if (where.user_id !== undefined) {
        return Promise.resolve(storesByUserId[where.user_id] ?? null);
      }
      // StoresService#findOne's lookup of the requested store.
      return Promise.resolve(stores.find((s) => s.id === where.id) ?? null);
    });

    getUser = jest.fn((token: string) => {
      if (token === OWNER_TOKEN) {
        return Promise.resolve({
          data: { user: { id: 'owner-u1', app_metadata: { role: 'seller' } } },
          error: null,
        });
      }
      if (token === OTHER_SELLER_TOKEN) {
        return Promise.resolve({
          data: { user: { id: 'other-seller-u2', app_metadata: { role: 'seller' } } },
          error: null,
        });
      }
      if (token === ADMIN_TOKEN) {
        return Promise.resolve({
          data: { user: { id: 'admin-u1', app_metadata: { role: 'admin' } } },
          error: null,
        });
      }
      return Promise.resolve({ data: { user: null }, error: { message: 'invalid token' } });
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ store: { findUnique } })
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

  it('1. anonymous gets 404 (not 403) for a pending store', () => {
    return request(app.getHttpServer())
      .get(`/api/stores/${PENDING_STORE_ID}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error).toBe('Tienda no encontrada');
      });
  });

  it('2. the owning seller gets 200 for their own pending store', () => {
    return request(app.getHttpServer())
      .get(`/api/stores/${PENDING_STORE_ID}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(PENDING_STORE_ID);
        expect(res.body.status).toBe('pending');
      });
  });

  it('3. a different seller (who owns a different store) gets 404, not 403', () => {
    return request(app.getHttpServer())
      .get(`/api/stores/${PENDING_STORE_ID}`)
      .set('Authorization', `Bearer ${OTHER_SELLER_TOKEN}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error).toBe('Tienda no encontrada');
      });
  });

  it('4. an admin gets 200 for a pending store', () => {
    return request(app.getHttpServer())
      .get(`/api/stores/${PENDING_STORE_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(PENDING_STORE_ID);
      });
  });

  it('5. an approved store stays public for an anonymous caller', () => {
    return request(app.getHttpServer())
      .get(`/api/stores/${APPROVED_STORE_ID}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(APPROVED_STORE_ID);
      });
  });
});
