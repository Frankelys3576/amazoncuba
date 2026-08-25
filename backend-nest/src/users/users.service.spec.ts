import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const makeSupabase = (overrides: any) =>
    ({
      client: { auth: { admin: overrides } },
    }) as any;

  // auth.admin.getUserById stubs: una cuenta normal, la cuenta de
  // administrador, y un id que no existe.
  const plainAccount = jest.fn().mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'seller' } } },
    error: null,
  });
  const adminAccount = jest.fn().mockResolvedValue({
    data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } },
    error: null,
  });
  const missingAccount = jest.fn().mockResolvedValue({
    data: { user: null },
    error: { message: 'User not found' },
  });

  it('findAll maps Supabase auth users into the API shape', async () => {
    const supabase = makeSupabase({
      listUsers: jest.fn().mockResolvedValue({
        data: {
          users: [
            {
              id: 'u1',
              email: '5551234@cubaamazon.com',
              user_metadata: { full_name: 'Juan Pérez' },
              created_at: '2026-01-01T00:00:00Z',
              last_sign_in_at: '2026-02-01T00:00:00Z',
              email_confirmed_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
        error: null,
      }),
    });
    const service = new UsersService(supabase);

    const result = await service.findAll();

    expect(result).toEqual([
      {
        id: 'u1',
        email: '5551234@cubaamazon.com',
        full_name: 'Juan Pérez',
        created_at: '2026-01-01T00:00:00Z',
        last_sign_in_at: '2026-02-01T00:00:00Z',
        email_confirmed: true,
      },
    ]);
  });

  it('update throws BadRequestException when neither email nor password is provided', async () => {
    const supabase = makeSupabase({ updateUserById: jest.fn() });
    const service = new UsersService(supabase);

    await expect(service.update('u1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update omits an explicit null email from the Supabase payload, keeping only the password', async () => {
    const updateUserById = jest
      .fn()
      .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const supabase = makeSupabase({ updateUserById, getUserById: plainAccount });
    const service = new UsersService(supabase);

    await service.update('u1', {
      email: null as any,
      password: 'newpassword',
    });

    expect(updateUserById).toHaveBeenCalledWith('u1', {
      password: 'newpassword',
    });
  });

  it('update omits an explicit null password from the Supabase payload, keeping only the email', async () => {
    const updateUserById = jest
      .fn()
      .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const supabase = makeSupabase({ updateUserById, getUserById: plainAccount });
    const service = new UsersService(supabase);

    await service.update('u1', {
      email: 'new@cubaamazon.com',
      password: null as any,
    });

    expect(updateUserById).toHaveBeenCalledWith('u1', {
      email: 'new@cubaamazon.com',
    });
  });

  it('update throws BadRequestException when both email and password are explicitly null, without calling Supabase', async () => {
    const updateUserById = jest.fn();
    const supabase = makeSupabase({ updateUserById });
    const service = new UsersService(supabase);

    await expect(
      service.update('u1', { email: null as any, password: null as any }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  // Bloqueo de autoexclusión. Sólo existe UNA cuenta de administrador y no
  // hay ninguna otra capaz de devolver el acceso, así que las rutas de
  // usuarios no pueden tocarla. Cada uno de estos casos falla si se quita la
  // llamada a rejectIfAdminAccount: no sólo por el código de error, también
  // porque comprueban que la operación destructiva NUNCA llega a Supabase.
  describe('self-lockout guard: la cuenta de administrador es intocable', () => {
    it('remove sobre la cuenta de administrador lanza 403 y no llama a deleteUser', async () => {
      const deleteUser = jest.fn();
      const supabase = makeSupabase({ deleteUser, getUserById: adminAccount });
      const service = new UsersService(supabase);

      await expect(service.remove('admin-1')).rejects.toThrow(
        new ForbiddenException(
          'No se puede modificar ni eliminar una cuenta de administrador',
        ),
      );
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('update sobre la cuenta de administrador lanza 403 y no llama a updateUserById', async () => {
      const updateUserById = jest.fn();
      const supabase = makeSupabase({
        updateUserById,
        getUserById: adminAccount,
      });
      const service = new UsersService(supabase);

      await expect(
        service.update('admin-1', { password: 'otra-contrasena' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'No se puede modificar ni eliminar una cuenta de administrador',
        ),
      );
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('remove sobre un id inexistente lanza 404, no 200', async () => {
      const deleteUser = jest.fn();
      const supabase = makeSupabase({ deleteUser, getUserById: missingAccount });
      const service = new UsersService(supabase);

      await expect(service.remove('no-existe')).rejects.toThrow(
        new NotFoundException('Usuario no encontrado'),
      );
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('update sobre un id inexistente lanza 404', async () => {
      const updateUserById = jest.fn();
      const supabase = makeSupabase({
        updateUserById,
        getUserById: missingAccount,
      });
      const service = new UsersService(supabase);

      await expect(
        service.update('no-existe', { email: 'x@cubaamazon.com' }),
      ).rejects.toThrow(new NotFoundException('Usuario no encontrado'));
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('remove sobre una cuenta normal sigue borrando', async () => {
      const deleteUser = jest.fn().mockResolvedValue({ error: null });
      const supabase = makeSupabase({ deleteUser, getUserById: plainAccount });
      const service = new UsersService(supabase);

      await expect(service.remove('u1')).resolves.toEqual({
        message: 'Usuario eliminado correctamente',
      });
      expect(deleteUser).toHaveBeenCalledWith('u1');
    });
  });
});
