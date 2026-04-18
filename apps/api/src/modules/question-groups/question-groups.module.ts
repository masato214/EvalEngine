import { Module } from '@nestjs/common';
import { QuestionGroupsController } from './question-groups.controller';
import { QuestionGroupsService } from './question-groups.service';

@Module({
  controllers: [QuestionGroupsController],
  providers: [QuestionGroupsService],
  exports: [QuestionGroupsService],
})
export class QuestionGroupsModule {}
