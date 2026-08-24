import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El correo debe ser válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @IsString({ message: 'El nombre completo debe ser texto' })
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  full_name: string;

  @IsOptional()
  @IsString({ message: 'El nombre de la tienda debe ser texto' })
  store_name?: string;

  @IsOptional()
  @IsIn(['business', 'hostal'], {
    message: 'El tipo de tienda debe ser "business" u "hostal"',
  })
  store_type?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'La provincia debe ser texto' })
  province?: string;

  @IsOptional()
  @IsString({ message: 'El municipio debe ser texto' })
  municipality?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  address?: string;

  // The frontends send these as strings (coordinates are .toString()'d,
  // price_per_night comes from an <input type="number">, which React holds
  // as a string) — AuthService coerces them with parseFloat, mirroring
  // Express. No format validation here: the goal is an honest declared
  // type, not a new constraint that would reject the current payloads.
  @IsOptional()
  lat?: string | number;

  @IsOptional()
  lng?: string | number;

  @IsOptional()
  price_per_night?: string | number;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  description?: string;
}
