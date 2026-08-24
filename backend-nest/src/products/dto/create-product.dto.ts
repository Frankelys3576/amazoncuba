import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  description?: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  price: number;

  @IsOptional()
  @IsNumber({}, { message: 'El precio en USD debe ser un número' })
  price_usd?: number;

  @IsOptional()
  @IsIn(['USD', 'CUP'], { message: 'La moneda debe ser "USD" o "CUP"' })
  currency?: string;

  @IsOptional()
  @IsInt({ message: 'El stock debe ser un número entero' })
  stock?: number;

  @IsOptional()
  @IsInt({ message: 'La categoría debe ser un número entero' })
  category_id?: number;

  @IsOptional()
  @IsInt({ message: 'La categoría de la tienda debe ser un número entero' })
  store_category_id?: number;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url?: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url_2?: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url_3?: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url_4?: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  image_url_5?: string;

  @IsInt({ message: 'La tienda debe ser un número entero' })
  store_id: number;

  @IsOptional()
  @IsString({ message: 'La provincia debe ser texto' })
  province?: string;

  @IsOptional()
  @IsString({ message: 'El municipio debe ser texto' })
  municipality?: string;

  @IsOptional()
  @IsArray({ message: 'Las zonas de entrega deben ser una lista' })
  delivery_locations?: string[];
}
