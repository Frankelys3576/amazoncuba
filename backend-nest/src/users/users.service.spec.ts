import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const makeSupabase = (overrides: any) => ({
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
});
