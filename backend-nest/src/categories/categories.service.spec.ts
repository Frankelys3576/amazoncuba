import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  it('returns all categories ordered by id ascending', async () => {
    const categories = [{ id: 1, name: 'Comida' }, { id: 2, name: 'Ropa' }];
    const prisma = {
      category: { findMany: jest.fn().mockResolvedValue(categories) },
    } as any;

    const service = new CategoriesService(prisma);
    const result = await service.findAll();

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
    expect(result).toEqual(categories);
  });
});
