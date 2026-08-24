import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Every bigint id/FK in the DB (stores, products, orders, ...) comes back from
// Prisma as a JS BigInt; JSON.stringify can't serialize BigInt without this.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
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
let cachedApp: INestApplication | undefined;

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = await createApp();
    await cachedApp.init();
  }
  const instance = cachedApp.getHttpAdapter().getInstance();
  return instance(req, res);
}
