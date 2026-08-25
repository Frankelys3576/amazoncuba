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

// Local/dev: listen on a port like a normal Node server.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  createApp().then(async (app) => {
    const port = process.env.PORT || 5001;
    await app.listen(port);
    console.log(`🚀 Servidor backend-nest corriendo en el puerto ${port}`);
  });
}

// Vercel: reuse one initialized app instance across invocations on the same
// Fluid Compute worker instead of rebuilding the whole Nest graph per request.
//
// M5: cache the in-flight *promise*, not the resolved app. Caching the
// resolved value left a window between the `!cachedApp` check and the
// `cachedApp = await createApp()` assignment — two concurrent requests
// arriving in that window both see `cachedApp` as undefined and each call
// createApp(), building two separate Nest graphs (and two Prisma
// connections) and orphaning one. Caching the promise means the second
// concurrent request awaits the same in-flight createApp() call instead of
// starting its own.
let cachedApp: Promise<INestApplication> | undefined;

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = createApp().then(async (app) => {
      await app.init();
      return app;
    });
  }
  const app = await cachedApp;
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}
