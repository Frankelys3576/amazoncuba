import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import sharp from 'sharp';
import { SupabaseService } from '../supabase/supabase.service';

// 1600px de lado más largo alcanza y sobra para cómo se usan estas fotos
// (banner ancho, logo circular, miniaturas de producto) -- una foto de
// cámara de celular sin tocar suele venir en 3000-4000px, mucho más peso
// del que cualquiera de esos usos necesita. La conexión lenta en Cuba es la
// razón de este límite, no un tope arbitrario.
const MAX_DIMENSION_PX = 1600;
const WEBP_QUALITY = 78;

@Injectable()
export class UploadService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No se subió ninguna imagen o formato inválido',
      );
    }

    // .rotate() sin argumentos lee la orientación EXIF (una foto de celular
    // "de lado" según los píxeles crudos, marcada para rotarse al mostrar) y
    // gira los píxeles de una vez -- si no, WebP no necesariamente conserva
    // ese metadato y la foto saldría girada donde se muestre.
    //
    // WebP en vez de conservar el formato original: comprime bastante mejor
    // que JPEG al mismo nivel de calidad visual, y a diferencia de JPEG
    // todavía soporta transparencia (importa para logos en PNG). Todos los
    // navegadores que visitan este sitio lo soportan hace años.
    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(file.buffer)
        .rotate()
        .resize({
          width: MAX_DIMENSION_PX,
          height: MAX_DIMENSION_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch (err) {
      console.error('sharp failed to process uploaded image:', err);
      throw new BadRequestException(
        'No se pudo procesar la imagen -- verifica que el archivo no esté dañado',
      );
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `${uniqueSuffix}.webp`;

    const { error } = await this.supabaseService.client.storage
      .from('store-images')
      .upload(filename, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        'Error al subir imagen al servidor cloud',
      );
    }

    const {
      data: { publicUrl },
    } = this.supabaseService.client.storage
      .from('store-images')
      .getPublicUrl(filename);

    return { url: publicUrl, message: 'Imagen subida correctamente' };
  }
}
