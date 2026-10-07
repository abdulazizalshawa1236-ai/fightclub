import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { RuntimeConfig } from './core/config';
import { ApiErrorFilter } from './core/error-filter';
config({ path: resolve(process.cwd(), '.env'), quiet: true });
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const runtime = app.get(RuntimeConfig);
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    const webhook = req.path === '/api/whatsapp/webhook';
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !webhook &&
      req.headers.origin !== runtime.appOrigin
    ) {
      res.status(403).json({ code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' });
      return;
    }
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  await app.listen(runtime.port, runtime.development ? '127.0.0.1' : '0.0.0.0');
}
void bootstrap();
