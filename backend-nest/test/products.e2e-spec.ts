import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { SellerAuthGuard } from '../src/auth/seller-auth.guard';

// Auth is not what's under test here (Task 13's stores.e2e-spec.ts is the
// spec that drives the real SellerAuthGuard/SellerAuthStrategy chain end to
// end). This spec stubs SellerAuthGuard purely for convenience so it can
// focus on the public/validation/guarded-route wiring pattern for the
// products routes without re-deriving Supabase/Prisma auth fixtures.
describe('Products (e2e)', () => {
  let app: INestApplication;
  let prismaMock: {
    product: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
        update: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
      },
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      // No route exercised here touches Supabase today, but a real
      // SupabaseService would otherwise construct a live client (env vars
      // are present in .env, so createClient succeeds silently). Stubbing
      // it defensively means a future edit that adds a Supabase call to
      // ProductsController/ProductsService fails fast against this stub
      // instead of silently attempting a real network call.
      .overrideProvider(SupabaseService)
      .useValue({
        client: {
          auth: {
            getUser: jest.fn(),
            admin: { updateUserById: jest.fn(), createUser: jest.fn() },
          },
        },
      })
      .overrideGuard(SellerAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.store = { id: 1 };
          return true;
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

  // M3: pins the Spanish exceptionFactory end to end through the real pipe
  // wired into the controller, not just the pipe class in isolation.
  it('GET /api/products/:id with a non-numeric id returns 400 with the Spanish message', () => {
    return request(app.getHttpServer())
      .get('/api/products/abc')
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe('El identificador debe ser un número entero');
      });
  });

  it('GET /api/products is public and returns an array', () => {
    return request(app.getHttpServer())
      .get('/api/products')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  // M4: the BigInt.prototype.toJSON shim (src/common/bigint.ts, imported for
  // its side effect by AppModule) is what makes it possible to
  // JSON-serialize a response at all when Prisma returns a real bigint id/FK
  // — without it, res.send() throws "Do not know how to serialize a BigInt"
  // and this request would 500. A mock that returns plain `number` ids
  // (as the rest of this file's fixtures do) would never exercise that path;
  // this one deliberately returns a real `bigint` the way the generated
  // Prisma client actually does.
  it('GET /api/products serializes a real Prisma bigint id/store_id without throwing (BigInt.prototype.toJSON shim)', () => {
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: BigInt(1), store_id: BigInt(7), name: 'Café', price: 5 },
    ]);

    return request(app.getHttpServer())
      .get('/api/products')
      .expect(200)
      .expect((res) => {
        expect(res.body[0].id).toBe(1);
        expect(res.body[0].store_id).toBe(7);
      });
  });

  // CRITICAL 1: SellerProducts.jsx always sends store_id as a string
  // (localStorage.getItem never gets parsed), never as a number. A fixture
  // that posts store_id: 1 (a number) exercises a payload shape the real
  // frontend never sends and would pass even if the DTO rejected the
  // string the client actually posts. Send it as the frontend does.
  it('POST /api/products with an authenticated store and valid body (store_id as a string, as the frontend sends it) returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Café',
        price: 5,
        store_id: '1',
        province: 'La Habana',
        municipality: 'Playa',
      })
      .expect(201);
  });

  it('POST /api/products with a non-numeric string store_id still returns 400', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Café',
        price: 5,
        store_id: 'abc',
        province: 'La Habana',
        municipality: 'Playa',
      })
      .expect(400);
  });

  it('POST /api/products with a missing required field returns 400', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({ price: 5, store_id: 1 })
      .expect(400);
  });

  // CRITICAL 2: SellerProducts.jsx's "destacar producto" toggle PUTs
  // { is_featured: !product.is_featured }. Before the DTO fix, whitelist:true
  // silently stripped is_featured before it reached the service, so
  // prisma.product.update's data was `{}` and the toggle no-op'd behind a
  // 200. Asserting only the HTTP status would pass against that bug — this
  // asserts the field actually reaches the mocked Prisma call's data.
  it('PUT /api/products/:id with is_featured survives validation and reaches prisma.product.update', () => {
    return request(app.getHttpServer())
      .put('/api/products/1')
      .send({ is_featured: true })
      .expect(200)
      .expect(() => {
        expect(prismaMock.product.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            data: expect.objectContaining({ is_featured: true }),
          }),
        );
      });
  });
});
