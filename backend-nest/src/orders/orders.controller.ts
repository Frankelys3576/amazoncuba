import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SpanishParseIntPipe } from '../common/spanish-parse-int.pipe';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: { storeId?: string; ids?: string }) {
    return this.ordersService.findAll(query);
  }

  // Express: res.status(201).json(...) (order.controller.js:98).
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  // Express: bare res.json(...) = 200 (order.controller.js:122) = Nest default.
  @Put(':id')
  update(@Param('id', SpanishParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto.status);
  }
}
