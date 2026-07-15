export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  // API は同一プロジェクト (/pages/api/v1) に同居しているため、
  // ブラウザからは相対パスで到達できる
  if (typeof window !== 'undefined') return '/api/v1';
  // サーバーサイド (NextAuth の authorize/refresh) は絶対 URL が必要
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/v1`;
  return 'http://localhost:3001/api/v1';
}
