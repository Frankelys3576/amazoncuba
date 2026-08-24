import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { SpanishParseUuidPipe } from '../common/spanish-parse-uuid.pipe';
import { UpdateStoreStatusDto } from './dto/update-store-status.dto';
import { UpdateZelleInfoDto } from './dto/update-zelle-info.dto';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { UpdateStoreCredentialsDto } from './dto/update-store-credentials.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { StoreOwnershipGuard } from '../auth/store-ownership.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithStore } from '../auth/request-with-store.interface';

@Controller('api/stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@Query() query: { type?: string; province?: string; municipality?: string; q?: string }) {
    return this.storesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Get(':id/admin-details')
  @UseGuards(AdminGuard)
  getAdminDetails(@Param('id', SpanishParseUuidPipe) id: string) {
    return this.storesService.getAdminDetails(id);
  }

  @Get(':id/stats')
  getStats(@Param('id', SpanishParseUuidPipe) id: string) {
    return this.storesService.getStats(id);
  }

  @Put(':id/status')
  @UseGuards(AdminGuard)
  updateStatus(@Param('id', SpanishParseUuidPipe) id: string, @Body() dto: UpdateStoreStatusDto) {
    return this.storesService.updateStatus(id, dto.status);
  }

  @Put(':id/zelle')
  @UseGuards(AdminGuard)
  updateZelleInfo(@Param('id', SpanishParseUuidPipe) id: string, @Body() dto: UpdateZelleInfoDto) {
    return this.storesService.updateZelleInfo(id, dto);
  }

  @Put(':id/credentials')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  updateCredentials(
    @Param('id', SpanishParseUuidPipe) id: string,
    @Req() req: RequestWithStore,
    @Body() dto: UpdateStoreCredentialsDto,
  ) {
    return this.storesService.updateCredentials(id, req, dto);
  }

  @Put(':id')
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
  updateProfile(@Param('id', SpanishParseUuidPipe) id: string, @Body() dto: UpdateStoreProfileDto) {
    return this.storesService.updateProfile(id, dto);
  }
}
