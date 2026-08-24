import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SellerAuthStrategy } from './seller-auth.strategy';
import { SellerAuthGuard } from './seller-auth.guard';
import { StoreOwnershipGuard } from './store-ownership.guard';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [PassportModule],
  providers: [SellerAuthStrategy, SellerAuthGuard, StoreOwnershipGuard, AdminGuard],
  exports: [SellerAuthGuard, StoreOwnershipGuard, AdminGuard],
})
export class GuardsModule {}
