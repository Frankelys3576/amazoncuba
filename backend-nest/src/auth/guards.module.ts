import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SellerAuthStrategy } from './seller-auth.strategy';
import { SellerAuthGuard } from './seller-auth.guard';
import { StoreOwnershipGuard } from './store-ownership.guard';
import { AdminGuard } from './admin.guard';
import { OrdersQueryAuthGuard } from './orders-query-auth.guard';

@Module({
  imports: [PassportModule],
  providers: [
    SellerAuthStrategy,
    SellerAuthGuard,
    StoreOwnershipGuard,
    AdminGuard,
    OrdersQueryAuthGuard,
  ],
  exports: [SellerAuthGuard, StoreOwnershipGuard, AdminGuard, OrdersQueryAuthGuard],
})
export class GuardsModule {}
