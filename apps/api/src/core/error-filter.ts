import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import type { ActorRequest } from '../identity/sessions';
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const data = error.getResponse();
      response
        .status(error.getStatus())
        .json(typeof data === 'object' ? data : { code: 'REQUEST_FAILED', message: data });
      return;
    }
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      response
        .status(409)
        .json({ code: 'DUPLICATE_RECORD', message: 'A record with these details already exists.' });
      return;
    }
    const request = host.switchToHttp().getRequest<ActorRequest>();
    this.logger.error({
      event: 'request.failure',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      actorId: request.actor?.id,
      method: request.method,
      path: request.path,
    });
    response.status(503).json({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is unavailable. Please try again later.',
    });
  }
}
