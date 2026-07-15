import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  setupSwagger(app);

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`EvalEngine API running on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
