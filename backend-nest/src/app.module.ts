import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [PrismaModule, SupabaseModule, CategoriesModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
