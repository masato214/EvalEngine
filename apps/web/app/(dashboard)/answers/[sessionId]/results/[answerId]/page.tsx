import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart2, Calendar, User } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';

const answerStatusLabels: Record<string, string> = {
  PENDING: '待機中',
  PROCESSING: '分析中',
  COMPLETED: '完了',
  FAILED: 'エラー',
};

const answerStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (value == null || value === '') return '未回答';
  return String(value);
}

export default async function AnswerDetailPage({
  params,
}: {
  params: { sessionId: string; answerId: string };
}) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let sessionData: any = null;
  try {
    const res = await apiClient.get(`/sessions/${params.sessionId}`, token);
    sessionData = res.data ?? res;
  } catch {
    notFound();
  }

  const answer = (sessionData?.answers ?? []).find((item: any) => item.id === params.answerId);
  if (!answer) notFound();

  const resultId = answer.results?.[0]?.id ?? answer.result?.id ?? answer.analysisResult?.id ?? null;
  let result: any = answer.results?.[0] ?? answer.result ?? answer.analysisResult ?? null;
  if (resultId) {
    try {
      const res = await apiClient.get(`/results/${resultId}`, token);
      result = res.data ?? res;
    } catch {
      result = answer.results?.[0] ?? null;
    }
  }

  const statusLabel = answerStatusLabels[answer.status] ?? answer.status;
  const statusColor = answerStatusColors[answer.status] ?? 'bg-gray-100 text-gray-600';

  return (
    <div>
      <div className="mb-6">
        <Link href={`/answers/${params.sessionId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} />
          セッション詳細へ戻る
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {answer.respondentRef ?? `回答 ${params.answerId.slice(0, 8)}`}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <User size={12} />
                回答ID: {params.answerId}
              </span>
              {answer.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(answer.createdAt).toLocaleString('ja-JP')}
                </span>
              )}
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">回答内容</h2>
          </div>
          {answer.items?.length ? (
            <div className="divide-y divide-gray-50">
              {answer.items.map((item: any, index: number) => (
                <div key={item.id ?? `${item.questionId}-${index}`} className="px-5 py-4">
                  <p className="text-xs text-gray-400 mb-1">
                    Q{index + 1} / {item.questionId}
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                    {formatValue(item.value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              回答項目がありません
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">分析結果</h2>
            {result ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400">総合スコア</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Math.round(result.overallScore * 100)}%
                  </p>
                </div>
                <Link
                  href={`/results/${result.id ?? resultId}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <BarChart2 size={14} />
                  分析結果詳細を開く
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                まだ分析結果がありません。分析中または分析エラーの可能性があります。
              </p>
            )}
          </div>

          {answer.respondentMeta && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">回答者メタ情報</h2>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                {JSON.stringify(answer.respondentMeta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
