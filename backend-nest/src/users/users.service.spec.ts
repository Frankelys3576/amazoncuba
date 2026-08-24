import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const makeSupabase = (overrides: any) =>
    ({
      client: { auth: { admin: overrides } },
    }) as any;

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
    const supabase = makeSupabase({ updateUserById });
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
    const supabase = makeSupabase({ updateUserById });
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
});
