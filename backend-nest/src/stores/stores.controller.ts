import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StoresService } from './stores.service';
import type { StoreCaller } from './stores.service';
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
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithStore } from '../auth/request-with-store.interface';

@Controller('api/stores')
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
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
    const caller = await this.resolveCaller(req);
    return this.storesService.findAll(query, caller.isAdmin);
  }

  // Sólo mira la credencial, nunca lanza. Sin cabecera Authorization no hay
  // llamada de red, igual que resolveOrdersCaller — un listado (o consulta
  // individual) anónimo no cuesta nada extra. Devuelve también el id de la
  // tienda propia del llamante (si es vendedor) para que findOne pueda
  // decidir "es el dueño de ESTA tienda concreta" sin otra consulta.
  private async resolveCaller(req: Request): Promise<StoreCaller> {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return { isAdmin: false, storeId: null };

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) return { isAdmin: false, storeId: null };

    const appMetadata = user.app_metadata as { role?: string } | null;
    if (appMetadata && appMetadata.role === 'admin') {
      return { isAdmin: true, storeId: null };
    }

    const store = await this.prisma.store.findUnique({ where: { user_id: user.id } });
    return { isAdmin: false, storeId: store ? store.id : null };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const caller = await this.resolveCaller(req);
    return this.storesService.findOne(id, caller);
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
