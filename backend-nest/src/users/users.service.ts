import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const { data, error } =
      await this.supabaseService.client.auth.admin.listUsers();
    if (error) throw error;

    return data.users.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || 'Sin nombre',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed: !!user.email_confirmed_at,
    }));
  }

  async remove(id: string) {
    const { error } =
      await this.supabaseService.client.auth.admin.deleteUser(id);
    if (error) throw error;
    return { message: 'Usuario eliminado correctamente' };
  }

  async update(id: string, dto: UpdateUserDto) {
    if (!dto.email && !dto.password) {
      throw new BadRequestException(
        'Debe proporcionar un nuevo correo o contraseña.',
      );
    }

    const { data, error } =
      await this.supabaseService.client.auth.admin.updateUserById(id, dto);
    if (error) throw error;

    return { message: 'Usuario actualizado correctamente', user: data.user };
  }
}
