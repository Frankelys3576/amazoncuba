import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
