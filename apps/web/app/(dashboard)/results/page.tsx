import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { ResultDto } from '@evalengine/types';

export default async function ResultsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let results: ResultDto[] = [];
  try {
    const res = await apiClient.get('/results', token);
    results = res.data ?? [];
  } catch {}

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">分析結果</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">回答者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">総合スコア</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">評価軸数</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">日付</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/results/${r.id}`} className="text-blue-600 hover:underline font-medium">
                    {r.respondentRef}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.round(r.overallScore * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-700 font-medium">
                      {Math.round(r.overallScore * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{r.scores?.length ?? 0} 軸</td>
                <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">分析結果がまだありません。</div>
        )}
      </div>
    </div>
  );
}
