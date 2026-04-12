import { Module } from '@nestjs/common';
import { OutputFormatsController } from './output-formats.controller';
import { OutputFormatsService } from './output-formats.service';

@Module({
  controllers: [OutputFormatsController],
  providers: [OutputFormatsService],
  exports: [OutputFormatsService],
})
export class OutputFormatsModule {}
