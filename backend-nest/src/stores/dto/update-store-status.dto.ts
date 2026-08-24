import { IsIn } from 'class-validator';

export class UpdateStoreStatusDto {
  @IsIn(['pending', 'approved', 'rejected'], {
    message: 'El estado debe ser "pending", "approved" o "rejected"',
  })
  status: string;
}
