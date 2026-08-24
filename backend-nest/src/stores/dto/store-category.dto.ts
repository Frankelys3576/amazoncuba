import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStoreCategoryDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url?: string;
}

export class UpdateStoreCategoryDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url?: string;
}
