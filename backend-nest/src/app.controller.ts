import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot(): { message: string } {
    return { message: 'Bienvenido al backend de la Tienda Virtual Cuba (NestJS)' };
  }

  @Get('api/health')
  getHealth(): { status: string; timestamp: string } {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }
}
