import type { NextApiRequest, NextApiResponse } from 'next';
import { getServer } from '@evalengine/api/vercel-server';

/**
 * NestJS API を Next.js と同一プロジェクトで配信するための catch-all。
 * /api/v1/* へのリクエストをそのまま NestJS (Express) に委譲する。
 * ボディの解釈やレスポンス送信は NestJS 側が行う。
 */
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Next.js はルートパラメータ (path) を req.query に注入するが、
  // NestJS の ValidationPipe (forbidNonWhitelisted) がこれを拒否してしまう。
  // own property を消して Express 標準の URL ベースの query 解析に戻す。
  delete (req as { query?: unknown }).query;
  const server = await getServer();
  server(req, res);
}
