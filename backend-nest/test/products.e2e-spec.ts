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

  // class-validator's @IsUUID checks the RFC variant nibble too (must be
  // 8/9/a/b), unlike SpanishParseUuidPipe's looser route-param regex — so
  // these need to be real uuid-shaped (version 7, variant 8) to pass the
  // CreateProductDto validation this spec exercises via POST.
  const STORE_ID = '11111111-1111-7111-8111-111111111111';
  const PRODUCT_ID = '22222222-2222-7222-8222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: PRODUCT_ID, store_id: STORE_ID }),
        findUnique: jest.fn().mockResolvedValue({ id: PRODUCT_ID, store_id: STORE_ID }),
        update: jest.fn().mockResolvedValue({ id: PRODUCT_ID, store_id: STORE_ID }),
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
          req.store = { id: STORE_ID };
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

  // M3 (updated for the uuid migration): pins the Spanish exceptionFactory
  // end to end through the real pipe wired into the controller, not just the
  // pipe class in isolation. Ids became uuid v7 strings, so the pipe is now
  // SpanishParseUuidPipe and its message reflects that.
  it('GET /api/products/:id with a non-uuid id returns 400 with the Spanish message', () => {
    return request(app.getHttpServer())
      .get('/api/products/abc')
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe('El identificador debe ser un UUID válido');
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

  // C2: schema.prisma still carries 15 `BigInt` `legacy_*` columns (the
  // migration's rollback scaffolding), and formatProduct spreads the whole
  // row (`...rest`). A row with a genuine bigint on it therefore reaches
  // res.json(), where JSON.stringify throws "Do not know how to serialize a
  // BigInt" and this request 500s — unless the global
  // StripLegacyFieldsInterceptor removed the column first.
  //
  // This fixture returns real `bigint`s (`1n`), not `Number`s. Every other
  // Prisma mock in this suite returns plain `Number`/string fields, which is
  // exactly why 121/121 stayed green when the previous BigInt regression
  // test was deleted. Revert the interceptor and this test fails with a 500.
  it('GET /api/products serializes a row carrying real bigint legacy_* columns, and never returns them', () => {
    prismaMock.product.findMany.mockResolvedValueOnce([
      {
        id: PRODUCT_ID,
        legacy_id: 1n,
        store_id: STORE_ID,
        legacy_store_id: 7n,
        legacy_category_id: 3n,
        legacy_store_category_id: null,
        name: 'Café',
        price: 5,
      },
    ]);

    return request(app.getHttpServer())
      .get('/api/products')
      .expect(200)
      .expect((res) => {
        expect(res.body[0].id).toBe(PRODUCT_ID);
        expect(res.body[0].store_id).toBe(STORE_ID);
        expect(
          Object.keys(res.body[0]).filter((k) => k.startsWith('legacy_')),
        ).toEqual([]);
      });
  });

  // CRITICAL 1: SellerProducts.jsx always sends store_id as a string
  // (localStorage.getItem never gets parsed). Store ids are uuid v7 strings
  // post-migration, so this is now the DTO's native shape (no numeric
  // coercion involved).
  it('POST /api/products with an authenticated store and valid body (store_id as the frontend sends it) returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Café',
        price: 5,
        store_id: STORE_ID,
        province: 'La Habana',
        municipality: 'Playa',
      })
      .expect(201);
  });

  it('POST /api/products with a non-uuid string store_id still returns 400', () => {
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
      .send({ price: 5, store_id: STORE_ID })
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
      .put(`/api/products/${PRODUCT_ID}`)
      .send({ is_featured: true })
      .expect(200)
      .expect(() => {
        expect(prismaMock.product.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: PRODUCT_ID },
            data: expect.objectContaining({ is_featured: true }),
          }),
        );
      });
  });
});
