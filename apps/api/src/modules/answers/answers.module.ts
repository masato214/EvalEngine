import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';
import { QUEUE_NAMES } from '@evalengine/config';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.ANALYSIS })],
  controllers: [AnswersController],
  providers: [AnswersService],
  exports: [AnswersService],
})
export class AnswersModule {}
