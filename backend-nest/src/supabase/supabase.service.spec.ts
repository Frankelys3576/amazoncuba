import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  // M7: without saving/restoring the pre-existing values, setting these env
  // vars in beforeAll leaks them into every other suite that runs in the
  // same jest worker for the rest of that worker's lifetime — a real .env
  // file for local/CI runs could already define different values, and this
  // suite would silently clobber them for everything that runs after it.
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterAll(() => {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });

  it('constructs a Supabase client exposing auth.admin and storage', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupabaseService],
    }).compile();

    const service = module.get<SupabaseService>(SupabaseService);
    expect(service.client.auth.admin).toBeDefined();
    expect(typeof service.client.storage.from).toBe('function');
  });
});
