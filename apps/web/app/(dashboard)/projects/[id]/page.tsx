import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import Link from 'next/link';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'text-gray-500 bg-gray-100' },
  REVIEW: { label: 'レビュー中', color: 'text-yellow-700 bg-yellow-100' },
  PUBLISHED: { label: '公開中', color: 'text-green-700 bg-green-100' },
  ARCHIVED: { label: 'アーカイブ', color: 'text-red-700 bg-red-100' },
};

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let project: any = null;

  try {
    const res = await apiClient.get(`/projects/${params.id}`, token);
    project = res.data ?? res;
  } catch {
    notFound();
  }

  if (!project) notFound();

  const evaluationModels: any[] = project.evaluationModels ?? [];

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          ← プロジェクト一覧
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-500 mt-1">{project.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              作成日: {new Date(project.createdAt).toLocaleDateString('ja-JP')}
            </p>
          </div>
          <Link
            href={`/evaluation-models/new?projectId=${project.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex-shrink-0"
          >
            新規評価モデル作成
          </Link>
        </div>
      </div>

      {/* 評価モデル一覧 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          評価モデル
          <span className="ml-2 text-sm font-normal text-gray-400">
            {evaluationModels.length}件
          </span>
        </h2>

        {evaluationModels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluationModels.map((m: any) => {
              const status = STATUS_LABELS[m.status] ?? {
                label: m.status,
                color: 'text-gray-500 bg-gray-100',
              };
              return (
                <Link
                  key={m.id}
                  href={`/evaluation-models/${m.id}`}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 truncate flex-1 mr-2">
                      {m.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {m.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{m.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <span>Version {m.version}</span>
                    <span>•</span>
                    <span>{new Date(m.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-gray-400 text-sm">評価モデルがまだ作成されていません</p>
            <p className="text-gray-400 text-xs mt-1">
              右上の「新規評価モデル作成」から最初のモデルを作成してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
