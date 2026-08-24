import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

  // CRITICAL 1: the seller dashboard always sends store_id as a string
  // (SellerProducts.jsx reads it straight out of localStorage, never
  // parses it) — Express tolerated that because PostgREST coerces a
  // string to bigint on the way into Postgres. @Type(() => Number) mirrors
  // that tolerance by coercing a numeric string ('7') to a number before
  // @IsInt() validates it; a non-numeric string ('abc') becomes NaN, which
  // still fails @IsInt() as it must.
  @Type(() => Number)
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
