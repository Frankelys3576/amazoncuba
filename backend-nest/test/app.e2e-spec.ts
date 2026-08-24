import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Overriding with a plain object literal (not the real PrismaService
    // class) means Nest's DI never invokes the real class's
    // onModuleInit lifecycle hook, so $connect() is never called against a
    // live Postgres connection. GET /api/health doesn't touch Prisma at
    // all, but PrismaModule is wired into AppModule, so without this
    // override module bootstrapping alone would attempt a real DB
    // connection and fail when DATABASE_URL isn't set (see stores/auth/
    // products e2e specs for the same pattern).
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  it('/api/health (GET) returns status OK', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('OK');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
