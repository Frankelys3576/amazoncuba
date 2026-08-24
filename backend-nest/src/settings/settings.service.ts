import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany();
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value ?? '';
      return acc;
    }, {});
  }

  async update(dto: UpdateSettingDto) {
    const updated = await this.prisma.platformSetting.update({
      where: { key: dto.key },
      data: { value: dto.value, updated_at: new Date() },
    });
    return { message: 'Setting updated successfully', data: [updated] };
  }
}
