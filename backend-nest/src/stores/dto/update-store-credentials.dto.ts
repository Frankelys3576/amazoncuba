import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateStoreCredentialsDto {
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;
}
