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
  let orderItemFindFirst: jest.Mock;
  let orderFindMany: jest.Mock;
  let orderUpdate: jest.Mock;
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
    orderItemFindFirst = jest.fn().mockResolvedValue(null);
    orderFindMany = jest.fn().mockResolvedValue([]);
    // Stubbed so a guard-removal regression fails for the real reason: an
    // unauthorized write reaching the DB and succeeding (200), not an
    // incidental 500 from an unstubbed Prisma call.
    orderUpdate = jest.fn().mockResolvedValue({
      id: VALID_ORDER_ID,
      status: 'shipped',
      total: 10,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        store: { findUnique: storeFindUnique },
        orderItem: { findMany: orderItemFindMany, findFirst: orderItemFindFirst },
        order: { findMany: orderFindMany, update: orderUpdate },
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

  it('3. GET /api/orders?storeId=<id> with a seller token owning that store returns 200', () => {
    // Asserting the real status, not `not.toBe(401)`: a 500 satisfies "not
    // 401 and not 403" just as happily, so the weaker form passed green with
    // @UseGuards(OrdersQueryAuthGuard) removed outright.
    return request(app.getHttpServer())
      .get(`/api/orders?storeId=${STORE_ID}`)
      .set('Authorization', `Bearer ${SELLER_TOKEN}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual([]);
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

  it('5. GET /api/orders with an admin token and no query returns 200', () => {
    return request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual([]);
      });
  });

  it('6. GET /api/orders with a valid SELLER token and no query returns 403 — the escalation path', async () => {
    // Ésta es la escalada real, y hasta ahora sólo existía como prueba
    // unitaria con un doble que rechazaba porque se le había dicho que
    // rechazara. Un vendedor con sesión válida pidiendo /api/orders sin
    // filtro se lleva la tabla ENTERA: nombre, correo, teléfono y dirección
    // de cada cliente de la plataforma, incluidos los de sus competidores.
    // Autenticado no es lo mismo que autorizado.
    await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${SELLER_TOKEN}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('No tienes permisos de administrador');
      });

    // Y no llegó a consultarse ningún pedido.
    expect(orderFindMany).not.toHaveBeenCalled();
    expect(orderItemFindMany).not.toHaveBeenCalled();
  });

  it('7. PUT /api/orders/:id with no credential and status "shipped" returns 403 — OrderUpdateAuthGuard', () => {
    // Antes de OrderUpdateAuthGuard, esta ruta no tenía guard alguno:
    // cualquiera podía fijar cualquier estado en cualquier pedido
    // recorriendo los ids. Un cliente sin credencial sólo puede marcar
    // 'delivered' ("marcar como recibido"); cualquier otro estado sin
    // credencial debe rechazarse.
    return request(app.getHttpServer())
      .put(`/api/orders/${VALID_ORDER_ID}`)
      .send({ status: 'shipped' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('No tienes permiso para cambiar este pedido');
      });
  });
});
