import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { CategoriesModule } from './categories/categories.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [PrismaModule, SupabaseModule, CategoriesModule, SettingsModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
