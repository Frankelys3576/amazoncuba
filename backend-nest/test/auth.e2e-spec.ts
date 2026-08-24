import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        platformSetting: { findUnique: jest.fn().mockResolvedValue(null) },
        store: { create: jest.fn().mockResolvedValue({}) },
      })
      .overrideProvider(SupabaseService)
      .useValue({
        client: {
          auth: {
            admin: {
              createUser: jest.fn().mockResolvedValue({
                data: { user: { id: 'u1', email: '5551234@cubaamazon.com' } },
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

  it('POST /api/auth/register with a valid body returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        full_name: 'Juan Pérez',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toBe(
          'Usuario y tienda registrados exitosamente',
        );
      });
  });

  it('POST /api/auth/register without a password returns 400 with the Spanish error envelope', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: '5551234@cubaamazon.com', full_name: 'Juan Pérez' })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBeDefined();
      });
  });

  it('POST /api/auth/delete without a bearer token returns 401', () => {
    return request(app.getHttpServer()).post('/api/auth/delete').expect(401);
  });
});
