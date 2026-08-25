import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// Detector de guards ausentes.
//
// Al quitar @UseGuards(AdminGuard) de las siete rutas administrativas, las
// dos suites seguían en verde salvo tres asserciones de users.e2e-spec.ts:
// seis de las siete rutas podían perder su guard sin que nada se pusiera
// rojo. GET :id/stats era peor todavía — un guard que ESTA rama añadió y que
// no tenía ninguna prueba.
//
// Una assertion por ruta, la más barata que detecta la ausencia del guard:
// SIN credencial, 401. Sin guard la petición llega al controlador y responde
// otra cosa (400 por validación, 200, o 500 contra los dobles), nunca 401.
// La tabla es la misma que la de backend/smoke_admin_auth.mjs; mantener las
// dos en sintonía.
//
// Sólo se sustituyen los bordes externos (PrismaService y el cliente de
// SupabaseService): GuardsModule, los guards y el cableado de los módulos son
// reales, así que un decorador o un import que faltase se ve aquí.
describe('Admin/seller route guards (e2e) — cada ruta protegida rechaza sin credencial', () => {
  let app: INestApplication;

  const ID = '11111111-1111-1111-1111-111111111111';

  // [método, ruta, guard que la protege] — el tercer campo es sólo
  // documentación: identifica qué se rompe si el caso se pone rojo.
  const GUARDED_ROUTES: Array<[string, string, string]> = [
    ['get', '/api/users', 'AdminGuard'],
    ['delete', `/api/users/${ID}`, 'AdminGuard'],
    ['put', `/api/users/${ID}`, 'AdminGuard'],
    ['post', '/api/settings', 'AdminGuard'],
    ['get', `/api/stores/${ID}/admin-details`, 'AdminGuard'],
    ['put', `/api/stores/${ID}/status`, 'AdminGuard'],
    ['put', `/api/stores/${ID}/zelle`, 'AdminGuard'],
    ['get', `/api/stores/${ID}/stats`, 'SellerAuthGuard + StoreOwnershipGuard'],
  ];

  beforeEach(async () => {
    // Dobles deliberadamente generosos: si un guard faltase, la petición
    // llegaría al servicio y RESPONDERÍA algo distinto de 401 en vez de
    // estrellarse por un doble incompleto. Es lo que hace que el caso
    // distinga "hay guard" de "no hay guard" y no "hay stub" de "no hay
    // stub".
    const prismaDouble = {
      store: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: ID }),
      },
      order: { findMany: jest.fn().mockResolvedValue([]) },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      setting: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ key: 'k', value: 'v' }),
      },
    };

    const supabaseDouble = {
      client: {
        auth: {
          // Ninguna de estas peticiones lleva credencial, así que un guard
          // presente rechaza ANTES de llegar aquí.
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'invalid token' },
          }),
          admin: {
            listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
            getUserById: jest.fn().mockResolvedValue({
              data: { user: { id: ID, app_metadata: {} } },
              error: null,
            }),
            deleteUser: jest.fn().mockResolvedValue({ error: null }),
            updateUserById: jest.fn().mockResolvedValue({
              data: { user: { id: ID } },
              error: null,
            }),
          },
        },
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaDouble)
      .overrideProvider(SupabaseService)
      .useValue(supabaseDouble)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(GUARDED_ROUTES)(
    '%s %s sin Authorization responde 401 (guard: %s)',
    async (method, path) => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const res = await (request(server) as any)[method](path).send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token no proporcionado');
    },
  );
});
