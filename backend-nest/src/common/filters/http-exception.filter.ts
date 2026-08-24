import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      response.status(status).json({
        error: Array.isArray(message) ? message.join(', ') : message,
      });
      return;
    }

    console.error('Unhandled exception:', exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Error interno del servidor' });
  }
}
