import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
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

  const config = new DocumentBuilder()
    .setTitle('EvalEngine API')
    .setDescription(`
## EvalEngine API ドキュメント

EvalEngine は、企業向けカスタム評価・分析エンジンです。

### 認証方式
- **JWT Bearer** — 管理ダッシュボードのログイン後に発行されるトークン。管理系エンドポイント（テナント・モデル管理など）に使用します。
- **X-Api-Key** — テナントごとに発行するAPIキー。外部アプリからの回答送信に使用します。

### 主なリソース
| リソース | 説明 |
|---|---|
| tenants | クライアント企業（テナント）の管理 |
| projects | テナント内のプロジェクト管理 |
| evaluation-models | 評価モデル（軸・質問・出力形式）の管理 |
| sessions | 回答セッションの管理・配信グループ |
| answers | 回答の送信・取得 |
| results | スコア結果の取得 |
| api-keys | APIキーの発行・無効化 |
| users | ユーザー管理 |

### 外部アプリからの回答送信フロー
1. テナント管理画面でAPIキーを発行
2. 評価モデルを \`PUBLISHED\` 状態に設定
3. \`POST /api/v1/answers\` に \`X-Api-Key\` ヘッダーをつけて送信
4. \`GET /api/v1/results\` でスコア結果を取得
    `)
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: '管理者用JWTトークン（ログイン後に取得）' },
      'bearer',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header', description: '外部アプリ用APIキー（テナント管理画面で発行）' },
      'api-key',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: 1,
      docExpansion: 'list',
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'EvalEngine API ドキュメント',
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`EvalEngine API running on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
