import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AxesController } from './axes.controller';
import { AxesService } from './axes.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      headers: { 'x-internal-key': process.env.AI_INTERNAL_KEY ?? '' },
      timeout: 10000,
    }),
  ],
  controllers: [AxesController],
  providers: [AxesService],
  exports: [AxesService],
})
export class AxesModule {}
