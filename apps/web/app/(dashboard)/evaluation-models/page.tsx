import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { EvaluationModelDto } from '@evalengine/types';

export default async function ModelsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let models: EvaluationModelDto[] = [];
  try {
    const res = await apiClient.get('/evaluation-models', token);
    models = res.data ?? [];
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">評価モデル</h1>
        <Link
          href="/evaluation-models/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          新規作成
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">モデル名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">バージョン</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">状態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">作成日</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/evaluation-models/${m.id}`} className="text-blue-600 hover:underline font-medium">
                    {m.name}
                  </Link>
                  {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">v{m.version}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.isActive ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {models.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">評価モデルがまだありません。</div>
        )}
      </div>
    </div>
  );
}
