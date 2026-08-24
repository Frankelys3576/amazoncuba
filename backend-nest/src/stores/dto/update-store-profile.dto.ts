import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateStoreProfileDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'El eslogan debe ser texto' })
  slogan?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'El logo debe ser una URL de texto' })
  logo_url?: string;

  @IsOptional()
  @IsString({ message: 'El banner debe ser una URL de texto' })
  banner_url?: string;

  @IsOptional()
  @IsBoolean({ message: 'is_open debe ser verdadero o falso' })
  is_open?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'has_delivery debe ser verdadero o falso' })
  has_delivery?: boolean;

  @IsOptional()
  @IsString({ message: 'La hora de apertura debe ser texto' })
  opening_time?: string;

  @IsOptional()
  @IsString({ message: 'La hora de cierre debe ser texto' })
  closing_time?: string;

  @IsOptional()
  @IsIn(['business', 'hostal'], {
    message: 'El tipo de tienda debe ser "business" u "hostal"',
  })
  store_type?: string;

  @IsOptional()
  @IsString({ message: 'La provincia debe ser texto' })
  province?: string;

  @IsOptional()
  @IsString({ message: 'El municipio debe ser texto' })
  municipality?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  address?: string;

  @IsOptional()
  lat?: number;

  @IsOptional()
  lng?: number;

  @IsOptional()
  price_per_night?: number;

  @IsOptional()
  gallery?: string[];
}
