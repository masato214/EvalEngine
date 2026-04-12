import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TestClient } from './test-client';

export default async function ModelTestPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let model: any = null;
  try {
    const res = await apiClient.get(`/evaluation-models/${params.id}`, token);
    model = res.data ?? res;
  } catch {
    notFound();
  }
  if (!model) notFound();

  // Flatten all questions from axis tree
  function flattenQuestions(axes: any[]): any[] {
    const questions: any[] = [];
    function walk(axis: any, breadcrumb: string[]) {
      const crumb = [...breadcrumb, axis.name];
      if (axis.mappings?.length) {
        for (const m of axis.mappings) {
          if (m.question) {
            questions.push({ ...m.question, axisBreadcrumb: crumb, axisId: axis.id, axisName: axis.name });
          }
        }
      }
      if (axis.children?.length) {
        for (const child of axis.children) walk(child, crumb);
      }
    }
    for (const axis of axes) walk(axis, []);
    // Deduplicate by questionId
    const seen = new Set<string>();
    return questions.filter((q) => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });
  }

  const questions = flattenQuestions(model.axes ?? []);
  const outputFormats = model.outputFormats ?? [];

  return (
    <div>
      <div className="mb-6">
        <Link href={`/evaluation-models/${model.id}`} className="text-sm text-blue-600 hover:underline">
          ← {model.name} へ戻る
        </Link>
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">テスト実行</h1>
            <p className="text-sm text-gray-500 mt-1">
              実際の質問に回答してスコアリング結果を確認できます。OpenAI Embeddingとコサイン類似度による本番同等の精度で評価します。本番データには影響しません。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
              AIスコアリング
            </span>
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">質問がまだ登録されていません。</p>
          <p className="text-gray-400 text-xs mt-1">評価軸にリーフ軸を追加し、質問を設定してください。</p>
          <Link
            href={`/evaluation-models/${model.id}`}
            className="inline-block mt-4 text-sm text-blue-600 hover:underline"
          >
            評価モデルの設定へ →
          </Link>
        </div>
      ) : (
        <TestClient modelId={model.id} questions={questions} outputFormats={outputFormats} />
      )}
    </div>
  );
}
