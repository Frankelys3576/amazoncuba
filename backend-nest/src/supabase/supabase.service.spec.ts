import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
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
