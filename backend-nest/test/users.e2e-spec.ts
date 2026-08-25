import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// e2e coverage for AdminGuard against a real booted AppModule and real HTTP
// requests, not just the mocked ExecutionContext/SupabaseService doubles in
// admin.guard.spec.ts. GET /api/users is the route whose exposure motivated
// this project, so it's the one exercised here.
//
// Only the external boundaries (PrismaService, SupabaseService's client) are
// stubbed — GuardsModule, AdminGuard and UsersModule/UsersController wiring
// are all real, so a route where the guard decorator or module import were
// silently missing would show up as a 200/500 here instead of a 401/403.
describe('Users admin routes (e2e) — real AdminGuard chain', () => {
  let app: INestApplication;

  const ADMIN_TOKEN = 'admin-token';
  const SELLER_TOKEN = 'seller-token';

  const usersByToken: Record<
    string,
    { id: string; app_metadata: Record<string, unknown> }
  > = {
    [ADMIN_TOKEN]: { id: 'admin-1', app_metadata: { role: 'admin' } },
    [SELLER_TOKEN]: { id: 'seller-1', app_metadata: { role: 'seller' } },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
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
            admin: {
              listUsers: jest.fn().mockResolvedValue({
                data: { users: [] },
                error: null,
              }),
            },
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

  it('1. GET /api/users with no Authorization header returns 401', () => {
    return request(app.getHttpServer())
      .get('/api/users')
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe('Token no proporcionado');
      });
  });

  it('2. GET /api/users with an admin token returns 200 (not 401/403)', () => {
    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual([]);
      });
  });

  it('3. GET /api/users with a bare "Bearer" (no token) returns 401', () => {
    // authHeader.split(' ')[1] used to yield undefined here, which was then
    // handed straight to getUser(). Against a real Supabase client that does
    // not fail: it falls back to whatever session the shared client holds —
    // the last user who logged in — which is the actual privilege escalation.
    // The SupabaseService stub here cannot reproduce that fallback, so what
    // this case pins down is the other half: over real HTTP, through the real
    // guard chain, a bare "Bearer" is rejected with 401 before Supabase is
    // consulted at all. The session fallback itself is covered by the ordered
    // assertion in backend/smoke_admin_auth.mjs.
    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', 'Bearer')
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe('Token no proporcionado');
      });
  });

  it('4. GET /api/users with a non-admin (seller) token returns 403', () => {
    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${SELLER_TOKEN}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('No tienes permisos de administrador');
      });
  });
});
