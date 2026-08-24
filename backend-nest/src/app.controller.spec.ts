import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('getRoot returns the welcome message', () => {
    expect(controller.getRoot()).toEqual({
      message: 'Bienvenido al backend de la Tienda Virtual Cuba (NestJS)',
    });
  });

  it('getHealth returns status OK with an ISO timestamp', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('OK');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
