import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AnalysisService } from './analysis.service';
import { AnalysisRunner } from './analysis.runner';
import { AnalysisDispatcher } from './analysis.dispatcher';
import { AnalysisController } from './analysis.controller';
import { getAiServiceUrl } from '../../common/config/runtime-config';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL: getAiServiceUrl(),
        headers: { 'x-internal-key': process.env.AI_INTERNAL_KEY ?? '' },
        timeout: 30000,
      }),
    }),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRunner, AnalysisDispatcher],
  exports: [AnalysisService, AnalysisDispatcher],
})
export class AnalysisModule {}
