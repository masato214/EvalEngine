import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { Users, Calendar, ChevronRight, ClipboardList } from 'lucide-react';

const sessionStatusColors: Record<string, string> = {
  STARTED: 'bg-green-100 text-green-700',
  ANSWERING: 'bg-blue-100 text-blue-700',
  ANALYZING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-purple-100 text-purple-700',
  FAILED: 'bg-red-100 text-red-700',
};

const sessionStatusLabels: Record<string, string> = {
  STARTED: '受付中',
  ANSWERING: '回答中',
  ANALYZING: '分析中',
  COMPLETED: '完了',
  FAILED: 'エラー',
};

export default async function AnswersPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let sessions: any[] = [];
  try {
    const res = await apiClient.get('/sessions', token);
    sessions = res.data ?? res ?? [];
    if (!Array.isArray(sessions)) sessions = [];
  } catch {}

  // セッションをモデルでグループ化
  const grouped = sessions.reduce<Record<string, { modelName: string; modelId: string; sessions: any[] }>>(
    (acc, s) => {
      const modelId = s.modelId ?? 'unknown';
      const modelName = s.model?.name ?? 'モデル不明';
      if (!acc[modelId]) {
        acc[modelId] = { modelId, modelName, sessions: [] };
      }
      acc[modelId].sessions.push(s);
      return acc;
    },
    {},
  );

  const groupedList = Object.values(grouped);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">回答セッション</h1>
        <span className="text-sm text-gray-400">{sessions.length}件</span>
      </div>

      {groupedList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">回答セッションがまだありません</p>
          <p className="text-gray-400 text-xs mt-1">
            評価モデルを作成し、アンケートURLを配布すると回答が集まります
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedList.map(({ modelId, modelName, sessions: modelSessions }) => (
            <div key={modelId}>
              {/* モデル名ヘッダー */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-700">{modelName}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {modelSessions.length}セッション
                </span>
                <Link
                  href={`/evaluation-models/${modelId}`}
                  className="text-xs text-blue-500 hover:underline ml-auto"
                >
                  モデルを見る →
                </Link>
              </div>

              {/* セッションカード */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {modelSessions.map((s) => {
                  const statusInfo = sessionStatusLabels[s.status] ?? s.status;
                  const statusColor = sessionStatusColors[s.status] ?? 'bg-gray-100 text-gray-500';
                  const answerCount = s._count?.answers ?? 0;
                  const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleDateString('ja-JP') : '';

                  return (
                    <Link
                      key={s.id}
                      href={`/answers/${s.id}`}
                      className="block bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                          {statusInfo}
                        </span>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors mt-0.5" />
                      </div>

                      <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                        {s.name ?? `セッション ${s.id.slice(0, 8)}`}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {answerCount}件の回答
                        </span>
                        {createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {createdAt}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
