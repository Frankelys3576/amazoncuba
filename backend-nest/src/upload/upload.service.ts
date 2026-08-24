import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { extname } from 'path';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UploadService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No se subió ninguna imagen o formato inválido',
      );
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `${uniqueSuffix}${extname(file.originalname)}`;

    const { error } = await this.supabaseService.client.storage
      .from('store-images')
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
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
