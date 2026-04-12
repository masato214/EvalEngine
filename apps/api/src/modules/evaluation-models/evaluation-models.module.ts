import { Module } from '@nestjs/common';
import { EvaluationModelsController } from './evaluation-models.controller';
import { EvaluationModelsService } from './evaluation-models.service';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [AnalysisModule],
  controllers: [EvaluationModelsController],
  providers: [EvaluationModelsService],
  exports: [EvaluationModelsService],
})
export class EvaluationModelsModule {}
