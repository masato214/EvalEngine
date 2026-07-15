import { Injectable, Logger } from '@nestjs/common';
import { AnalysisRunner } from './analysis.runner';

/**
 * 回答の分析ジョブをバックグラウンド実行に投げる。
 * BullMQ/Redis の代替。Vercel 上では waitUntil でレスポンス返却後も
 * 処理を継続させ、非対応環境ではそのまま非同期実行する。
 * 実行が中断された場合は analysis sweep (cron) が拾い直す。
 */
@Injectable()
export class AnalysisDispatcher {
  private readonly logger = new Logger(AnalysisDispatcher.name);

  constructor(private runner: AnalysisRunner) {}

  dispatch(answerId: string, tenantId: string): void {
    const task = this.runner.run({ answerId, tenantId }).catch((err) => {
      this.logger.error(`Analysis failed for answer ${answerId}: ${err}`);
    });
    void this.keepAlive(task);
  }

  private async keepAlive(task: Promise<unknown>): Promise<void> {
    try {
      const { waitUntil } = await import('@vercel/functions');
      waitUntil(task);
    } catch {
      // Vercel 以外の環境では waitUntil は不要 (プロセスが生き続けるため)
    }
  }
}
