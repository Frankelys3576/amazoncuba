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
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SpanishParseUuidPipe } from '../common/spanish-parse-uuid.pipe';
import { OrdersQueryAuthGuard } from '../auth/orders-query-auth.guard';
import { OrderUpdateAuthGuard } from '../auth/order-update-auth.guard';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(OrdersQueryAuthGuard)
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
  @UseGuards(OrderUpdateAuthGuard)
  update(@Param('id', SpanishParseUuidPipe) id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto.status);
  }
}
