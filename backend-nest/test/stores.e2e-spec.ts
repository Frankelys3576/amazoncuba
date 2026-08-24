import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// This spec is the point of Task 13: it does NOT override SellerAuthGuard,
// StoreOwnershipGuard, or SellerAuthStrategy. Only the external boundaries
// (SupabaseService's client and PrismaService) are stubbed, so a request
// carrying a real `Authorization: Bearer <token>` header genuinely drives:
//
//   SellerAuthStrategy.validate() -> { user, store }
//     -> SellerAuthGuard.handleRequest() splits the payload (req.store = store)
//       -> StoreOwnershipGuard compares req.store.id to the :id route param
//
// A prior Critical (fixed in commit d8c1814) had SellerAuthGuard's base
// class collapse { user, store } onto req.user alone, leaving req.store
// undefined and 500ing every seller-guarded endpoint at runtime. Because the
// real guard/strategy run here, a regression to that bug makes case 3 below
// fail loudly (the credentials endpoint throws reading `req.store.phone`)
// instead of passing green against a stub that hand-assigns req.store.
describe('Stores ownership (e2e) — real SellerAuthGuard/StoreOwnershipGuard chain', () => {
  let app: INestApplication;
  let storesById: Record<number, any>;
  let updateUserById: jest.Mock;

  const VALID_TOKEN = 'valid-token'; // resolves to a user whose phone matches store 1
  const ORPHAN_TOKEN = 'orphan-token'; // resolves to a user with no matching store

  // Maps Bearer tokens (as received by SupabaseService.client.auth.getUser)
  // to the Supabase user they represent — mirrors what a real getUser(token)
  // call would resolve, without touching a live Supabase project.
  const usersByToken: Record<string, { id: string; email: string }> = {
    [VALID_TOKEN]: { id: 'u1', email: '5551234@cubaamazon.com' },
    [ORPHAN_TOKEN]: { id: 'u2', email: '9999999@cubaamazon.com' },
  };

  beforeEach(async () => {
    storesById = { 1: { id: 1, phone: '5551234', zelle_info: {} } };
    updateUserById = jest.fn().mockResolvedValue({ error: null });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        store: {
          // Used by SellerAuthStrategy.validate() to resolve the caller's
          // store from the phone number extracted from their email.
          findFirst: jest.fn(({ where }: any) => {
            const found = Object.values(storesById).find(
              (s) => s.phone === where.phone,
            );
            return Promise.resolve(found ?? null);
          }),
          // Used by StoresService.updateProfile() to load the pre-update row.
          findUnique: jest.fn(({ where }: any) =>
            Promise.resolve(storesById[where.id] ?? null),
          ),
          update: jest.fn(({ where, data }: any) => {
            const existing = storesById[where.id];
            const updated = { ...existing, ...data };
            storesById[where.id] = updated;
            return Promise.resolve(updated);
          }),
        },
      })
      .overrideProvider(SupabaseService)
      .useValue({
        client: {
          auth: {
            getUser: jest.fn((token: string) => {
              const user = usersByToken[token];
              if (!user) {
                return Promise.resolve({
                  data: { user: null },
                  error: { message: 'invalid token' },
                });
              }
              return Promise.resolve({ data: { user }, error: null });
            }),
            admin: { updateUserById },
          },
        },
      })
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

  it('1. PUT /api/stores/1 as the owner (real chain) returns 200', () => {
    return request(app.getHttpServer())
      .put('/api/stores/1')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ name: 'Nueva Cafetería' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Nueva Cafetería');
      });
  });

  it('2. PUT /api/stores/2 as store 1 returns 403 via the real StoreOwnershipGuard', () => {
    return request(app.getHttpServer())
      .put('/api/stores/2')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ name: 'Nueva Cafetería' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('No tienes permiso sobre esta tienda');
      });
  });

  it('3. regression: req.store is actually populated by the real guard chain', () => {
    // StoresController#updateCredentials reads both req.user.id and
    // req.store.phone (StoresService.updateCredentials). Sending only a
    // password (no phone) means the response's `phone` field can only come
    // from req.store.phone — a value nobody hardcodes in the controller —
    // which is populated solely by SellerAuthStrategy's own store lookup
    // (mocked prisma.store.findFirst) being correctly split onto the
    // request by SellerAuthGuard.handleRequest. If a future regression
    // reintroduces the pre-d8c1814 bug (req.store left undefined because
    // AuthGuard collapses { user, store } onto req.user alone), this
    // assertion fails loudly (500, since `req.store.phone` throws) instead
    // of silently passing.
    return request(app.getHttpServer())
      .put('/api/stores/1/credentials')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ password: 'newpassword123' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          message: 'Credenciales actualizadas exitosamente',
          phone: '5551234', // == storesById[1].phone, proving req.store came from the real chain
        });
        // Also proves req.user was correctly split off (the bare Supabase
        // user, id 'u1') rather than left as the strategy's { user, store }
        // composite payload.
        expect(updateUserById).toHaveBeenCalledWith(
          'u1',
          expect.objectContaining({ password: 'newpassword123' }),
        );
      });
  });

  it("4. no Authorization header returns 401 with the Spanish 'Token no proporcionado' message (IMPORTANT 6)", () => {
    // With no Authorization header, passport-http-bearer's Strategy has no
    // token to hand to SellerAuthStrategy.validate() at all, so it calls
    // fail() directly and validate() never runs — the custom 'Token inválido
    // o expirado' UnauthorizedException thrown inside validate() is never
    // reached. SellerAuthGuard.handleRequest then sees err=null, user=false.
    // It used to throw a bare `new UnauthorizedException()` there, which the
    // global filter rendered with Nest's default "Unauthorized" message —
    // Express's auth.middleware.js:14-16 returns "Token no proporcionado"
    // for this exact case, so the guard now throws with that message
    // explicitly. Case 4b below shows the strategy's own Spanish message IS
    // produced by the real chain once a token is present (even if invalid),
    // because that's what actually reaches validate().
    return request(app.getHttpServer())
      .put('/api/stores/1')
      .send({ name: 'Nueva Cafetería' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe('Token no proporcionado');
      });
  });

  it("4b. a present but invalid bearer token returns 401 'Token inválido o expirado' (the strategy's own message)", () => {
    return request(app.getHttpServer())
      .put('/api/stores/1')
      .set('Authorization', 'Bearer this-token-does-not-exist')
      .send({ name: 'Nueva Cafetería' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe('Token inválido o expirado');
      });
  });

  it("5. a bearer token whose derived phone matches no store returns 403 'No se encontró una tienda asociada a este usuario'", () => {
    return request(app.getHttpServer())
      .put('/api/stores/1')
      .set('Authorization', `Bearer ${ORPHAN_TOKEN}`)
      .send({ name: 'Nueva Cafetería' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe(
          'No se encontró una tienda asociada a este usuario',
        );
      });
  });
});
