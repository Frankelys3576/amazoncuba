import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateZelleInfoDto {
  @IsOptional()
  @IsBoolean({ message: 'accepts_zelle debe ser verdadero o falso' })
  accepts_zelle?: boolean;

  @IsOptional()
  @IsObject({ message: 'zelle_info debe ser un objeto' })
  zelle_info?: Record<string, unknown>;
}
