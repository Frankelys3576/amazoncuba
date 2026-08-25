import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import type { RequestWithStore } from '../auth/request-with-store.interface';
import { SpanishParseUuidPipe } from '../common/spanish-parse-uuid.pipe';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', SpanishParseUuidPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(SellerAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto, @Req() req: RequestWithStore) {
    return this.productsService.create(dto, req.store);
  }

  @Put(':id')
  @UseGuards(SellerAuthGuard)
  update(
    @Param('id', SpanishParseUuidPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: RequestWithStore,
  ) {
    return this.productsService.update(id, dto, req.store);
  }

  @Delete(':id')
  @UseGuards(SellerAuthGuard)
  remove(@Param('id', SpanishParseUuidPipe) id: string, @Req() req: RequestWithStore) {
    return this.productsService.remove(id, req.store);
  }

  // Express returns res.status(200).json(...) explicitly for this route
  // (product.controller.js:213); Nest's @Post() defaults to 201, so this
  // needs an explicit override to match.
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60 * 60 * 1000 } })
  registerView(@Param('id', SpanishParseUuidPipe) id: string) {
    return this.productsService.registerView(id);
  }

  @Get(':id/reviews')
  findReviews(@Param('id', SpanishParseUuidPipe) id: string) {
    return this.productsService.findReviews(id);
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  addReview(@Param('id', SpanishParseUuidPipe) id: string, @Body() dto: CreateProductReviewDto) {
    return this.productsService.addReview(id, dto);
  }
}
