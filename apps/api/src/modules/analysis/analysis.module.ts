import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { AnalysisService } from './analysis.service';
import { AnalysisProcessor } from './analysis.processor';
import { QUEUE_NAMES } from '@evalengine/config';
import { getAiServiceUrl } from '../../common/config/runtime-config';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.ANALYSIS }),
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL: getAiServiceUrl(),
        headers: { 'x-internal-key': process.env.AI_INTERNAL_KEY ?? '' },
        timeout: 30000,
      }),
    }),
  ],
  providers: [AnalysisService, AnalysisProcessor],
  exports: [AnalysisService],
})
export class AnalysisModule {}
