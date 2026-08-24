import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { StoreCategoriesService } from './store-categories.service';
import { SpanishParseUuidPipe } from '../common/spanish-parse-uuid.pipe';
import { CreateStoreCategoryDto, UpdateStoreCategoryDto } from './dto/store-category.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { StoreOwnershipGuard } from '../auth/store-ownership.guard';

@Controller('api/stores/:id/categories')
export class StoreCategoriesController {
  constructor(private readonly storeCategoriesService: StoreCategoriesService) {}

  @Get()
  findAll(@Param('id', SpanishParseUuidPipe) storeId: string) {
    return this.storeCategoriesService.findAll(storeId);
  }

  @Post()
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  create(@Param('id', SpanishParseUuidPipe) storeId: string, @Body() dto: CreateStoreCategoryDto) {
    return this.storeCategoriesService.create(storeId, dto);
  }

  @Put(':categoryId')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  update(
    @Param('id', SpanishParseUuidPipe) storeId: string,
    @Param('categoryId', SpanishParseUuidPipe) categoryId: string,
    @Body() dto: UpdateStoreCategoryDto,
  ) {
    return this.storeCategoriesService.update(storeId, categoryId, dto);
  }

  @Delete(':categoryId')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  remove(
    @Param('id', SpanishParseUuidPipe) storeId: string,
    @Param('categoryId', SpanishParseUuidPipe) categoryId: string,
  ) {
    return this.storeCategoriesService.remove(storeId, categoryId);
  }
}
