import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductReviewDto {
  @IsString({ message: 'El nombre del cliente debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  customer_name: string;

  @IsInt({ message: 'La calificación debe ser un número entero' })
  @Min(1, { message: 'La calificación debe ser al menos 1' })
  @Max(5, { message: 'La calificación debe ser como máximo 5' })
  rating: number;

  @IsOptional()
  @IsString({ message: 'El comentario debe ser texto' })
  @MaxLength(1000, { message: 'El comentario no puede superar los 1000 caracteres' })
  comment?: string;
}
