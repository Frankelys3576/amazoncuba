import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  // Sólo hay una cuenta de administrador. Si se borra o se le cambia la
  // contraseña desde el propio panel, no queda ninguna otra cuenta capaz de
  // devolver el acceso: la pérdida es definitiva. Por eso las rutas de
  // usuarios se niegan a tocar una cuenta con rol de administrador.
  //
  // Espejo de rejectIfAdminAccount en
  // backend/src/controllers/user.controller.js: mismos códigos y mismos
  // mensajes, incluido el 404 para un id que no existe (borrar algo
  // inexistente no debe responder 200 como si hubiera borrado algo).
  private async rejectIfAdminAccount(id: string): Promise<void> {
    const { data, error } =
      await this.supabaseService.client.auth.admin.getUserById(id);

    if (error || !data || !data.user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const appMetadata = data.user.app_metadata as { role?: string } | null;
    if (appMetadata && appMetadata.role === 'admin') {
      throw new ForbiddenException(
        'No se puede modificar ni eliminar una cuenta de administrador',
      );
    }
  }

  async remove(id: string) {
    await this.rejectIfAdminAccount(id);

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

    await this.rejectIfAdminAccount(id);

    const updates: { email?: string; password?: string } = {};
    if (dto.email) updates.email = dto.email;
    if (dto.password) updates.password = dto.password;

    const { data, error } =
      await this.supabaseService.client.auth.admin.updateUserById(id, updates);
    if (error) throw error;

    return { message: 'Usuario actualizado correctamente', user: data.user };
  }
}
