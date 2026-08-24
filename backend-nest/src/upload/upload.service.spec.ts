import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  const makeSupabase = (uploadResult: any, publicUrl: string) =>
    ({
      client: {
        storage: {
          from: () => ({
            upload: jest.fn().mockResolvedValue(uploadResult),
            getPublicUrl: () => ({ data: { publicUrl } }),
          }),
        },
      },
    }) as any;

  it('uploads the file buffer and returns the public URL', async () => {
    const supabase = makeSupabase(
      { data: {}, error: null },
      'https://cdn.example/store-images/x.png',
    );
    const service = new UploadService(supabase);

    const result = await service.uploadImage({
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('fake'),
    } as Express.Multer.File);

    expect(result).toEqual({
      url: 'https://cdn.example/store-images/x.png',
      message: 'Imagen subida correctamente',
    });
  });

  it('throws BadRequestException when no file is provided', async () => {
    const service = new UploadService(makeSupabase({}, ''));
    await expect(service.uploadImage(undefined as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws InternalServerErrorException when the Supabase upload fails', async () => {
    const supabase = makeSupabase(
      { data: null, error: { message: 'bucket unreachable' } },
      '',
    );
    const service = new UploadService(supabase);
    const file = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('fake'),
    } as Express.Multer.File;

    await expect(service.uploadImage(file)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    await expect(service.uploadImage(file)).rejects.toThrow(
      'Error al subir imagen al servidor cloud',
    );
  });
});
