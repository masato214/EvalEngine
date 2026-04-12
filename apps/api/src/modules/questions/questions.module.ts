import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      headers: { 'x-internal-key': process.env.AI_INTERNAL_KEY ?? '' },
      timeout: 10000,
    }),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
