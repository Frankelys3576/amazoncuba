import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  // Same reasoning as backend/src/index.js: Vercel is a single edge/proxy
  // hop in front of this app, and @nestjs/throttler's default tracker reads
  // `req.ip` from the underlying Express instance. `1` trusts exactly that
  // one hop's X-Forwarded-For entry (the real client), not `true`, which
  // would trust a client-forged X-Forwarded-For and let it dodge the
  // per-IP throttler buckets.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}

// One bootstrap for both local dev and Vercel.
//
// Vercel's NestJS preset detects this file by name (`src/main.ts` is on its
// entrypoint list), compiles it, and runs the *listening server* as a single
// Fluid Compute Function — so `app.listen()` must run unconditionally. The
// previous version gated it behind `NODE_ENV !== 'production' && !VERCEL`
// and exported a serverless handler instead, which is the older
// `builds: [{ use: '@vercel/node' }]` contract. Under the preset that gate
// would leave the function with no server at all.
//
// The handler also memoized the Nest app in a module-scoped promise so
// concurrent invocations on one worker shared a single Nest graph and Prisma
// connection. Fluid Compute runs this as a normal long-lived Node process,
// so the graph is built exactly once at boot and the memoization has nothing
// left to guard — do not reintroduce it along with a handler export.
async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 5001;
  await app.listen(port);
  console.log(`🚀 Servidor backend-nest corriendo en el puerto ${port}`);
}

void bootstrap();
