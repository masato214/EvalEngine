import { apiClient } from '@/lib/api-client';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function getStats(token: string) {
  try {
    const [projects, models, answers, results] = await Promise.all([
      apiClient.get('/projects?pageSize=1', token),
      apiClient.get('/evaluation-models?pageSize=1', token),
      apiClient.get('/answers?pageSize=1', token),
      apiClient.get('/results?pageSize=1', token),
    ]);
    return {
      projects: projects.meta?.total ?? 0,
      models: models.meta?.total ?? 0,
      answers: answers.meta?.total ?? 0,
      results: results.meta?.total ?? 0,
    };
  } catch {
    return { projects: 0, models: 0, answers: 0, results: 0 };
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';
  const stats = await getStats(token);

  const cards = [
    { label: 'プロジェクト数', value: stats.projects, color: 'bg-blue-50 text-blue-700' },
    { label: '評価モデル数', value: stats.models, color: 'bg-purple-50 text-purple-700' },
    { label: '回答受信数', value: stats.answers, color: 'bg-green-50 text-green-700' },
    { label: '分析結果数', value: stats.results, color: 'bg-orange-50 text-orange-700' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color.split(' ')[1]}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
