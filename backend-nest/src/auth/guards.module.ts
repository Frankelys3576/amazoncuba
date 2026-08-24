import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SellerAuthStrategy } from './seller-auth.strategy';
import { SellerAuthGuard } from './seller-auth.guard';
import { StoreOwnershipGuard } from './store-ownership.guard';

@Module({
  imports: [PassportModule],
  providers: [SellerAuthStrategy, SellerAuthGuard, StoreOwnershipGuard],
  exports: [SellerAuthGuard, StoreOwnershipGuard],
})
export class GuardsModule {}
