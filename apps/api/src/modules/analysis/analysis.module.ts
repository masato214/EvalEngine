import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { AnalysisService } from './analysis.service';
import { AnalysisProcessor } from './analysis.processor';
import { QUEUE_NAMES } from '@evalengine/config';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.ANALYSIS }),
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
        headers: { 'x-internal-key': process.env.AI_INTERNAL_KEY ?? '' },
        timeout: 30000,
      }),
    }),
  ],
  providers: [AnalysisService, AnalysisProcessor],
  exports: [AnalysisService],
})
export class AnalysisModule {}
