import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisDispatcher } from './analysis.dispatcher';

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10分以上更新のない処理中回答を再実行
const SWEEP_BATCH_SIZE = 10;

/**
 * Vercel Cron から定期的に呼ばれ、実行が中断されたままの
 * 分析ジョブ (PENDING / PROCESSING で止まっている回答) を拾い直す。
 */
@ApiExcludeController()
@Controller('analysis')
export class AnalysisController {
  constructor(
    private prisma: PrismaService,
    private dispatcher: AnalysisDispatcher,
  ) {}

  @Get('sweep')
  async sweep(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }

    const staleBefore = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const stuck = await this.prisma.answer.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        updatedAt: { lt: staleBefore },
      },
      select: { id: true, tenantId: true },
      orderBy: { updatedAt: 'asc' },
      take: SWEEP_BATCH_SIZE,
    });

    for (const answer of stuck) {
      this.dispatcher.dispatch(answer.id, answer.tenantId);
    }

    return { requeued: stuck.length };
  }
}
