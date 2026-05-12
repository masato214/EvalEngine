import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AxesController } from './axes.controller';
import { AxesService } from './axes.service';
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
  controllers: [AxesController],
  providers: [AxesService],
  exports: [AxesService],
})
export class AxesModule {}
