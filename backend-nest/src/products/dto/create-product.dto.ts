import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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
  @IsUUID(undefined, { message: 'La categoría debe ser un identificador UUID' })
  category_id?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'La categoría de la tienda debe ser un identificador UUID' })
  store_category_id?: string;

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

  // CRITICAL 1: the seller dashboard always sends store_id as a string
  // (SellerProducts.jsx reads it straight out of localStorage). Store ids
  // are uuid v7 strings post-migration, so no numeric coercion is needed —
  // @IsUUID rejects anything that isn't uuid-shaped (e.g. 'abc') with 400,
  // same as the old @IsInt did for non-numeric strings.
  @IsUUID(undefined, { message: 'La tienda debe ser un identificador UUID' })
  store_id: string;

  @IsOptional()
  @IsString({ message: 'La provincia debe ser texto' })
  province?: string;

  @IsOptional()
  @IsString({ message: 'El municipio debe ser texto' })
  municipality?: string;

  @IsOptional()
  @IsArray({ message: 'Las zonas de entrega deben ser una lista' })
  delivery_locations?: string[];

  // CRITICAL 2: SellerProducts.jsx's "destacar producto" toggle PUTs
  // { is_featured: !product.is_featured }. Without this field on the DTO,
  // whitelist:true strips it before it ever reaches Prisma, so the toggle
  // silently no-ops (200 response, unchanged flag). Deliberately NOT adding
  // rating_avg/review_count here — see IMPORTANT finding 2's ruling: those
  // are server-computed aggregates and closing that forgery hole is an
  // intentional, recorded divergence from Express's blanket passthrough.
  @IsOptional()
  @IsBoolean({ message: 'El campo destacado debe ser verdadero o falso' })
  is_featured?: boolean;
}
