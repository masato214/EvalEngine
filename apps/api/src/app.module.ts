import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { EvaluationModelsModule } from './modules/evaluation-models/evaluation-models.module';
import { AxesModule } from './modules/axes/axes.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { AnswersModule } from './modules/answers/answers.module';
import { ResultsModule } from './modules/results/results.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { OutputFormatsModule } from './modules/output-formats/output-formats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ApiKeysModule,
    ProjectsModule,
    EvaluationModelsModule,
    AxesModule,
    QuestionsModule,
    AnswersModule,
    SessionsModule,
    ResultsModule,
    AnalysisModule,
    OutputFormatsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
