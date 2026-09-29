import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadService } from './upload.service';

// PNG 1x1 real y válido -- desde que uploadImage() procesa el buffer con
// sharp() antes de subirlo (para comprimir/redimensionar), un buffer falso
// como Buffer.from('fake') ya no sirve para estas pruebas: sharp lo
// rechazaría por no ser una imagen decodificable.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR42mP4z8AARAwQCgAf7gP9Y167WwAAAABJRU5ErkJggg==',
  'base64',
);

describe('UploadService', () => {
  const makeSupabase = (uploadResult: any, publicUrl: string) => {
    const upload = jest.fn().mockResolvedValue(uploadResult);
    return {
      supabase: {
        client: {
          storage: {
            from: () => ({
              upload,
              getPublicUrl: () => ({ data: { publicUrl } }),
            }),
          },
        },
      } as any,
      upload,
    };
  };

  it('uploads the compressed buffer as WebP and returns the public URL', async () => {
    const { supabase, upload } = makeSupabase(
      { data: {}, error: null },
      'https://cdn.example/store-images/x.webp',
    );
    const service = new UploadService(supabase);

    const result = await service.uploadImage({
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: ONE_PX_PNG,
    } as Express.Multer.File);

    expect(result).toEqual({
      url: 'https://cdn.example/store-images/x.webp',
      message: 'Imagen subida correctamente',
    });

    // El archivo que sube a Supabase debe ser el WebP recomprimido, no el
    // PNG original -- Finding: el propósito entero de este cambio (subida
    // más liviana para conexiones lentas) se rompe silenciosamente si
    // alguien vuelve a pasar file.buffer directo por error.
    const [filename, uploadedBuffer, options] = upload.mock.calls[0];
    expect(filename).toMatch(/\.webp$/);
    expect(options).toMatchObject({ contentType: 'image/webp' });
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
    expect(uploadedBuffer.equals(ONE_PX_PNG)).toBe(false);
  });

  it('throws BadRequestException when no file is provided', async () => {
    const { supabase } = makeSupabase({}, '');
    const service = new UploadService(supabase);
    await expect(service.uploadImage(undefined as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws BadRequestException when the buffer is not a decodable image', async () => {
    const { supabase } = makeSupabase({}, '');
    const service = new UploadService(supabase);
    const file = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('not actually an image'),
    } as Express.Multer.File;

    await expect(service.uploadImage(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws InternalServerErrorException when the Supabase upload fails', async () => {
    const { supabase } = makeSupabase(
      { data: null, error: { message: 'bucket unreachable' } },
      '',
    );
    const service = new UploadService(supabase);
    const file = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: ONE_PX_PNG,
    } as Express.Multer.File;

    await expect(service.uploadImage(file)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    await expect(service.uploadImage(file)).rejects.toThrow(
      'Error al subir imagen al servidor cloud',
    );
  });
});
