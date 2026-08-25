import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SellerAuthStrategy } from './seller-auth.strategy';
import { SellerAuthGuard } from './seller-auth.guard';
import { StoreOwnershipGuard } from './store-ownership.guard';
import { AdminGuard } from './admin.guard';
import { OrdersQueryAuthGuard } from './orders-query-auth.guard';
import { OrderUpdateAuthGuard } from './order-update-auth.guard';

@Module({
  imports: [PassportModule],
  providers: [
    SellerAuthStrategy,
    SellerAuthGuard,
    StoreOwnershipGuard,
    AdminGuard,
    OrdersQueryAuthGuard,
    OrderUpdateAuthGuard,
  ],
  exports: [
    SellerAuthGuard,
    StoreOwnershipGuard,
    AdminGuard,
    OrdersQueryAuthGuard,
    OrderUpdateAuthGuard,
  ],
})
export class GuardsModule {}
