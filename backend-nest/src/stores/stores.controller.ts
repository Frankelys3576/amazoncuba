import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StoresService } from './stores.service';
import { SpanishParseUuidPipe } from '../common/spanish-parse-uuid.pipe';
import { UpdateStoreStatusDto } from './dto/update-store-status.dto';
import { UpdateZelleInfoDto } from './dto/update-zelle-info.dto';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { UpdateStoreCredentialsDto } from './dto/update-store-credentials.dto';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { StoreOwnershipGuard } from '../auth/store-ownership.guard';
import { AdminGuard } from '../auth/admin.guard';
import { extractBearerToken } from '../auth/bearer-token.util';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestWithStore } from '../auth/request-with-store.interface';

@Controller('api/stores')
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  async findAll(
    @Query() query: { type?: string; province?: string; municipality?: string; q?: string },
    @Req() req: Request,
  ) {
    // Un administrador ve todas las tiendas; cualquier otro llamante sólo las
    // aprobadas. admin-frontend usa este mismo endpoint para aprobar tiendas
    // pendientes, así que el filtro sin la excepción rompería la aprobación.
    // Espejo de getStores en backend/src/controllers/store.controller.js:
    // esto NUNCA rechaza la petición (a diferencia de AdminGuard), sólo mira
    // la credencial si la hay, para que un llamante anónimo siga viendo el
    // listado público.
    const isAdmin = await this.resolveIsAdmin(req);
    return this.storesService.findAll(query, isAdmin);
  }

  // Sólo mira la credencial, nunca lanza. Sin cabecera Authorization no hay
  // llamada de red, igual que resolveOrdersCaller — un listado anónimo no
  // cuesta nada extra.
  private async resolveIsAdmin(req: Request): Promise<boolean> {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return false;

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) return false;

    const appMetadata = user.app_metadata as { role?: string } | null;
    return Boolean(appMetadata && appMetadata.role === 'admin');
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
  @UseGuards(SellerAuthGuard, StoreOwnershipGuard)
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
