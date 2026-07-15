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
  const server = await getServer();
  server(req, res);
}
