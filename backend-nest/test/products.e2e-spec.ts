import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SellerAuthGuard } from '../src/auth/seller-auth.guard';

// Auth is not what's under test here (Task 13's stores.e2e-spec.ts is the
// spec that drives the real SellerAuthGuard/SellerAuthStrategy chain end to
// end). This spec stubs SellerAuthGuard purely for convenience so it can
// focus on the public/validation/guarded-route wiring pattern for the
// products routes without re-deriving Supabase/Prisma auth fixtures.
describe('Products (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        product: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 1, store_id: 1 }),
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

  it('GET /api/products is public and returns an array', () => {
    return request(app.getHttpServer())
      .get('/api/products')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('POST /api/products with an authenticated store and valid body returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Café',
        price: 5,
        store_id: 1,
        province: 'La Habana',
        municipality: 'Playa',
      })
      .expect(201);
  });

  it('POST /api/products with a missing required field returns 400', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({ price: 5, store_id: 1 })
      .expect(400);
  });
});
