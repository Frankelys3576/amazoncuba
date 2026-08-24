import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// e2e coverage for OrdersQueryAuthGuard against a real booted AppModule and
// real HTTP requests. Before this task, GET /api/orders had no guard at all
// on the Nest side: any unauthenticated caller could pull every order on
// the platform, customer PII (name, email, phone, address) included. Case 1
// below is that hole, and is the single most important assertion in this
// file.
//
// Only the external boundaries (PrismaService, SupabaseService's client)
// are stubbed -- GuardsModule, OrdersQueryAuthGuard and
// OrdersModule/OrdersController wiring are all real, so a route where the
// guard decorator or module import were silently missing would show up as
// a 200/500 here instead of a 401/403.
describe('Orders query authorization (e2e) — real OrdersQueryAuthGuard chain', () => {
  let app: INestApplication;

  const STORE_ID = '11111111-1111-1111-1111-111111111111';
  const OTHER_STORE_ID = '22222222-2222-2222-2222-222222222222';
  const VALID_ORDER_ID = '33333333-3333-3333-3333-333333333333';

  const SELLER_TOKEN = 'seller-token'; // resolves to a user who owns STORE_ID
  const ADMIN_TOKEN = 'admin-token';

  let getUser: jest.Mock;
  let orderItemFindMany: jest.Mock;
  let orderFindMany: jest.Mock;
  let storeFindUnique: jest.Mock;

  beforeEach(async () => {
    getUser = jest.fn((token: string) => {
      if (token === SELLER_TOKEN) {
        return Promise.resolve({
          data: { user: { id: 'seller-u1', app_metadata: { role: 'seller' } } },
          error: null,
        });
      }
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

    // Used by OrdersQueryAuthGuard's own storeId lookup
    // (prisma.store.findUnique({ where: { user_id } })).
    storeFindUnique = jest.fn(({ where }: any) => {
      if (where.user_id === 'seller-u1') {
        return Promise.resolve({ id: STORE_ID, user_id: 'seller-u1' });
      }
      return Promise.resolve(null);
    });

    orderItemFindMany = jest.fn().mockResolvedValue([]);
    orderFindMany = jest.fn().mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        store: { findUnique: storeFindUnique },
        orderItem: { findMany: orderItemFindMany },
        order: { findMany: orderFindMany },
      })
      .overrideProvider(SupabaseService)
      .useValue({ client: { auth: { getUser } } })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. GET /api/orders with no credential and no query returns 401 (the customer-PII exposure)', () => {
    return request(app.getHttpServer())
      .get('/api/orders')
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe('Token no proporcionado');
      });
  });

  it('2. GET /api/orders?ids=<uuid> with no credential is not 401 — the "my orders" page stays open for logged-out visitors', async () => {
    await request(app.getHttpServer())
      .get(`/api/orders?ids=${VALID_ORDER_ID}`)
      .expect((res) => {
        expect(res.status).not.toBe(401);
      });

    // Confirms the guard actually short-circuits on ids rather than
    // laboriously authenticating first and happening to allow it through --
    // those are different behaviours, and only the short-circuit keeps this
    // path open when Supabase itself is unreachable.
    expect(getUser).not.toHaveBeenCalled();
  });

  it('3. GET /api/orders?storeId=<id> with a seller token owning that store is not 401/403', () => {
    return request(app.getHttpServer())
      .get(`/api/orders?storeId=${STORE_ID}`)
      .set('Authorization', `Bearer ${SELLER_TOKEN}`)
      .expect((res) => {
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
  });

  it('4. GET /api/orders?storeId=<other id> with that same seller token returns 403', () => {
    return request(app.getHttpServer())
      .get(`/api/orders?storeId=${OTHER_STORE_ID}`)
      .set('Authorization', `Bearer ${SELLER_TOKEN}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('No tienes permiso sobre esta tienda');
      });
  });

  it('5. GET /api/orders with an admin token and no query is not 401/403', () => {
    return request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect((res) => {
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
  });
});
