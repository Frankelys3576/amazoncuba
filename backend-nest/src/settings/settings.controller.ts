import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  update(@Body() dto: UpdateSettingDto) {
    return this.settingsService.update(dto);
  }
}
