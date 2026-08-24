import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('is defined and exposes the introspected models', () => {
    expect(service).toBeDefined();
    expect(typeof service.store.findMany).toBe('function');
    expect(typeof service.product.findMany).toBe('function');
  });
});
