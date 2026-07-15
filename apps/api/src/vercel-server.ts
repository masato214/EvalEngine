import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

let cachedServer: Express | null = null;

/**
 * Vercel Functions 用の NestJS ブートストラップ。
 * main.ts と同じ構成 (helmet / CORS / prefix / pipes / filters / interceptors) を
 * Express インスタンスに適用し、インスタンスを跨いでキャッシュする。
 */
export async function getServer(): Promise<Express> {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });

  app.use(helmet());
  app.enableCors({
    // ALLOWED_ORIGINS 未設定時は全オリジン許可 (リフレクト)。
    // この API は Bearer/API キー認証で Cookie を使わないため、
    // テナントの外部アプリ (moon-shot 等) がブラウザから直接呼べる必要がある。
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  setupSwagger(app, { useCdnAssets: true });

  await app.init();
  cachedServer = expressApp;
  return cachedServer;
}
