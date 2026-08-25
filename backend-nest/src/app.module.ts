import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { StripLegacyFieldsInterceptor } from './common/legacy-fields.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { CategoriesModule } from './categories/categories.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
    CategoriesModule,
    SettingsModule,
    UsersModule,
    UploadModule,
    AuthModule,
    StoresModule,
    ProductsModule,
    OrdersModule,
    // AVISO: cada instancia serverless tiene su propio contador en memoria,
    // así que esto limita POR INSTANCIA, no globalmente. Sube el coste de
    // abusar de estas rutas, pero NO es una garantía. Un límite real
    // necesitaría un almacén compartido (Redis), que hoy no compensa.
    //
    // Solo se registra un throttler base "default" aquí; los límites reales
    // de cada endpoint (login/reseñas/vistas/subidas) se fijan con
    // `@Throttle({ default: { limit, ttl } })` en el propio controlador,
    // que solo aplica `ThrottlerGuard` en esas cuatro rutas puntuales
    // (no como APP_GUARD global). Así el resto de la suite e2e —que no
    // toca esas rutas más que un puñado de veces— queda sin tocar.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60 * 60 * 1000, limit: 60 }]),
  ],
  controllers: [AppController],
  // The `legacy_*` bigint columns schema.prisma still carries are
  // migration-rollback scaffolding: no client should receive them, and
  // JSON.stringify cannot serialize a bigint at all. Stripping them at the
  // one global response boundary closes both (see
  // common/legacy-fields.util.ts). Declared here rather than in main.ts so
  // every e2e spec that boots AppModule exercises it too — the previous
  // shim lived only in main.ts's un-tested serverless path, which is how
  // its removal shipped green.
  providers: [
    { provide: APP_INTERCEPTOR, useClass: StripLegacyFieldsInterceptor },
  ],
})
export class AppModule {}
