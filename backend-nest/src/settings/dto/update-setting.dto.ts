import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingDto {
  @IsString({ message: 'La clave debe ser texto' })
  @IsNotEmpty({ message: 'La clave es requerida' })
  key: string;

  @IsString({ message: 'El valor debe ser texto' })
  value: string;
}
