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
