import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  it('findAll converts the settings rows into a key-value object', async () => {
    const rows = [
      { key: 'auto_approve_sellers', value: 'true' },
      { key: 'site_name', value: 'Tienda Cuba' },
    ];
    const prisma = { platformSetting: { findMany: jest.fn().mockResolvedValue(rows), update: jest.fn() } } as any;
    const service = new SettingsService(prisma);

    const result = await service.findAll();

    expect(result).toEqual({
      auto_approve_sellers: 'true',
      site_name: 'Tienda Cuba',
    });
  });

  it('update writes the new value and bumps updated_at', async () => {
    const updated = [{ key: 'site_name', value: 'Nueva Tienda', updated_at: new Date() }];
    const prisma = { platformSetting: { findMany: jest.fn(), update: jest.fn().mockResolvedValue(updated[0]) } } as any;
    const service = new SettingsService(prisma);

    await service.update({ key: 'site_name', value: 'Nueva Tienda' });

    expect(prisma.platformSetting.update).toHaveBeenCalledWith({
      where: { key: 'site_name' },
      data: { value: 'Nueva Tienda', updated_at: expect.any(Date) },
    });
  });
});
