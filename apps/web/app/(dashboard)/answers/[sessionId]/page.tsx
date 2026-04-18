import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import { ArrowLeft, User, Calendar, BarChart2 } from 'lucide-react';
import { SessionLinkPanel } from './session-link-panel';

const answerStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const answerStatusLabels: Record<string, string> = {
  PENDING: '待機中',
  PROCESSING: '分析中',
  COMPLETED: '完了',
  FAILED: 'エラー',
};

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

function respondentNameFrom(answer: any) {
  return answer?.respondentMeta?.name
    ?? answer?.respondentRef
    ?? answer?.respondentId
    ?? null;
}

export default async function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let sessionData: any = null;
  try {
    const res = await apiClient.get(`/sessions/${params.sessionId}`, token);
    sessionData = res.data ?? res;
  } catch {
    notFound();
  }

  if (!sessionData) notFound();

  const answers: any[] = sessionData.answers ?? [];
  const model = sessionData.model ?? null;
  const sessionStatus = sessionData.status ?? '';
  const statusLabel = sessionStatusLabels[sessionStatus] ?? sessionStatus;
  const statusColor = sessionStatusColors[sessionStatus] ?? 'bg-gray-100 text-gray-500';

  // Fetch API keys for link generation
  let apiKeys: any[] = [];
  try {
    const res = await apiClient.get('/api-keys', token);
    apiKeys = (res.data ?? res ?? []).filter((k: any) => k.isActive);
  } catch {}

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/answers" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} />
          回答セッション一覧
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {sessionData.name ?? `セッション ${params.sessionId.slice(0, 8)}`}
            </h1>
            {model && (
              <p className="text-sm text-gray-500 mt-1">
                評価モデル:{' '}
                <Link href={`/evaluation-models/${model.id}`} className="text-blue-600 hover:underline">
                  {model.name}
                </Link>
              </p>
            )}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* セッション情報 */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          {sessionData.createdAt && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              作成: {new Date(sessionData.createdAt).toLocaleString('ja-JP')}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User size={12} />
            {answers.length}件の回答
          </span>
        </div>
      </div>

      {/* 回答URLパネル */}
      <SessionLinkPanel sessionId={params.sessionId} apiKeys={apiKeys} />

      {/* 回答一覧 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">回答一覧</h2>
        </div>

        {answers.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            まだ回答がありません
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {answers.map((answer: any, i: number) => {
              const aStatusLabel = answerStatusLabels[answer.status] ?? answer.status;
              const aStatusColor = answerStatusColors[answer.status] ?? 'bg-gray-100 text-gray-500';
              const hasResult = answer.result ?? answer.analysisResult ?? answer.results?.length;

              return (
                <div
                  key={answer.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-400 w-6 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {respondentNameFrom(answer) ?? `回答者 ${answer.id.slice(0, 8)}`}
                    </p>
                    {answer.createdAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(answer.createdAt).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${aStatusColor}`}>
                    {aStatusLabel}
                  </span>
                  {hasResult && (
                    <Link
                      href={`/answers/${params.sessionId}/results/${answer.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 flex-shrink-0"
                    >
                      <BarChart2 size={13} />
                      分析結果
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
