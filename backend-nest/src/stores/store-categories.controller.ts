import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { StoreCategoriesService } from './store-categories.service';
import { CreateStoreCategoryDto, UpdateStoreCategoryDto } from './dto/store-category.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { StoreOwnershipGuard } from '../auth/store-ownership.guard';

@Controller('api/stores/:id/categories')
export class StoreCategoriesController {
  constructor(private readonly storeCategoriesService: StoreCategoriesService) {}

  @Get()
  findAll(@Param('id', ParseIntPipe) storeId: number) {
    return this.storeCategoriesService.findAll(storeId);
  }

  @Post()
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  create(@Param('id', ParseIntPipe) storeId: number, @Body() dto: CreateStoreCategoryDto) {
    return this.storeCategoriesService.create(storeId, dto);
  }

  @Put(':categoryId')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  update(
    @Param('id', ParseIntPipe) storeId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateStoreCategoryDto,
  ) {
    return this.storeCategoriesService.update(storeId, categoryId, dto);
  }

  @Delete(':categoryId')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  remove(
    @Param('id', ParseIntPipe) storeId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.storeCategoriesService.remove(storeId, categoryId);
  }
}
