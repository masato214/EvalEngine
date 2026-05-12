import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { getAiServiceUrl } from '../../common/config/runtime-config';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL: getAiServiceUrl(),
        headers: { 'x-internal-key': process.env.AI_INTERNAL_KEY ?? '' },
        timeout: 10000,
      }),
    }),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
