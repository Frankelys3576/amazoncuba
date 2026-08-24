import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
