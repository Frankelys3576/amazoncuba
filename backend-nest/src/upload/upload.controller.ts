import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UploadService } from './upload.service';

@Controller('api/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // ThrottlerGuard runs before FileInterceptor in Nest's request lifecycle
  // (guards, then interceptors), so a rejected request never buffers the
  // upload into memory — mirrors the ordering in backend/src/routes/upload.routes.js.
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60 * 60 * 1000 } })
  @UseInterceptors(
    FileInterceptor('image', {
      // 4MB, no 5: Vercel rechaza el cuerpo de la petición con 413
      // FUNCTION_PAYLOAD_TOO_LARGE alrededor de 4.5MB, antes de que este
      // límite de Multer llegue a evaluarse -- confirmado en vivo con una
      // imagen de 4.8MB, que falla igual yendo directo a esta función que
      // por el proxy de www.amasoncubano.com (ninguno de los dos era la
      // causa; el techo real es la función misma). 4MB deja margen real.
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes en formato PNG o JPG',
            ),
            false,
          );
        }
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file);
  }
}
