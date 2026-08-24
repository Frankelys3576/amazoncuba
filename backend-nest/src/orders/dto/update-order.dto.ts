import { IsIn } from 'class-validator';

export class UpdateOrderDto {
  @IsIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], {
    message:
      'El estado debe ser "pending", "confirmed", "shipped", "delivered" o "cancelled"',
  })
  status: string;
}
