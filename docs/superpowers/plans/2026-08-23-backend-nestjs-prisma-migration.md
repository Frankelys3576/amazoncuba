# Backend NestJS + Prisma Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `backend-nest/`, a NestJS + Prisma replacement for the Express backend, deployed as its own Vercel project, running alongside the existing `backend/` until each frontend migrates over.

**Architecture:** One Nest module per existing Express resource (Products, Auth, Orders, Stores, Users, Categories, Settings, Upload), each with Controller + Service + DTOs. A global `PrismaModule` provides DB access; Supabase Auth/Storage stay reachable via a `SupabaseModule` wrapping `@supabase/supabase-js`. A Passport bearer strategy + guards replace the old `authenticateSeller`/`requireStoreOwnership` Express middleware.

**Tech Stack:** NestJS (latest stable, via `@nestjs/cli`), TypeScript, Prisma + `@prisma/client` (latest), `@supabase/supabase-js` (same major as `backend/`'s `^2.110.0`), `class-validator`/`class-transformer`, Jest + Supertest (Nest defaults), `@nestjs/platform-express` for file upload (Multer under the hood).

**Spec:** `docs/superpowers/specs/2026-08-23-backend-nestjs-prisma-migration-design.md`

## Global Constraints

- New app lives at `backend-nest/` at the repo root, alongside `backend/` — do not modify or delete anything under `backend/`.
- Deploys as its own Vercel project; no frontend changes in this plan.
- Supabase is unchanged: same Postgres DB, same Auth tenant, same Storage buckets (`store-images`). Connect using the same elevated (service-role) trust level `backend/` uses today — this migration does not add a Postgres-level authz layer.
- All user-facing and API error strings are in Spanish, matching the rest of the repo.
- No test database. Unit tests mock `PrismaService`; e2e tests use Nest's `TestingModule` with mocked providers (no live Supabase/Postgres calls in tests).
- Package manager: npm.
- Every module's every existing capability from `backend/` must have a Nest equivalent — no dropped functionality (see spec's "API redesign scope" for what may change: response shape consistency, DTO validation, and the global error envelope only).

---

## Task 1: Scaffold the NestJS app

**Files:**
- Create: `backend-nest/` (via Nest CLI — `package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `.env.example`)
- Create: `backend-nest/src/app.controller.ts`, `backend-nest/src/app.controller.spec.ts`
- Create: `backend-nest/src/common/filters/http-exception.filter.ts`
- Create: `backend-nest/.gitignore`
- Test: `backend-nest/src/app.controller.spec.ts`, `backend-nest/test/app.e2e-spec.ts`

**Interfaces:**
- Produces: `AppController.getRoot()` returns `{ message: string }`; `AppController.getHealth()` returns `{ status: 'OK', timestamp: string }`. `HttpExceptionFilter` (global) — catches any thrown exception and responds `{ error: string }` with the exception's HTTP status (or 500 for unknown errors). Later tasks' controllers rely on this filter for their error shape; they don't need to catch-and-format errors themselves for unexpected failures.

- [ ] **Step 1: Scaffold the project**

Run from the repo root:
```bash
npx @nestjs/cli@latest new backend-nest --package-manager npm --skip-git
```
This creates `backend-nest/` with a working Nest app, Jest configured, and a default `AppController`/`AppService`.

- [ ] **Step 2: Replace the default root/health endpoints with the real ones**

Edit `backend-nest/src/app.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot(): { message: string } {
    return { message: 'Bienvenido al backend de la Tienda Virtual Cuba (NestJS)' };
  }

  @Get('api/health')
  getHealth(): { status: string; timestamp: string } {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }
}
```
Delete `backend-nest/src/app.service.ts` and remove the `AppService` provider/import from `backend-nest/src/app.module.ts` (not used).

- [ ] **Step 3: Write the failing controller test**

Replace `backend-nest/src/app.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('getRoot returns the welcome message', () => {
    expect(controller.getRoot()).toEqual({
      message: 'Bienvenido al backend de la Tienda Virtual Cuba (NestJS)',
    });
  });

  it('getHealth returns status OK with an ISO timestamp', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('OK');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
```

- [ ] **Step 4: Run the test, confirm it passes** (it should already pass since Step 2 preceded it — run it anyway to lock in a baseline)

Run: `cd backend-nest && npm test -- app.controller.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add the global exception filter**

Create `backend-nest/src/common/filters/http-exception.filter.ts`:
```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      response.status(status).json({
        error: Array.isArray(message) ? message.join(', ') : message,
      });
      return;
    }

    console.error('Unhandled exception:', exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Error interno del servidor' });
  }
}
```

- [ ] **Step 6: Wire the filter, CORS, and global ValidationPipe into `main.ts`**

Replace `backend-nest/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = process.env.PORT || 5001;
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    await app.listen(port);
    console.log(`🚀 Servidor backend-nest corriendo en el puerto ${port}`);
  }
}
bootstrap();

export default async function handler(req: any, res: any) {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}
```

- [ ] **Step 7: Write the failing e2e test**

Replace `backend-nest/test/app.e2e-spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
```

- [ ] **Step 8: Run the e2e test**

Run: `cd backend-nest && npm run test:e2e`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd backend-nest && git add -A && git -C .. commit -m "scaffold backend-nest NestJS app with health endpoint and global error filter"
```

---

## Task 2: Prisma schema and `PrismaService`

**Files:**
- Create: `backend-nest/prisma/schema.prisma`
- Create: `backend-nest/src/prisma/prisma.module.ts`
- Create: `backend-nest/src/prisma/prisma.service.ts`
- Test: `backend-nest/src/prisma/prisma.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts` (import `PrismaModule`)
- Modify: `backend-nest/.env.example` (add `DATABASE_URL`)

**Interfaces:**
- Consumes: `DATABASE_URL` env var (Supabase Postgres connection string — the direct DB connection, not the Supabase REST/JS client).
- Produces: `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy` — injectable anywhere via Nest DI once `PrismaModule` (marked `@Global()`) is imported once in `AppModule`. Every later module's service takes `private readonly prisma: PrismaService` in its constructor and calls `this.prisma.<model>.<method>(...)`.

- [ ] **Step 1: Install Prisma**

```bash
cd backend-nest && npm install prisma @prisma/client
npx prisma init
```

- [ ] **Step 2: Point Prisma at the live Supabase DB and pull the schema**

Set `DATABASE_URL` in `backend-nest/.env` to the same Postgres connection string used to reach the Supabase project's DB (found in the Supabase dashboard's Database settings — this is the direct Postgres connection, distinct from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` which are the REST/JS-client credentials). Add `DATABASE_URL="postgresql://..."` (placeholder shape only) to `backend-nest/.env.example`.

Run:
```bash
npx prisma db pull
```
This overwrites `backend-nest/prisma/schema.prisma` with models introspected from the real tables.

- [ ] **Step 3: Reconcile the introspected schema against known field usage**

`prisma db pull` will name each model after its table (e.g. `model stores { ... }`) and keep every column exactly as it exists in Postgres (snake_case). Rename each model to PascalCase-singular with an explicit `@@map` so Prisma Client reads naturally in TypeScript, e.g.:
```prisma
model Store {
  id            Int      @id @default(autoincrement())
  // ...introspected columns stay snake_case as fields...
  store_type    String?
  zelle_info    Json?
  @@map("stores")
}
```
Do this for every model. Do **not** rename individual columns (`@map`) — keep field names identical to the introspected snake_case so the generated types match the DB 1:1 and later tasks' code (written against these exact field names) is correct.

Cross-check the introspected schema has all of the following, since these are the fields the existing controllers actually read/write (add any Prisma missed, e.g. because a column allows NULL and had no non-null sample rows — introspection can occasionally miss nullable JSON/array columns):
- `Store`: `id, name, slug, description, status, store_type, phone, store_number, zelle_info (Json), accepts_zelle, has_delivery, is_open, opening_time, closing_time, logo_url, banner_url, slogan, province, municipality, address, lat, lng, price_per_night, created_at`
- `Product`: `id, name, description, price, price_usd, currency, stock, category_id, store_category_id, image_url, image_url_2, image_url_3, image_url_4, image_url_5, store_id, province, municipality, delivery_locations (String[]), is_featured, created_at`, plus relation fields to `Store` (`store_id`) — introspection should add a `store Store @relation(fields: [store_id], references: [id])` and a matching back-relation on `Store`.
- `Order`: `id, customer_name, customer_email, customer_address, customer_phone, total, status, payment_method, payment_proof_url, created_at`, relation to `OrderItem[]`.
- `OrderItem`: `id, order_id, product_id, quantity, price_at_purchase`, relations to `Order` and `Product`.
- `ProductView`: `id, product_id, created_at`, relation to `Product`.
- `ProductReview`: `id, product_id, customer_name, rating, comment, created_at`, relation to `Product`.
- `Category`: `id, name` (plus whatever else introspection finds).
- `StoreCategory`: `id, store_id, name, image_url, created_at`, relation to `Store`.
- `PlatformSetting`: `key (@id), value, updated_at`, mapped `@@map("platform_settings")`.

Do **not** add a `User`/`auth.users` model — Supabase manages that schema, and this migration keeps talking to it through the Supabase Admin API (see Task 3), not Prisma.

- [ ] **Step 4: Generate the Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Write `PrismaService`**

Create `backend-nest/src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 6: Write `PrismaModule`**

Create `backend-nest/src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Import `PrismaModule` into `backend-nest/src/app.module.ts`'s `imports` array.

- [ ] **Step 7: Write the failing unit test**

Create `backend-nest/src/prisma/prisma.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('is defined and exposes the introspected models', () => {
    expect(service).toBeDefined();
    expect(typeof service.store.findMany).toBe('function');
    expect(typeof service.product.findMany).toBe('function');
  });
});
```

- [ ] **Step 8: Run the test**

Run: `cd backend-nest && npm test -- prisma.service.spec.ts`
Expected: PASS. (This only checks the client shape, no live DB connection is made in this test.)

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "add Prisma schema (introspected from Supabase) and PrismaService"
```

---

## Task 3: `SupabaseModule` (Auth admin + Storage access)

**Files:**
- Create: `backend-nest/src/supabase/supabase.module.ts`
- Create: `backend-nest/src/supabase/supabase.service.ts`
- Test: `backend-nest/src/supabase/supabase.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts` (import `SupabaseModule`)
- Modify: `backend-nest/.env.example` (add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` env vars.
- Produces: `SupabaseService.client: SupabaseClient` — a Supabase JS client constructed with the service-role key (same trust level as `backend/src/config/supabase.js`). Later modules inject `SupabaseService` and call `supabaseService.client.auth.admin...` / `.auth.getUser(...)` / `.storage.from(...)`.

- [ ] **Step 1: Install the Supabase client**

```bash
cd backend-nest && npm install @supabase/supabase-js@^2.110.0
```

- [ ] **Step 2: Write `SupabaseService`**

Create `backend-nest/src/supabase/supabase.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL as string;
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY) as string;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Faltan credenciales de Supabase en el archivo .env');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }
}
```

- [ ] **Step 3: Write `SupabaseModule`**

Create `backend-nest/src/supabase/supabase.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

Import `SupabaseModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 4: Write the failing test**

Create `backend-nest/src/supabase/supabase.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('constructs a Supabase client exposing auth.admin and storage', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupabaseService],
    }).compile();

    const service = module.get<SupabaseService>(SupabaseService);
    expect(service.client.auth.admin).toBeDefined();
    expect(typeof service.client.storage.from).toBe('function');
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd backend-nest && npm test -- supabase.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "add SupabaseModule wrapping the Supabase Auth admin + Storage client"
```

---

## Task 4: Seller auth guard (Passport bearer strategy) and store-ownership guard

**Files:**
- Create: `backend-nest/src/auth/seller-auth.strategy.ts`
- Create: `backend-nest/src/auth/seller-auth.guard.ts`
- Create: `backend-nest/src/auth/store-ownership.guard.ts`
- Create: `backend-nest/src/auth/guards.module.ts`
- Create: `backend-nest/src/auth/request-with-store.interface.ts`
- Test: `backend-nest/src/auth/seller-auth.strategy.spec.ts`
- Test: `backend-nest/src/auth/store-ownership.guard.spec.ts`

**Interfaces:**
- Consumes: `SupabaseService` (Task 3), `PrismaService` (Task 2).
- Produces: `SellerAuthGuard` (a Nest `AuthGuard('bearer')`) — apply as `@UseGuards(SellerAuthGuard)` on any route needing a logged-in seller; populates `req.user` (Supabase `User`) and `req.store` (Prisma `Store`). `StoreOwnershipGuard` — apply alongside `SellerAuthGuard` on routes with a `:id` store-id param; 403s if `req.store.id !== Number(req.params.id)`. `RequestWithStore` type (`Request & { user: User; store: Store }`) — later controllers type their request param with this so `req.store`/`req.user` are typed, not `any`.

- [ ] **Step 1: Install Passport deps**

```bash
cd backend-nest && npm install @nestjs/passport passport passport-http-bearer
npm install -D @types/passport-http-bearer
```

- [ ] **Step 2: Define the shared request type**

Create `backend-nest/src/auth/request-with-store.interface.ts`:
```typescript
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { Store } from '@prisma/client';

export interface RequestWithStore extends Request {
  user: User;
  store: Store;
}
```

- [ ] **Step 3: Write the failing strategy test**

Create `backend-nest/src/auth/seller-auth.strategy.spec.ts`:
```typescript
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SellerAuthStrategy } from './seller-auth.strategy';

describe('SellerAuthStrategy', () => {
  const makeStrategy = (supabaseGetUser: any, prismaFindFirst: any) => {
    const supabaseService = {
      client: { auth: { getUser: supabaseGetUser } },
    } as any;
    const prismaService = { store: { findFirst: prismaFindFirst } } as any;
    return new SellerAuthStrategy(supabaseService, prismaService);
  };

  it('resolves { user, store } for a valid token whose email phone matches a store', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const store = { id: 7, phone: '5551234' };
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      jest.fn().mockResolvedValue(store),
    );

    const result = await strategy.validate('valid-token');
    expect(result).toEqual({ user, store });
  });

  it('throws UnauthorizedException for an invalid token', async () => {
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } }),
      jest.fn(),
    );

    await expect(strategy.validate('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when no store matches the user', async () => {
    const user = { id: 'u1', email: '5551234@cubaamazon.com' };
    const strategy = makeStrategy(
      jest.fn().mockResolvedValue({ data: { user }, error: null }),
      jest.fn().mockResolvedValue(null),
    );

    await expect(strategy.validate('valid-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 4: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- seller-auth.strategy.spec.ts`
Expected: FAIL (`Cannot find module './seller-auth.strategy'`).

- [ ] **Step 5: Implement the strategy**

Create `backend-nest/src/auth/seller-auth.strategy.ts`:
```typescript
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';

const extractPhoneFromEmail = (email: string): string =>
  email.split('@')[0].replace(/\+/g, '').replace(/\s/g, '');

@Injectable()
export class SellerAuthStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async validate(token: string) {
    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user || !user.email) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const phone = extractPhoneFromEmail(user.email);
    const store = await this.prisma.store.findFirst({
      where: { phone: { contains: phone } },
    });

    if (!store) {
      throw new ForbiddenException(
        'No se encontró una tienda asociada a este usuario',
      );
    }

    return { user, store };
  }
}
```

- [ ] **Step 6: Run the strategy test**

Run: `cd backend-nest && npm test -- seller-auth.strategy.spec.ts`
Expected: PASS.

- [ ] **Step 7: Write the guard, module, and store-ownership guard**

Create `backend-nest/src/auth/seller-auth.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SellerAuthGuard extends AuthGuard('bearer') {}
```

Create `backend-nest/src/auth/store-ownership.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestWithStore } from './request-with-store.interface';

@Injectable()
export class StoreOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithStore>();
    if (String(req.store.id) !== String(req.params.id)) {
      throw new ForbiddenException('No tienes permiso sobre esta tienda');
    }
    return true;
  }
}
```

Create `backend-nest/src/auth/guards.module.ts` (bundles the strategy/guards for reuse by feature modules):
```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SellerAuthStrategy } from './seller-auth.strategy';
import { SellerAuthGuard } from './seller-auth.guard';
import { StoreOwnershipGuard } from './store-ownership.guard';

@Module({
  imports: [PassportModule],
  providers: [SellerAuthStrategy, SellerAuthGuard, StoreOwnershipGuard],
  exports: [SellerAuthGuard, StoreOwnershipGuard],
})
export class GuardsModule {}
```

- [ ] **Step 8: Write the failing `StoreOwnershipGuard` test**

Create `backend-nest/src/auth/store-ownership.guard.spec.ts`:
```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { StoreOwnershipGuard } from './store-ownership.guard';

describe('StoreOwnershipGuard', () => {
  const guard = new StoreOwnershipGuard();

  const makeContext = (storeId: number, paramId: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ store: { id: storeId }, params: { id: paramId } }),
      }),
    }) as any;

  it('allows access when the store id matches the route param', () => {
    expect(guard.canActivate(makeContext(7, '7'))).toBe(true);
  });

  it('throws ForbiddenException when the store id does not match', () => {
    expect(() => guard.canActivate(makeContext(7, '9'))).toThrow(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 9: Run the test**

Run: `cd backend-nest && npm test -- store-ownership.guard.spec.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "add SellerAuthGuard/StoreOwnershipGuard replacing Express authenticateSeller middleware"
```

---

## Task 5: `CategoriesModule`

**Files:**
- Create: `backend-nest/src/categories/categories.module.ts`
- Create: `backend-nest/src/categories/categories.controller.ts`
- Create: `backend-nest/src/categories/categories.service.ts`
- Test: `backend-nest/src/categories/categories.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts` (import `CategoriesModule`)

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `GET /api/categories` → `Category[]`, ordered by `id` ascending — same as today.

- [ ] **Step 1: Write the failing service test**

Create `backend-nest/src/categories/categories.service.spec.ts`:
```typescript
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  it('returns all categories ordered by id ascending', async () => {
    const categories = [{ id: 1, name: 'Comida' }, { id: 2, name: 'Ropa' }];
    const prisma = {
      category: { findMany: jest.fn().mockResolvedValue(categories) },
    } as any;

    const service = new CategoriesService(prisma);
    const result = await service.findAll();

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
    expect(result).toEqual(categories);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- categories.service.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the service and controller**

Create `backend-nest/src/categories/categories.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { id: 'asc' } });
  }
}
```

Create `backend-nest/src/categories/categories.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }
}
```

Create `backend-nest/src/categories/categories.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

Import `CategoriesModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 4: Run the test**

Run: `cd backend-nest && npm test -- categories.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add CategoriesModule (GET /api/categories)"
```

---

## Task 6: `SettingsModule`

**Files:**
- Create: `backend-nest/src/settings/settings.module.ts`
- Create: `backend-nest/src/settings/settings.controller.ts`
- Create: `backend-nest/src/settings/settings.service.ts`
- Create: `backend-nest/src/settings/dto/update-setting.dto.ts`
- Test: `backend-nest/src/settings/settings.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `GET /api/settings` → `Record<string, string>` (key/value map, same shape as today). `POST /api/settings` with `UpdateSettingDto { key: string; value: string }` → `{ message: string; data: PlatformSetting[] }`.

- [ ] **Step 1: Write the failing service test**

Create `backend-nest/src/settings/settings.service.spec.ts`:
```typescript
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  it('findAll converts the settings rows into a key-value object', async () => {
    const rows = [
      { key: 'auto_approve_sellers', value: 'true' },
      { key: 'site_name', value: 'Tienda Cuba' },
    ];
    const prisma = { platformSetting: { findMany: jest.fn().mockResolvedValue(rows), update: jest.fn() } } as any;
    const service = new SettingsService(prisma);

    const result = await service.findAll();

    expect(result).toEqual({
      auto_approve_sellers: 'true',
      site_name: 'Tienda Cuba',
    });
  });

  it('update writes the new value and bumps updated_at', async () => {
    const updated = [{ key: 'site_name', value: 'Nueva Tienda', updated_at: new Date() }];
    const prisma = { platformSetting: { findMany: jest.fn(), update: jest.fn().mockResolvedValue(updated[0]) } } as any;
    const service = new SettingsService(prisma);

    await service.update({ key: 'site_name', value: 'Nueva Tienda' });

    expect(prisma.platformSetting.update).toHaveBeenCalledWith({
      where: { key: 'site_name' },
      data: { value: 'Nueva Tienda', updated_at: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- settings.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the DTO, service, controller, module**

Create `backend-nest/src/settings/dto/update-setting.dto.ts`:
```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  value: string;
}
```

Create `backend-nest/src/settings/settings.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany();
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value ?? '';
      return acc;
    }, {});
  }

  async update(dto: UpdateSettingDto) {
    const updated = await this.prisma.platformSetting.update({
      where: { key: dto.key },
      data: { value: dto.value, updated_at: new Date() },
    });
    return { message: 'Setting updated successfully', data: [updated] };
  }
}
```

Create `backend-nest/src/settings/settings.controller.ts`:
```typescript
import { Body, Controller, Get, Post } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Post()
  update(@Body() dto: UpdateSettingDto) {
    return this.settingsService.update(dto);
  }
}
```

Create `backend-nest/src/settings/settings.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
```

Import `SettingsModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 4: Run the test**

Run: `cd backend-nest && npm test -- settings.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add SettingsModule (GET/POST /api/settings)"
```

---

## Task 7: `UsersModule` (admin — talks to Supabase Auth, not Prisma)

**Files:**
- Create: `backend-nest/src/users/users.module.ts`
- Create: `backend-nest/src/users/users.controller.ts`
- Create: `backend-nest/src/users/users.service.ts`
- Create: `backend-nest/src/users/dto/update-user.dto.ts`
- Test: `backend-nest/src/users/users.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `SupabaseService`.
- Produces: `GET /api/users` → `{ id, email, full_name, created_at, last_sign_in_at, email_confirmed }[]`. `DELETE /api/users/:id` → `{ message: string }`. `PUT /api/users/:id` with `UpdateUserDto { email?: string; password?: string }` → `{ message: string; user: User }`.

- [ ] **Step 1: Write the failing service test**

Create `backend-nest/src/users/users.service.spec.ts`:
```typescript
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const makeSupabase = (overrides: any) => ({
    client: { auth: { admin: overrides } },
  }) as any;

  it('findAll maps Supabase auth users into the API shape', async () => {
    const supabase = makeSupabase({
      listUsers: jest.fn().mockResolvedValue({
        data: {
          users: [
            {
              id: 'u1',
              email: '5551234@cubaamazon.com',
              user_metadata: { full_name: 'Juan Pérez' },
              created_at: '2026-01-01T00:00:00Z',
              last_sign_in_at: '2026-02-01T00:00:00Z',
              email_confirmed_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
        error: null,
      }),
    });
    const service = new UsersService(supabase);

    const result = await service.findAll();

    expect(result).toEqual([
      {
        id: 'u1',
        email: '5551234@cubaamazon.com',
        full_name: 'Juan Pérez',
        created_at: '2026-01-01T00:00:00Z',
        last_sign_in_at: '2026-02-01T00:00:00Z',
        email_confirmed: true,
      },
    ]);
  });

  it('update throws BadRequestException when neither email nor password is provided', async () => {
    const supabase = makeSupabase({ updateUserById: jest.fn() });
    const service = new UsersService(supabase);

    await expect(service.update('u1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- users.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the DTO, service, controller, module**

Create `backend-nest/src/users/dto/update-user.dto.ts`:
```typescript
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
```

Create `backend-nest/src/users/users.service.ts`:
```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.supabaseService.client.auth.admin.listUsers();
    if (error) throw error;

    return data.users.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || 'Sin nombre',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed: !!user.email_confirmed_at,
    }));
  }

  async remove(id: string) {
    const { error } = await this.supabaseService.client.auth.admin.deleteUser(id);
    if (error) throw error;
    return { message: 'Usuario eliminado correctamente' };
  }

  async update(id: string, dto: UpdateUserDto) {
    if (!dto.email && !dto.password) {
      throw new BadRequestException(
        'Debe proporcionar un nuevo correo o contraseña.',
      );
    }

    const { data, error } = await this.supabaseService.client.auth.admin.updateUserById(
      id,
      dto,
    );
    if (error) throw error;

    return { message: 'Usuario actualizado correctamente', user: data.user };
  }
}
```

Create `backend-nest/src/users/users.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }
}
```

Create `backend-nest/src/users/users.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

Import `UsersModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 4: Run the test**

Run: `cd backend-nest && npm test -- users.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add UsersModule (admin user management via Supabase Auth admin API)"
```

---

## Task 8: `UploadModule`

**Files:**
- Create: `backend-nest/src/upload/upload.module.ts`
- Create: `backend-nest/src/upload/upload.controller.ts`
- Create: `backend-nest/src/upload/upload.service.ts`
- Test: `backend-nest/src/upload/upload.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `SupabaseService`.
- Produces: `POST /api/upload` (multipart, field name `image`, PNG/JPG only, 5MB limit) → `{ url: string; message: string }`.

- [ ] **Step 1: Install multer types**

```bash
cd backend-nest && npm install -D @types/multer
```

- [ ] **Step 2: Write the failing service test**

Create `backend-nest/src/upload/upload.service.spec.ts`:
```typescript
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  const makeSupabase = (uploadResult: any, publicUrl: string) => ({
    client: {
      storage: {
        from: () => ({
          upload: jest.fn().mockResolvedValue(uploadResult),
          getPublicUrl: () => ({ data: { publicUrl } }),
        }),
      },
    },
  }) as any;

  it('uploads the file buffer and returns the public URL', async () => {
    const supabase = makeSupabase({ data: {}, error: null }, 'https://cdn.example/store-images/x.png');
    const service = new UploadService(supabase);

    const result = await service.uploadImage({
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('fake'),
    } as Express.Multer.File);

    expect(result).toEqual({
      url: 'https://cdn.example/store-images/x.png',
      message: 'Imagen subida correctamente',
    });
  });

  it('throws BadRequestException when no file is provided', async () => {
    const service = new UploadService(makeSupabase({}, ''));
    await expect(service.uploadImage(undefined as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- upload.service.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the service, controller, module**

Create `backend-nest/src/upload/upload.service.ts`:
```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'path';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UploadService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No se subió ninguna imagen o formato inválido',
      );
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `${uniqueSuffix}${extname(file.originalname)}`;

    const { error } = await this.supabaseService.client.storage
      .from('store-images')
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException('Error al subir imagen al servidor cloud');
    }

    const {
      data: { publicUrl },
    } = this.supabaseService.client.storage.from('store-images').getPublicUrl(filename);

    return { url: publicUrl, message: 'Imagen subida correctamente' };
  }
}
```

Create `backend-nest/src/upload/upload.controller.ts`:
```typescript
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('api/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes en formato PNG o JPG',
            ),
            false,
          );
        }
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file);
  }
}
```

Create `backend-nest/src/upload/upload.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
```

Import `UploadModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 5: Run the test**

Run: `cd backend-nest && npm test -- upload.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "add UploadModule (POST /api/upload -> Supabase Storage)"
```

---

## Task 9: `AuthModule` (register, login, delete account)

**Files:**
- Create: `backend-nest/src/auth/auth.module.ts`
- Create: `backend-nest/src/auth/auth.controller.ts`
- Create: `backend-nest/src/auth/auth.service.ts`
- Create: `backend-nest/src/auth/dto/register.dto.ts`
- Create: `backend-nest/src/auth/dto/login.dto.ts`
- Create: `backend-nest/src/auth/slug.util.ts`
- Test: `backend-nest/src/auth/auth.service.spec.ts`
- Test: `backend-nest/src/auth/slug.util.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `SupabaseService`, `PrismaService`, `GuardsModule` (for `SellerAuthGuard` on the delete route).
- Produces: `POST /api/auth/register` with `RegisterDto` → `{ message, user, autoApproved }` (201). `POST /api/auth/login` with `LoginDto { email, password }` → `{ message, session, user, store }`. `POST /api/auth/delete` (guarded) → `{ message }`. `generateSlug(text: string): string` — reused by `StoresModule` in Task 10.

- [ ] **Step 1: Write the failing slug util test**

Create `backend-nest/src/auth/slug.util.spec.ts`:
```typescript
import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('lowercases, strips accents, and hyphenates', () => {
    expect(generateSlug('Café Cubano #1')).toBe('cafe-cubano-1');
  });

  it('returns an empty string for falsy input', () => {
    expect(generateSlug('')).toBe('');
    expect(generateSlug(undefined as any)).toBe('');
  });
});
```

- [ ] **Step 2: Run it, confirm it fails, then implement**

Run: `cd backend-nest && npm test -- slug.util.spec.ts` → FAIL.

Create `backend-nest/src/auth/slug.util.ts`:
```typescript
export const generateSlug = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
```

Run again: PASS.

- [ ] **Step 3: Write the DTOs**

Create `backend-nest/src/auth/dto/register.dto.ts`:
```typescript
import { IsEmail, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsOptional()
  @IsString()
  store_name?: string;

  @IsOptional()
  @IsIn(['business', 'hostal'])
  store_type?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  lat?: number;

  @IsOptional()
  lng?: number;

  @IsOptional()
  price_per_night?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
```

Create `backend-nest/src/auth/dto/login.dto.ts`:
```typescript
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
```

- [ ] **Step 4: Write the failing service test**

Create `backend-nest/src/auth/auth.service.spec.ts`:
```typescript
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const makeService = ({
    createUser,
    settingsFindUnique,
    storeCreate,
    signIn,
    storeFindFirst,
  }: any) => {
    const supabase = {
      client: {
        auth: {
          admin: { createUser },
          signInWithPassword: signIn,
        },
      },
    } as any;
    const prisma = {
      platformSetting: { findUnique: settingsFindUnique },
      store: { create: storeCreate, findFirst: storeFindFirst },
    } as any;
    return new AuthService(supabase, prisma);
  };

  describe('register', () => {
    it('creates the Supabase user and an accompanying pending store when store_name is given', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const createUser = jest.fn().mockResolvedValue({ data: { user }, error: null });
      const settingsFindUnique = jest.fn().mockResolvedValue({ key: 'auto_approve_sellers', value: 'false' });
      const storeCreate = jest.fn().mockResolvedValue({});
      const service = makeService({ createUser, settingsFindUnique, storeCreate });

      const result = await service.register({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        full_name: 'Juan Pérez',
        store_name: 'Cafetería Juan',
        store_type: 'business',
      } as any);

      expect(createUser).toHaveBeenCalledWith({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        email_confirm: true,
        user_metadata: { full_name: 'Juan Pérez' },
      });
      expect(storeCreate).toHaveBeenCalledTimes(1);
      const createArgs = storeCreate.mock.calls[0][0];
      expect(createArgs.data.name).toBe('Cafetería Juan');
      expect(createArgs.data.slug).toBe('cafeteria-juan');
      expect(createArgs.data.status).toBe('pending');
      expect(result).toEqual({
        message: 'Usuario y tienda registrados exitosamente',
        user,
        autoApproved: false,
      });
    });

    it('marks the store approved when auto_approve_sellers is "true"', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const createUser = jest.fn().mockResolvedValue({ data: { user }, error: null });
      const settingsFindUnique = jest.fn().mockResolvedValue({ key: 'auto_approve_sellers', value: 'true' });
      const storeCreate = jest.fn().mockResolvedValue({});
      const service = makeService({ createUser, settingsFindUnique, storeCreate });

      const result = await service.register({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
        full_name: 'Juan Pérez',
        store_name: 'Cafetería Juan',
      } as any);

      expect(storeCreate.mock.calls[0][0].data.status).toBe('approved');
      expect(result.autoApproved).toBe(true);
    });
  });

  describe('login', () => {
    it('returns the session, user, and matching store', async () => {
      const user = { id: 'u1', email: '5551234@cubaamazon.com' };
      const session = { access_token: 'tok' };
      const store = { id: 7, phone: '5551234' };
      const signIn = jest.fn().mockResolvedValue({ data: { user, session }, error: null });
      const storeFindFirst = jest.fn().mockResolvedValue(store);
      const service = makeService({ signIn, storeFindFirst });

      const result = await service.login({
        email: '5551234@cubaamazon.com',
        password: 'secret123',
      });

      expect(result).toEqual({
        message: 'Login exitoso',
        session,
        user,
        store,
      });
    });
  });
});
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- auth.service.spec.ts`
Expected: FAIL.

- [ ] **Step 6: Implement `AuthService`**

Create `backend-nest/src/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { generateSlug } from './slug.util';

const extractPhoneFromEmail = (email: string): string =>
  email.split('@')[0].replace(/\+/g, '').replace(/\s/g, '');

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const { data, error } = await this.supabaseService.client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: { full_name: dto.full_name },
    });
    if (error) throw error;

    const autoApproveSetting = await this.prisma.platformSetting.findUnique({
      where: { key: 'auto_approve_sellers' },
    });
    const isAutoApprove = autoApproveSetting?.value === 'true';

    if (dto.store_name) {
      const phoneMatch = extractPhoneFromEmail(dto.email);
      const finalPhone = dto.phone ? dto.phone.replace(/[^0-9]/g, '') : phoneMatch;
      const storeNumber = Math.floor(100000 + Math.random() * 900000).toString();
      const slug = generateSlug(dto.store_name);

      const zelleInfo = {
        province: dto.province || null,
        municipality: dto.municipality || null,
        address: dto.address || null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        price_per_night: dto.price_per_night ?? null,
      };

      await this.prisma.store.create({
        data: {
          name: dto.store_name,
          slug,
          description:
            dto.description ||
            (dto.store_type === 'hostal'
              ? `Hostal de ${dto.full_name}`
              : `Nueva tienda de ${dto.full_name}`),
          status: isAutoApprove ? 'approved' : 'pending',
          store_type: dto.store_type || 'business',
          phone: finalPhone,
          store_number: storeNumber,
          zelle_info: zelleInfo,
          ...(dto.store_type === 'hostal'
            ? {
                province: dto.province || null,
                municipality: dto.municipality || null,
                address: dto.address || null,
                lat: dto.lat ?? null,
                lng: dto.lng ?? null,
                price_per_night: dto.price_per_night ?? null,
              }
            : {}),
        },
      });
    }

    return {
      message: 'Usuario y tienda registrados exitosamente',
      user: data.user,
      autoApproved: isAutoApprove,
    };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error) throw new UnauthorizedException('Credenciales inválidas');

    const phone = extractPhoneFromEmail(dto.email);
    const store = await this.prisma.store.findFirst({
      where: { phone: { contains: phone } },
    });

    return {
      message: 'Login exitoso',
      session: data.session,
      user: data.user,
      store,
    };
  }

  async deleteAccount(storeId: number) {
    const products = await this.prisma.product.findMany({
      where: { store_id: storeId },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);

    if (productIds.length > 0) {
      await this.prisma.orderItem.deleteMany({
        where: { product_id: { in: productIds } },
      });
      await this.prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }

    await this.prisma.store.delete({ where: { id: storeId } });

    return { message: 'Cuenta eliminada exitosamente' };
  }
}
```

- [ ] **Step 7: Run the test**

Run: `cd backend-nest && npm test -- auth.service.spec.ts`
Expected: PASS.

- [ ] **Step 8: Write the controller and module**

Create `backend-nest/src/auth/auth.controller.ts`:
```typescript
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SellerAuthGuard } from './seller-auth.guard';
import { RequestWithStore } from './request-with-store.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('delete')
  @UseGuards(SellerAuthGuard)
  deleteAccount(@Req() req: RequestWithStore) {
    return this.authService.deleteAccount(req.store.id);
  }
}
```

Create `backend-nest/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GuardsModule } from './guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

Import `AuthModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "add AuthModule (register, login, delete account)"
```

---

## Task 10: `StoresModule` (stores + store-categories sub-resource)

**Files:**
- Create: `backend-nest/src/stores/stores.module.ts`
- Create: `backend-nest/src/stores/stores.controller.ts`
- Create: `backend-nest/src/stores/stores.service.ts`
- Create: `backend-nest/src/stores/store-format.util.ts`
- Create: `backend-nest/src/stores/dto/update-store-status.dto.ts`
- Create: `backend-nest/src/stores/dto/update-store-profile.dto.ts`
- Create: `backend-nest/src/stores/dto/update-zelle-info.dto.ts`
- Create: `backend-nest/src/stores/dto/update-store-credentials.dto.ts`
- Create: `backend-nest/src/stores/store-categories.controller.ts`
- Create: `backend-nest/src/stores/store-categories.service.ts`
- Create: `backend-nest/src/stores/dto/store-category.dto.ts`
- Test: `backend-nest/src/stores/store-format.util.spec.ts`
- Test: `backend-nest/src/stores/stores.service.spec.ts`
- Test: `backend-nest/src/stores/store-categories.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `SupabaseService` (for `updateStoreCredentials`'s Auth admin call), `GuardsModule`.
- Produces: `GET /api/stores` (query `type`, `province`, `municipality`, `q`), `GET /api/stores/:id` (numeric id or slug), `GET /api/stores/:id/admin-details`, `PUT /api/stores/:id/status`, `PUT /api/stores/:id/zelle`, `PUT /api/stores/:id/credentials` (guarded), `PUT /api/stores/:id` (guarded), `GET /api/stores/:id/stats`, `GET/POST/PUT/DELETE /api/stores/:id/categories[/:categoryId]` (mutations guarded). `formatStore(store): Store & { province, municipality, address, lat, lng, price_per_night, gallery }` util, reused wherever a store is returned.

- [ ] **Step 1: Write the failing `formatStore` test**

Create `backend-nest/src/stores/store-format.util.spec.ts`:
```typescript
import { formatStore } from './store-format.util';

describe('formatStore', () => {
  it('falls back to zelle_info fields when the direct columns are empty', () => {
    const store = {
      id: 1,
      province: null,
      municipality: null,
      address: null,
      lat: null,
      lng: null,
      price_per_night: null,
      zelle_info: {
        province: 'La Habana',
        municipality: 'Playa',
        address: 'Calle 1',
        lat: 23.1,
        lng: -82.4,
        price_per_night: 40,
        gallery: ['a.png'],
      },
    };

    expect(formatStore(store as any)).toMatchObject({
      province: 'La Habana',
      municipality: 'Playa',
      address: 'Calle 1',
      lat: 23.1,
      lng: -82.4,
      price_per_night: 40,
      gallery: ['a.png'],
    });
  });

  it('prefers direct columns over zelle_info when both are set', () => {
    const store = {
      id: 1,
      province: 'Matanzas',
      municipality: null,
      address: null,
      lat: null,
      lng: null,
      price_per_night: null,
      zelle_info: { province: 'La Habana' },
    };

    expect(formatStore(store as any).province).toBe('Matanzas');
  });

  it('returns falsy input unchanged', () => {
    expect(formatStore(null as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails, then implement**

Run: `cd backend-nest && npm test -- store-format.util.spec.ts` → FAIL.

Create `backend-nest/src/stores/store-format.util.ts`:
```typescript
import { Store } from '@prisma/client';

type ZelleInfo = {
  province?: string | null;
  municipality?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  price_per_night?: number | null;
  gallery?: string[];
};

export const formatStore = (store: Store | null) => {
  if (!store) return store;
  const info = (store.zelle_info as ZelleInfo) || {};
  return {
    ...store,
    province: store.province || info.province || '',
    municipality: store.municipality || info.municipality || '',
    address: store.address || info.address || '',
    lat: store.lat ?? info.lat ?? null,
    lng: store.lng ?? info.lng ?? null,
    price_per_night: store.price_per_night || info.price_per_night || null,
    gallery: info.gallery || [],
  };
};
```

Run again: PASS.

- [ ] **Step 3: Write the DTOs**

Create `backend-nest/src/stores/dto/update-store-status.dto.ts`:
```typescript
import { IsIn } from 'class-validator';

export class UpdateStoreStatusDto {
  @IsIn(['pending', 'approved', 'rejected'])
  status: string;
}
```

Create `backend-nest/src/stores/dto/update-zelle-info.dto.ts`:
```typescript
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateZelleInfoDto {
  @IsOptional()
  @IsBoolean()
  accepts_zelle?: boolean;

  @IsOptional()
  @IsObject()
  zelle_info?: Record<string, unknown>;
}
```

Create `backend-nest/src/stores/dto/update-store-profile.dto.ts`:
```typescript
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateStoreProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() slogan?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() logo_url?: string;
  @IsOptional() @IsString() banner_url?: string;
  @IsOptional() @IsBoolean() is_open?: boolean;
  @IsOptional() @IsBoolean() has_delivery?: boolean;
  @IsOptional() @IsString() opening_time?: string;
  @IsOptional() @IsString() closing_time?: string;
  @IsOptional() @IsIn(['business', 'hostal']) store_type?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() lat?: number;
  @IsOptional() lng?: number;
  @IsOptional() price_per_night?: number;
  @IsOptional() gallery?: string[];
}
```

Create `backend-nest/src/stores/dto/update-store-credentials.dto.ts`:
```typescript
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateStoreCredentialsDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
```

Create `backend-nest/src/stores/dto/store-category.dto.ts`:
```typescript
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStoreCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  image_url?: string;
}

export class UpdateStoreCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() image_url?: string;
}
```

- [ ] **Step 4: Write the failing `StoresService` test (covering the trickiest behaviors: id-vs-slug lookup and credentials update)**

Create `backend-nest/src/stores/stores.service.spec.ts`:
```typescript
import { NotFoundException } from '@nestjs/common';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  const makePrisma = (overrides: any) => ({
    store: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), ...overrides },
  }) as any;

  describe('findOne', () => {
    it('looks up by numeric id when the param is numeric', async () => {
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue({ id: 5, zelle_info: {} }),
      });
      const service = new StoresService(prisma, {} as any);

      await service.findOne('5');

      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('looks up by slug when the param is not numeric', async () => {
      const prisma = makePrisma({
        findFirst: jest.fn().mockResolvedValue({ id: 5, slug: 'cafeteria-juan', zelle_info: {} }),
      });
      const service = new StoresService(prisma, {} as any);

      await service.findOne('cafeteria-juan');

      expect(prisma.store.findFirst).toHaveBeenCalledWith({
        where: { slug: 'cafeteria-juan' },
      });
    });

    it('throws NotFoundException when nothing matches', async () => {
      const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
      const service = new StoresService(prisma, {} as any);

      await expect(service.findOne('999')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateCredentials', () => {
    it('updates the Supabase Auth email/password and mirrors the phone onto the store', async () => {
      const updateUserById = jest.fn().mockResolvedValue({ error: null });
      const supabase = { client: { auth: { admin: { updateUserById } } } } as any;
      const update = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ update });
      const service = new StoresService(prisma, supabase);

      const result = await service.updateCredentials(
        7,
        { user: { id: 'u1' }, store: { id: 7, phone: '5551234' } } as any,
        { phone: '+53 5559999', password: 'newpass1' },
      );

      expect(updateUserById).toHaveBeenCalledWith('u1', {
        email: '5559999@cubaamazon.com',
        password: 'newpass1',
      });
      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { phone: '5559999' },
      });
      expect(result).toEqual({
        message: 'Credenciales actualizadas exitosamente',
        phone: '5559999',
      });
    });
  });
});
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- stores.service.spec.ts`
Expected: FAIL.

- [ ] **Step 6: Implement `StoresService`**

Create `backend-nest/src/stores/stores.service.ts`:
```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { formatStore } from './store-format.util';
import { generateSlug } from '../auth/slug.util';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { UpdateStoreCredentialsDto } from './dto/update-store-credentials.dto';
import { RequestWithStore } from '../auth/request-with-store.interface';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async findAll(query: { type?: string; province?: string; municipality?: string; q?: string }) {
    const stores = await this.prisma.store.findMany({
      where: query.type ? { store_type: query.type } : undefined,
    });
    let formatted = stores.map(formatStore);

    if (query.province) {
      const p = query.province.toLowerCase();
      formatted = formatted.filter((s) => s.province?.toLowerCase() === p);
    }
    if (query.municipality) {
      const m = query.municipality.toLowerCase();
      formatted = formatted.filter((s) => s.municipality?.toLowerCase() === m);
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      formatted = formatted.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q),
      );
    }

    return formatted;
  }

  async findOne(idOrSlug: string) {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const store = isNumeric
      ? await this.prisma.store.findUnique({ where: { id: Number(idOrSlug) } })
      : await this.prisma.store.findFirst({ where: { slug: idOrSlug } });

    if (!store) throw new NotFoundException('Tienda no encontrada');
    return formatStore(store);
  }

  async updateStatus(id: number, status: string) {
    try {
      const store = await this.prisma.store.update({ where: { id }, data: { status } });
      return formatStore(store);
    } catch {
      throw new NotFoundException('Tienda no encontrada');
    }
  }

  async updateZelleInfo(id: number, dto: { accepts_zelle?: boolean; zelle_info?: Record<string, unknown> }) {
    try {
      return await this.prisma.store.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException('Tienda no encontrada');
    }
  }

  async updateProfile(id: number, dto: UpdateStoreProfileDto) {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    const updates: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      updates.name = dto.name;
      updates.slug = generateSlug(dto.name);
    }
    for (const field of [
      'description', 'slogan', 'phone', 'logo_url', 'banner_url',
      'is_open', 'has_delivery', 'opening_time', 'closing_time', 'store_type',
    ] as const) {
      if (dto[field] !== undefined) updates[field] = dto[field];
    }

    const zelleFields = ['province', 'municipality', 'address', 'lat', 'lng', 'price_per_night', 'gallery'] as const;
    if (zelleFields.some((f) => dto[f] !== undefined)) {
      const current = (existing?.zelle_info as Record<string, unknown>) || {};
      const zelleUpdates: Record<string, unknown> = {};
      for (const f of zelleFields) {
        if (dto[f] !== undefined) zelleUpdates[f] = dto[f];
      }
      updates.zelle_info = { ...current, ...zelleUpdates };
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const store = await this.prisma.store.update({ where: { id }, data: updates });
      return formatStore(store);
    } catch {
      throw new NotFoundException('Tienda no encontrada');
    }
  }

  async getStats(id: number) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [viewsToday, viewsThisMonth, viewsTotal] = await Promise.all([
      this.prisma.productView.count({
        where: { product: { store_id: id }, created_at: { gte: startOfToday } },
      }),
      this.prisma.productView.count({
        where: { product: { store_id: id }, created_at: { gte: startOfMonth } },
      }),
      this.prisma.productView.count({ where: { product: { store_id: id } } }),
    ]);

    return { viewsToday, viewsThisMonth, viewsTotal };
  }

  async getAdminDetails(id: number) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Tienda no encontrada');

    const activeProductsCount = await this.prisma.product.count({ where: { store_id: id } });
    const orderItems = await this.prisma.orderItem.findMany({
      where: { product: { store_id: id } },
      select: { quantity: true },
    });
    const totalSalesCount = orderItems.reduce((acc, item) => acc + item.quantity, 0);

    return { store: formatStore(store), activeProductsCount, totalSalesCount };
  }

  async updateCredentials(id: number, req: RequestWithStore, dto: UpdateStoreCredentialsDto) {
    const updates: { email?: string; password?: string } = {};
    let cleanPhone: string | null = null;

    if (dto.phone) {
      cleanPhone = dto.phone.replace(/[^0-9]/g, '');
      updates.email = `${cleanPhone}@cubaamazon.com`;
    }
    if (dto.password) {
      updates.password = dto.password;
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No se enviaron datos para actualizar');
    }

    const { error } = await this.supabaseService.client.auth.admin.updateUserById(
      req.user.id,
      updates,
    );
    if (error) throw new BadRequestException('Error al actualizar las credenciales en Auth');

    if (cleanPhone) {
      await this.prisma.store.update({ where: { id }, data: { phone: cleanPhone } });
    }

    return {
      message: 'Credenciales actualizadas exitosamente',
      phone: cleanPhone || req.store.phone,
    };
  }
}
```

- [ ] **Step 7: Run the test**

Run: `cd backend-nest && npm test -- stores.service.spec.ts`
Expected: PASS.

- [ ] **Step 8: Write `StoresController`**

Create `backend-nest/src/stores/stores.controller.ts`:
```typescript
import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, Req, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { UpdateStoreStatusDto } from './dto/update-store-status.dto';
import { UpdateZelleInfoDto } from './dto/update-zelle-info.dto';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { UpdateStoreCredentialsDto } from './dto/update-store-credentials.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { StoreOwnershipGuard } from '../auth/store-ownership.guard';
import { RequestWithStore } from '../auth/request-with-store.interface';

@Controller('api/stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@Query() query: { type?: string; province?: string; municipality?: string; q?: string }) {
    return this.storesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Get(':id/admin-details')
  getAdminDetails(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getAdminDetails(id);
  }

  @Get(':id/stats')
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getStats(id);
  }

  @Put(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoreStatusDto) {
    return this.storesService.updateStatus(id, dto.status);
  }

  @Put(':id/zelle')
  updateZelleInfo(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateZelleInfoDto) {
    return this.storesService.updateZelleInfo(id, dto);
  }

  @Put(':id/credentials')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  updateCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithStore,
    @Body() dto: UpdateStoreCredentialsDto,
  ) {
    return this.storesService.updateCredentials(id, req, dto);
  }

  @Put(':id')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  updateProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoreProfileDto) {
    return this.storesService.updateProfile(id, dto);
  }
}
```

- [ ] **Step 9: Write the failing `StoreCategoriesService` test**

Create `backend-nest/src/stores/store-categories.service.spec.ts`:
```typescript
import { NotFoundException } from '@nestjs/common';
import { StoreCategoriesService } from './store-categories.service';

describe('StoreCategoriesService', () => {
  it('creates a category scoped to the given store', async () => {
    const created = { id: 1, store_id: 7, name: 'Bebidas', image_url: null };
    const prisma = { storeCategory: { create: jest.fn().mockResolvedValue(created), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() } } as any;
    const service = new StoreCategoriesService(prisma);

    const result = await service.create(7, { name: 'Bebidas' });

    expect(prisma.storeCategory.create).toHaveBeenCalledWith({
      data: { store_id: 7, name: 'Bebidas', image_url: undefined },
    });
    expect(result).toEqual(created);
  });

  it('throws NotFoundException when updating a category that does not belong to the store', async () => {
    const prisma = { storeCategory: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } } as any;
    const service = new StoreCategoriesService(prisma);

    await expect(service.update(7, 99, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 10: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- store-categories.service.spec.ts`
Expected: FAIL.

- [ ] **Step 11: Implement `StoreCategoriesService` and controller**

Create `backend-nest/src/stores/store-categories.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreCategoryDto, UpdateStoreCategoryDto } from './dto/store-category.dto';

@Injectable()
export class StoreCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(storeId: number) {
    return this.prisma.storeCategory.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'asc' },
    });
  }

  create(storeId: number, dto: CreateStoreCategoryDto) {
    return this.prisma.storeCategory.create({
      data: { store_id: storeId, name: dto.name, image_url: dto.image_url },
    });
  }

  async update(storeId: number, categoryId: number, dto: UpdateStoreCategoryDto) {
    const existing = await this.prisma.storeCategory.findFirst({
      where: { id: categoryId, store_id: storeId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    return this.prisma.storeCategory.update({
      where: { id: categoryId },
      data: dto,
    });
  }

  async remove(storeId: number, categoryId: number) {
    const existing = await this.prisma.storeCategory.findFirst({
      where: { id: categoryId, store_id: storeId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    await this.prisma.storeCategory.delete({ where: { id: categoryId } });
    return { message: 'Category deleted successfully' };
  }
}
```

Create `backend-nest/src/stores/store-categories.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { StoreCategoriesService } from './store-categories.service';
import { CreateStoreCategoryDto, UpdateStoreCategoryDto } from './dto/store-category.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { StoreOwnershipGuard } from '../auth/store-ownership.guard';

@Controller('api/stores/:id/categories')
export class StoreCategoriesController {
  constructor(private readonly storeCategoriesService: StoreCategoriesService) {}

  @Get()
  findAll(@Param('id', ParseIntPipe) storeId: number) {
    return this.storeCategoriesService.findAll(storeId);
  }

  @Post()
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  create(@Param('id', ParseIntPipe) storeId: number, @Body() dto: CreateStoreCategoryDto) {
    return this.storeCategoriesService.create(storeId, dto);
  }

  @Put(':categoryId')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  update(
    @Param('id', ParseIntPipe) storeId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateStoreCategoryDto,
  ) {
    return this.storeCategoriesService.update(storeId, categoryId, dto);
  }

  @Delete(':categoryId')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  remove(
    @Param('id', ParseIntPipe) storeId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.storeCategoriesService.remove(storeId, categoryId);
  }
}
```

- [ ] **Step 12: Run the test**

Run: `cd backend-nest && npm test -- store-categories.service.spec.ts`
Expected: PASS.

- [ ] **Step 13: Write `StoresModule`**

Create `backend-nest/src/stores/stores.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoreCategoriesController } from './store-categories.controller';
import { StoreCategoriesService } from './store-categories.service';
import { GuardsModule } from '../auth/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [StoresController, StoreCategoriesController],
  providers: [StoresService, StoreCategoriesService],
})
export class StoresModule {}
```

Import `StoresModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 14: Run the full test suite so far**

Run: `cd backend-nest && npm test`
Expected: all suites PASS.

- [ ] **Step 15: Commit**

```bash
git add -A && git commit -m "add StoresModule (stores CRUD, admin details, stats, store categories)"
```

---

## Task 11: `ProductsModule`

**Files:**
- Create: `backend-nest/src/products/products.module.ts`
- Create: `backend-nest/src/products/products.controller.ts`
- Create: `backend-nest/src/products/products.service.ts`
- Create: `backend-nest/src/products/dto/create-product.dto.ts`
- Create: `backend-nest/src/products/dto/update-product.dto.ts`
- Create: `backend-nest/src/products/dto/create-product-review.dto.ts`
- Create: `backend-nest/src/products/product-format.util.ts`
- Test: `backend-nest/src/products/product-format.util.spec.ts`
- Test: `backend-nest/src/products/products.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `GuardsModule`.
- Produces: `GET /api/products` (query `storeId, q, category, province, municipality, store_category_id, requireImage`), `GET /api/products/:id`, `POST /api/products` (guarded), `PUT /api/products/:id` (guarded), `DELETE /api/products/:id` (guarded), `POST /api/products/:id/view`, `GET /api/products/:id/reviews`, `POST /api/products/:id/reviews`.

- [ ] **Step 1: Write the failing `formatProduct` test**

Create `backend-nest/src/products/product-format.util.spec.ts`:
```typescript
import { formatProduct } from './product-format.util';

describe('formatProduct', () => {
  it('derives store_accepts_zelle/store_has_delivery/store_name/store_phone/store_slug from the joined store', () => {
    const product = {
      id: 1,
      store_name: null,
      store_phone: null,
      store: { accepts_zelle: true, has_delivery: false, name: 'Cafetería Juan', phone: '5551234', slug: 'cafeteria-juan' },
    };

    expect(formatProduct(product as any)).toMatchObject({
      store_accepts_zelle: true,
      store_has_delivery: false,
      store_name: 'Cafetería Juan',
      store_phone: '5551234',
      store_slug: 'cafeteria-juan',
    });
  });

  it('prefers the denormalized store_name/store_phone columns when present', () => {
    const product = {
      id: 1,
      store_name: 'Legacy Name',
      store_phone: '5550000',
      store: { accepts_zelle: false, has_delivery: false, name: 'New Name', phone: '5551234', slug: 'x' },
    };

    const result = formatProduct(product as any);
    expect(result.store_name).toBe('Legacy Name');
    expect(result.store_phone).toBe('5550000');
  });
});
```

- [ ] **Step 2: Run it, confirm it fails, then implement**

Run: `cd backend-nest && npm test -- product-format.util.spec.ts` → FAIL.

Create `backend-nest/src/products/product-format.util.ts`:
```typescript
import { Product, Store } from '@prisma/client';

type ProductWithStore = Product & { store?: Store | null };

export const formatProduct = (product: ProductWithStore) => ({
  ...product,
  store_accepts_zelle: product.store?.accepts_zelle === true,
  store_has_delivery: product.store?.has_delivery === true,
  store_name: product.store_name || product.store?.name,
  store_phone: product.store_phone || product.store?.phone,
  store_slug: product.store_slug || product.store?.slug || product.store?.id,
});
```

Run again: PASS.

- [ ] **Step 3: Write the DTOs**

Create `backend-nest/src/products/dto/create-product.dto.ts`:
```typescript
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() price: number;
  @IsOptional() @IsNumber() price_usd?: number;
  @IsOptional() @IsIn(['USD', 'CUP']) currency?: string;
  @IsOptional() @IsInt() stock?: number;
  @IsOptional() @IsInt() category_id?: number;
  @IsOptional() @IsInt() store_category_id?: number;
  @IsOptional() @IsString() image_url?: string;
  @IsOptional() @IsString() image_url_2?: string;
  @IsOptional() @IsString() image_url_3?: string;
  @IsOptional() @IsString() image_url_4?: string;
  @IsOptional() @IsString() image_url_5?: string;
  @IsInt() store_id: number;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsArray() delivery_locations?: string[];
}
```

Create `backend-nest/src/products/dto/update-product.dto.ts` (`PartialType` over the create DTO minus ownership field, matching the Express behavior of accepting a partial patch):
```typescript
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['store_id'] as const),
) {}
```
(Install the mapped-types package: `npm install @nestjs/mapped-types`.)

Create `backend-nest/src/products/dto/create-product-review.dto.ts`:
```typescript
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateProductReviewDto {
  @IsString() @IsNotEmpty() customer_name: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() comment?: string;
}
```

- [ ] **Step 4: Write the failing `ProductsService` test (ownership checks + query filtering are the risky parts)**

Create `backend-nest/src/products/products.service.spec.ts`:
```typescript
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  describe('create', () => {
    it('throws ForbiddenException when store_id does not match the authenticated store', async () => {
      const prisma = { product: { create: jest.fn() } } as any;
      const service = new ProductsService(prisma);

      await expect(
        service.create({ store_id: 2 } as any, { id: 1 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('defaults currency to USD and builds delivery_locations when omitted', async () => {
      const create = jest.fn().mockResolvedValue({ id: 10 });
      const prisma = { product: { create } } as any;
      const service = new ProductsService(prisma);

      await service.create(
        { store_id: 1, name: 'Café', price: 5, province: 'La Habana', municipality: 'Playa' } as any,
        { id: 1 } as any,
      );

      expect(create.mock.calls[0][0].data).toMatchObject({
        currency: 'USD',
        delivery_locations: ['La Habana:Playa'],
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      const prisma = { product: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      const service = new ProductsService(prisma);

      await expect(service.remove(1, { id: 1 } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the product belongs to a different store', async () => {
      const prisma = {
        product: { findUnique: jest.fn().mockResolvedValue({ id: 1, store_id: 2 }) },
      } as any;
      const service = new ProductsService(prisma);

      await expect(service.remove(1, { id: 1 } as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- products.service.spec.ts`
Expected: FAIL.

- [ ] **Step 6: Implement `ProductsService`**

Create `backend-nest/src/products/products.service.ts`:
```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { formatProduct } from './product-format.util';

const STORE_INCLUDE = { store: { select: { accepts_zelle: true, name: true, phone: true, slug: true, has_delivery: true, id: true } } };

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    storeId?: string; q?: string; category?: string; province?: string;
    municipality?: string; store_category_id?: string; requireImage?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (query.storeId) where.store_id = Number(query.storeId);
    if (query.category) where.category_id = Number(query.category);
    if (query.store_category_id) where.store_category_id = Number(query.store_category_id);
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.requireImage) where.image_url = { not: null, notIn: [''] };

    if (query.province && query.municipality) {
      where.delivery_locations = {
        hasSome: [
          `${query.province}:${query.municipality}`,
          `${query.province}:Toda la provincia`,
          'Toda Cuba:Toda Cuba',
        ],
      };
    } else if (query.province) {
      where.delivery_locations = {
        hasSome: [`${query.province}:Toda la provincia`, 'Toda Cuba:Toda Cuba'],
      };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: STORE_INCLUDE,
      orderBy: [{ is_featured: 'desc' }, { created_at: 'desc' }],
    });

    return products.map(formatProduct);
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: STORE_INCLUDE,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return formatProduct(product);
  }

  async create(dto: CreateProductDto, callerStore: Store) {
    if (String(dto.store_id) !== String(callerStore.id)) {
      throw new ForbiddenException('No tienes permiso para crear productos en esta tienda');
    }

    const delivery_locations = dto.delivery_locations || [`${dto.province}:${dto.municipality}`];
    const currency = dto.currency || 'USD';

    return this.prisma.product.create({
      data: { ...dto, currency, delivery_locations },
    });
  }

  async update(id: number, dto: UpdateProductDto, callerStore: Store) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    if (String(existing.store_id) !== String(callerStore.id)) {
      throw new ForbiddenException('No tienes permiso para editar este producto');
    }

    const data = { ...dto };
    if (data.currency === null) data.currency = 'USD';

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: number, callerStore: Store) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    if (String(existing.store_id) !== String(callerStore.id)) {
      throw new ForbiddenException('No tienes permiso para eliminar este producto');
    }

    await this.prisma.orderItem.deleteMany({ where: { product_id: id } });
    const product = await this.prisma.product.delete({ where: { id } });
    return { message: 'Producto eliminado correctamente', product };
  }

  async registerView(id: number) {
    await this.prisma.productView.create({ data: { product_id: id } });
    return { message: 'View registered' };
  }

  findReviews(id: number) {
    return this.prisma.productReview.findMany({
      where: { product_id: id },
      orderBy: { created_at: 'desc' },
    });
  }

  addReview(id: number, dto: CreateProductReviewDto) {
    return this.prisma.productReview.create({
      data: { product_id: id, ...dto },
    });
  }
}
```

- [ ] **Step 7: Run the test**

Run: `cd backend-nest && npm test -- products.service.spec.ts`
Expected: PASS.

- [ ] **Step 8: Write `ProductsController` and `ProductsModule`**

Create `backend-nest/src/products/products.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { RequestWithStore } from '../auth/request-with-store.interface';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(SellerAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto, @Req() req: RequestWithStore) {
    return this.productsService.create(dto, req.store);
  }

  @Put(':id')
  @UseGuards(SellerAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto, @Req() req: RequestWithStore) {
    return this.productsService.update(id, dto, req.store);
  }

  @Delete(':id')
  @UseGuards(SellerAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithStore) {
    return this.productsService.remove(id, req.store);
  }

  @Post(':id/view')
  registerView(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.registerView(id);
  }

  @Get(':id/reviews')
  findReviews(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findReviews(id);
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  addReview(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProductReviewDto) {
    return this.productsService.addReview(id, dto);
  }
}
```

Create `backend-nest/src/products/products.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { GuardsModule } from '../auth/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

Import `ProductsModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "add ProductsModule (catalog CRUD, views, reviews)"
```

---

## Task 12: `OrdersModule`

**Files:**
- Create: `backend-nest/src/orders/orders.module.ts`
- Create: `backend-nest/src/orders/orders.controller.ts`
- Create: `backend-nest/src/orders/orders.service.ts`
- Create: `backend-nest/src/orders/dto/create-order.dto.ts`
- Create: `backend-nest/src/orders/dto/update-order.dto.ts`
- Test: `backend-nest/src/orders/orders.service.spec.ts`
- Modify: `backend-nest/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `GET /api/orders` (query `storeId`, `ids`), `POST /api/orders`, `PUT /api/orders/:id`.

- [ ] **Step 1: Write the failing service test (the store-scoped filtering is the risky part — it must only return orders/items that belong to that store)**

Create `backend-nest/src/orders/orders.service.spec.ts`:
```typescript
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  describe('findAll', () => {
    it('scopes both the order list and each order\'s items to the given store', async () => {
      const orderItem = { order_id: 1, product: { store_id: 7 } };
      const prisma = {
        orderItem: { findMany: jest.fn().mockResolvedValue([orderItem]) },
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              order_items: [
                { product_id: 1, quantity: 2, product: { store_id: 7 } },
                { product_id: 2, quantity: 1, product: { store_id: 9 } },
              ],
            },
          ]),
        },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: '7' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [1] } } }),
      );
      expect(result[0].order_items).toHaveLength(1);
      expect(result[0].order_items[0].product.store_id).toBe(7);
    });

    it('returns an empty array without querying orders when the store has no matching order_items', async () => {
      const prisma = {
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        order: { findMany: jest.fn() },
      } as any;
      const service = new OrdersService(prisma);

      const result = await service.findAll({ storeId: '7' });

      expect(result).toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      const prisma = { order: { update: jest.fn().mockRejectedValue(new Error('not found')) } } as any;
      const service = new OrdersService(prisma);

      await expect(service.update(999, 'shipped')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm test -- orders.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write the DTOs**

Create `backend-nest/src/orders/dto/create-order.dto.ts`:
```typescript
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsNumber() product_id: number;
  @IsNumber() quantity: number;
  @IsNumber() price: number;
}

export class CreateOrderDto {
  @IsString() @IsNotEmpty() customer_name: string;
  @IsOptional() @IsString() customer_email?: string;
  @IsOptional() @IsString() customer_address?: string;
  @IsOptional() @IsString() customer_phone?: string;
  @IsNumber() total: number;
  @IsOptional() @IsIn(['cash_on_delivery', 'zelle', 'transfer']) payment_method?: string;
  @IsOptional() @IsString() payment_proof_url?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
}
```

Create `backend-nest/src/orders/dto/update-order.dto.ts`:
```typescript
import { IsIn } from 'class-validator';

export class UpdateOrderDto {
  @IsIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
  status: string;
}
```

- [ ] **Step 4: Implement `OrdersService`**

Create `backend-nest/src/orders/orders.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { storeId?: string; ids?: string }) {
    let orderIds: number[] = query.ids
      ? query.ids.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
      : [];

    if (query.storeId) {
      const storeId = Number(query.storeId);
      const items = await this.prisma.orderItem.findMany({
        where: { product: { store_id: storeId } },
        select: { order_id: true },
      });
      const storeOrderIds = [...new Set(items.map((i) => i.order_id))];

      orderIds = orderIds.length > 0
        ? orderIds.filter((id) => storeOrderIds.includes(id))
        : storeOrderIds;

      if (orderIds.length === 0) return [];
    }

    const orders = await this.prisma.order.findMany({
      where: orderIds.length > 0 ? { id: { in: orderIds } } : undefined,
      include: { order_items: { include: { product: true } } },
      orderBy: { created_at: 'desc' },
    });

    if (query.storeId) {
      const storeId = Number(query.storeId);
      return orders.map((order) => ({
        ...order,
        order_items: order.order_items.filter((item) => item.product?.store_id === storeId),
      }));
    }

    return orders;
  }

  async create(dto: CreateOrderDto) {
    const order = await this.prisma.order.create({
      data: {
        customer_name: dto.customer_name,
        customer_email: dto.customer_email,
        customer_address: dto.customer_address,
        customer_phone: dto.customer_phone,
        total: dto.total,
        status: 'pending',
        payment_method: dto.payment_method || 'cash_on_delivery',
        payment_proof_url: dto.payment_proof_url,
      },
    });

    if (dto.items?.length > 0) {
      await this.prisma.orderItem.createMany({
        data: dto.items.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: item.price,
        })),
      });
    }

    return { message: 'Pedido creado exitosamente', order };
  }

  async update(id: number, status: string) {
    try {
      return await this.prisma.order.update({ where: { id }, data: { status } });
    } catch {
      throw new NotFoundException('Pedido no encontrado');
    }
  }
}
```

- [ ] **Step 5: Run the test**

Run: `cd backend-nest && npm test -- orders.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Write `OrdersController` and `OrdersModule`**

Create `backend-nest/src/orders/orders.controller.ts`:
```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: { storeId?: string; ids?: string }) {
    return this.ordersService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto.status);
  }
}
```

Create `backend-nest/src/orders/orders.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

Import `OrdersModule` into `backend-nest/src/app.module.ts`.

- [ ] **Step 7: Run the full test suite**

Run: `cd backend-nest && npm test`
Expected: every suite PASSES.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "add OrdersModule (order creation, store-scoped listing, status updates)"
```

---

## Task 13: End-to-end tests for routing, guards, and validation wiring

**Files:**
- Create: `backend-nest/test/auth.e2e-spec.ts`
- Create: `backend-nest/test/products.e2e-spec.ts`
- Create: `backend-nest/test/stores.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppModule` (full app graph), with `PrismaService`, `SupabaseService`, and `SellerAuthGuard`/`StoreOwnershipGuard` overridden via Nest's `overrideProvider`/`overrideGuard` — no live DB or Supabase call happens in these tests.

Unit tests (Tasks 2–12) already cover each service's business logic in isolation. What they don't cover is the HTTP layer itself: does `ValidationPipe` actually reject a bad request body on the real route, does an unauthenticated request to a guarded route actually 401, does the global `HttpExceptionFilter` actually produce `{ error: "..." }` over real HTTP. This task closes that gap with one e2e spec per representative flow, rather than one per every one of the ~30 endpoints — each spec below exercises a guarded route, an unguarded route, and a validation failure, which is enough to trust the wiring pattern every module reuses.

- [ ] **Step 1: Write the failing auth e2e spec**

Create `backend-nest/test/auth.e2e-spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  it('POST /api/auth/register with a valid body returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: '5551234@cubaamazon.com', password: 'secret123', full_name: 'Juan Pérez' })
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toBe('Usuario y tienda registrados exitosamente');
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

  afterEach(async () => {
    await app.close();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend-nest && npm run test:e2e -- auth.e2e-spec.ts`
Expected: FAIL (module wiring likely incomplete, or the register/delete assertions fail) — this test is written against the app as built in Tasks 1–12, so a failure here means either the test's assumptions are wrong or a real wiring bug exists; inspect the failure output before moving to Step 3.

- [ ] **Step 3: Fix whichever side is wrong and re-run until green**

If the failure is in the test's mock shape (e.g. a provider override missing a method the request path actually calls), fix the test. If the failure reveals a real bug in a controller/service from an earlier task (e.g. a route not actually wired into `AppModule`, or a guard not applied), fix the source file from that task — do not work around it in the test.

Run: `cd backend-nest && npm run test:e2e -- auth.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 4: Write, run, and fix the products e2e spec**

Create `backend-nest/test/products.e2e-spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SellerAuthGuard } from '../src/auth/seller-auth.guard';

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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
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
      .send({ name: 'Café', price: 5, store_id: 1, province: 'La Habana', municipality: 'Playa' })
      .expect(201);
  });

  it('POST /api/products with a missing required field returns 400', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({ price: 5, store_id: 1 })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
```

Run: `cd backend-nest && npm run test:e2e -- products.e2e-spec.ts`
Expected: FAIL first, then fix (test or source, per Step 3's rule) until PASS.

- [ ] **Step 5: Write, run, and fix the stores ownership e2e spec**

Create `backend-nest/test/stores.e2e-spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SellerAuthGuard } from '../src/auth/seller-auth.guard';

describe('Stores ownership (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ store: { update: jest.fn().mockResolvedValue({ id: 1, zelle_info: {} }) } })
      .overrideGuard(SellerAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.store = { id: 1 }; // authenticated as store 1
          req.user = { id: 'u1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  it('PUT /api/stores/:id for the owning store returns 200', () => {
    return request(app.getHttpServer())
      .put('/api/stores/1')
      .send({ name: 'Nueva Cafetería' })
      .expect(200);
  });

  it('PUT /api/stores/:id for a different store id returns 403 via StoreOwnershipGuard', () => {
    return request(app.getHttpServer())
      .put('/api/stores/2')
      .send({ name: 'Nueva Cafetería' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('No tienes permiso sobre esta tienda');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
```

Run: `cd backend-nest && npm run test:e2e -- stores.e2e-spec.ts`
Expected: FAIL first, then fix until PASS.

- [ ] **Step 6: Run the full e2e suite**

Run: `cd backend-nest && npm run test:e2e`
Expected: all e2e suites PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "add e2e tests covering routing, guards, and validation wiring"
```

---

## Task 14: Vercel deployment config and final smoke test

**Files:**
- Create: `backend-nest/vercel.json`
- Create: `backend-nest/.env.example` (finalize: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`)
- Modify: `backend-nest/package.json` (add a `vercel-build` script running `prisma generate`)
- Test: manual smoke test (documented below, not an automated test file)

**Interfaces:**
- Produces: a deployable Vercel project — no new code interfaces, this task wires existing modules for deployment.

- [ ] **Step 1: Add `vercel.json`**

Create `backend-nest/vercel.json`:
```json
{
  "version": 2,
  "builds": [{ "src": "src/main.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/main.ts" }]
}
```

- [ ] **Step 2: Ensure Prisma Client regenerates on every Vercel build**

In `backend-nest/package.json`, add to `"scripts"`:
```json
"vercel-build": "prisma generate && nest build"
```

- [ ] **Step 3: Finalize `.env.example`**

`backend-nest/.env.example` should contain (values are placeholders, not real secrets):
```
PORT=5001
DATABASE_URL="postgresql://user:password@host:5432/postgres"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

- [ ] **Step 4: Run the full test suite one more time as a pre-deploy gate**

Run: `cd backend-nest && npm test && npm run test:e2e`
Expected: all suites PASS.

- [ ] **Step 5: Build locally to catch TS/compile errors before deploying**

Run: `cd backend-nest && npm run build`
Expected: exits 0, emits `backend-nest/dist/`.

- [ ] **Step 6: Deploy as a new, separate Vercel project**

This is a one-time manual step (not scripted, since it requires interactive Vercel account/org selection): from `backend-nest/`, run `vercel` (or `vercel --prod` once verified), choosing "create a new project" — do **not** link it to the existing `backend` Vercel project. Set the three env vars from Step 3 in the new Vercel project's dashboard (Production and Preview).

- [ ] **Step 7: Manual smoke test against the deployed URL**

```bash
curl https://<new-deployment-url>/api/health
curl https://<new-deployment-url>/api/categories
curl https://<new-deployment-url>/api/stores
```
Expected: `/api/health` returns `{"status":"OK", ...}`; the other two return real data from the shared Supabase DB (confirming Prisma is actually reaching the live database, not just passing mocked unit tests).

- [ ] **Step 8: Commit the deployment config**

```bash
git add -A && git commit -m "add Vercel deployment config for backend-nest"
```

---

## Post-plan follow-up (not part of this plan)

- Switching any frontend's API base URL to `backend-nest/` happens in that frontend's own future migration plan, not here.
- Retiring `backend/` (Express) happens only after all three frontends have migrated, tracked separately.
