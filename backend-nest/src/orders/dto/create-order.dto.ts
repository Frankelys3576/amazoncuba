import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  // Product ids are uuid v7 strings post-migration.
  @IsUUID(undefined, { message: 'El producto debe ser un identificador UUID' })
  product_id: string;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  quantity: number;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  price: number;
}

export class CreateOrderDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  customer_name: string;

  // orders.customer_email is NOT NULL with no default in the real DB
  // (confirmed via information_schema.columns in Task 2's introspection).
  // Express's createOrder never validated this, so a request without it
  // previously failed with a raw Postgres constraint-violation 500;
  // requiring it here instead produces a clean 400 from the ValidationPipe.
  @IsString({ message: 'El correo debe ser texto' })
  @IsNotEmpty({ message: 'El correo es requerido' })
  customer_email: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  customer_address?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  customer_phone?: string;

  @IsOptional()
  @IsIn(['cash_on_delivery', 'zelle', 'transfer'], {
    message:
      'El método de pago debe ser "cash_on_delivery", "zelle" o "transfer"',
  })
  payment_method?: string;

  @IsOptional()
  @IsString({ message: 'El comprobante de pago debe ser una URL de texto' })
  payment_proof_url?: string;

  @IsArray({ message: 'Los artículos deben ser una lista' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
