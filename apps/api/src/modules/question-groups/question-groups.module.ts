import { Module } from '@nestjs/common';
import { QuestionGroupsController, TenantQuestionGroupsController } from './question-groups.controller';
import { QuestionGroupsService } from './question-groups.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QuestionGroupsController, TenantQuestionGroupsController],
  providers: [QuestionGroupsService],
  exports: [QuestionGroupsService],
})
export class QuestionGroupsModule {}
