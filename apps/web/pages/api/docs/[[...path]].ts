import type { NextApiRequest, NextApiResponse } from 'next';
import { getServer } from '@evalengine/api/vercel-server';

/**
 * Swagger UI (/api/docs) を NestJS 側に委譲する。
 * API 本体 (/api/v1/*) とは別パスのため専用の catch-all が必要。
 */
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  delete (req as { query?: unknown }).query;
  const server = await getServer();
  server(req, res);
}
