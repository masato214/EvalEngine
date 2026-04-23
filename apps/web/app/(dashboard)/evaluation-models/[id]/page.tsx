import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { ModelDetailTabs } from './model-detail-tabs';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'text-gray-500 bg-gray-100' },
  REVIEW: { label: 'レビュー中', color: 'text-yellow-700 bg-yellow-100' },
  PUBLISHED: { label: '公開中', color: 'text-green-700 bg-green-100' },
  ARCHIVED: { label: 'アーカイブ', color: 'text-red-700 bg-red-100' },
};

export default async function ModelDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let model: any = null;
  let responseExportOptions: any = { dates: [], questionGroups: [], baseColumns: [] };

  try {
    const res = await apiClient.get(`/evaluation-models/${params.id}`, token);
    model = res.data ?? res;
  } catch {
    notFound();
  }

  try {
    const res = await apiClient.get(`/evaluation-models/${params.id}/responses/export-options`, token);
    responseExportOptions = res.data ?? res ?? responseExportOptions;
  } catch {}

  if (!model) notFound();

  const status = STATUS_LABELS[model.status] ?? { label: model.status, color: 'text-gray-500 bg-gray-100' };
  const projectId = model.projectId;
  const outputFormats = model.outputFormats ?? [];
  const questionGroups = model.questionGroups ?? [];

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-6">
        {projectId ? (
          <Link href={`/projects/${projectId}`} className="text-sm text-blue-600 hover:underline">
            ← プロジェクトへ戻る
          </Link>
        ) : (
          <Link href="/evaluation-models" className="text-sm text-blue-600 hover:underline">
            ← 評価モデル一覧
          </Link>
        )}
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
            {model.description && <p className="text-gray-500 mt-1">{model.description}</p>}
            <div className="flex gap-3 mt-2 text-sm items-center">
              <span className="text-gray-400">Version {model.version}</span>
              <span className="text-gray-300">•</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
          <Link
            href={`/evaluation-models/${model.id}/test`}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <FlaskConical size={15} />
            テスト実行
          </Link>
        </div>
      </div>

      {/* タブコンテンツ */}
      <ModelDetailTabs
        modelId={model.id}
        axes={model.axes ?? []}
        outputFormats={outputFormats}
        questionGroups={questionGroups}
        model={model}
        responseExportOptions={responseExportOptions}
      />
    </div>
  );
}
