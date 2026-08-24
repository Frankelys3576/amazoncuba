import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  update(@Body() dto: UpdateSettingDto) {
    return this.settingsService.update(dto);
  }
}
