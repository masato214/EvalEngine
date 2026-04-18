import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import { ScoreRadar } from '@/components/charts/score-radar';
import type { ResultDto } from '@evalengine/types';

const TENDENCY_LABELS: Record<string, string> = {
  very_high: '非常に高い',
  high: '高い',
  moderate: '普通',
  low: '低い',
  very_low: '非常に低い',
};

function respondentNameFrom(result: any) {
  return result?.respondentName ?? result?.answer?.respondentMeta?.name ?? result?.respondentRef;
}

function RubricBadge({ level }: { level: number | null }) {
  if (level == null) return null;
  const rounded = Math.round(level * 10) / 10;
  const color =
    rounded >= 4.5 ? 'bg-green-100 text-green-700' :
    rounded >= 3.5 ? 'bg-blue-100 text-blue-700' :
    rounded >= 2.5 ? 'bg-yellow-100 text-yellow-700' :
    rounded >= 1.5 ? 'bg-orange-100 text-orange-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      Lv {rounded}
    </span>
  );
}

export default async function ResultDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let result: ResultDto | null = null;
  try {
    const res = await apiClient.get(`/results/${params.id}`, token);
    result = (res as any).data ?? res;
  } catch {
    notFound();
  }

  if (!result) notFound();

  const radarData = result.scores?.map((s) => ({
    axis: s.axisName,
    score: Math.round(s.normalizedScore * 100),
  })) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{respondentNameFrom(result)}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-gray-600 font-medium">
            総合スコア: {Math.round(result.overallScore * 100)}%
          </span>
          {result.resultType && (
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {result.resultType}
            </span>
          )}
          {!result.isLatest && (
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
              過去バージョン
            </span>
          )}
          <span className="text-xs text-gray-400">v{result.modelVersion}</span>
        </div>
        {result.typeDetails && (result.typeDetails as any).description && (
          <p className="text-sm text-gray-600 mt-2 bg-blue-50 rounded-lg px-4 py-2">
            {(result.typeDetails as any).description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* レーダーチャート */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">評価軸スコア</h2>
          {radarData.length > 0 ? (
            <ScoreRadar data={radarData} />
          ) : (
            <p className="text-gray-400 text-sm">スコアデータがありません。</p>
          )}
        </div>

        <div className="space-y-4">
          {/* 軸別スコア内訳 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">軸別スコア内訳</h2>
            <div className="space-y-4">
              {result.scores?.map((s) => (
                <div key={s.axisId}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-700 font-medium">{s.axisName}</span>
                    <div className="flex items-center gap-2">
                      <RubricBadge level={s.rubricLevel} />
                      <span className="font-semibold text-gray-900">
                        {Math.round(s.normalizedScore * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(s.normalizedScore * 100)}%`,
                        backgroundColor:
                          s.normalizedScore >= 0.8 ? '#22c55e' :
                          s.normalizedScore >= 0.6 ? '#3b82f6' :
                          s.normalizedScore >= 0.4 ? '#eab308' :
                          '#f97316',
                      }}
                    />
                  </div>
                  {s.tendency && (
                    <p className="text-xs text-gray-400 mt-1">
                      {TENDENCY_LABELS[s.tendency] ?? s.tendency}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI説明文（LLMが数値を文章化） */}
          {result.explanation && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-2">評価コメント</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{result.explanation}</p>
            </div>
          )}

          {/* サマリー */}
          {result.summary && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-2">サマリー</h2>
              <p className="text-sm text-gray-600">{result.summary}</p>
            </div>
          )}

          {/* 推奨アクション */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-2">推奨アクション</h2>
              <ul className="list-disc list-inside space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-600">{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
