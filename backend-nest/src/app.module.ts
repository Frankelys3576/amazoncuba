import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { CategoriesModule } from './categories/categories.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';

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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
