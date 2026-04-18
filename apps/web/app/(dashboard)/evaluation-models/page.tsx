import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { EvaluationModelDto } from '@evalengine/types';
import { Building2, FolderOpen, Brain, FlaskConical, ArrowRight } from 'lucide-react';

export default async function ModelsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let models: EvaluationModelDto[] = [];
  try {
    const res = await apiClient.get('/evaluation-models?pageSize=100', token);
    models = res.data ?? [];
  } catch {}

  const grouped = (models as any[]).reduce<Record<string, { tenant: any; projects: Record<string, { project: any; models: any[] }> }>>(
    (acc, model) => {
      const tenant = model.tenant ?? { id: model.tenantId, name: model.tenantId ?? 'テナント不明' };
      const project = model.project ?? { id: model.projectId, name: model.projectId ?? 'プロジェクト不明' };
      if (!acc[tenant.id]) acc[tenant.id] = { tenant, projects: {} };
      if (!acc[tenant.id].projects[project.id]) acc[tenant.id].projects[project.id] = { project, models: [] };
      acc[tenant.id].projects[project.id].models.push(model);
      return acc;
    },
    {},
  );
  const tenantGroups = Object.values(grouped);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">評価モデル</h1>
          <p className="text-sm text-gray-500 mt-1">クライアント、プロジェクトごとに評価モデルを確認します</p>
        </div>
        <Link
          href="/evaluation-models/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          新規作成
        </Link>
      </div>

      {tenantGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">
          評価モデルがまだありません。
        </div>
      ) : (
        <div className="space-y-8">
          {tenantGroups.map(({ tenant, projects }) => (
            <section key={tenant.id}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={17} className="text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900">{tenant.name}</h2>
              </div>
              <div className="space-y-4">
                {Object.values(projects).map(({ project, models: projectModels }) => (
                  <div key={project.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <FolderOpen size={15} className="text-gray-500" />
                      <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-gray-800 hover:underline">
                        {project.name}
                      </Link>
                      <span className="ml-auto text-xs text-gray-400">{projectModels.length}モデル</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {projectModels.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <Brain size={16} className="text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Link href={`/evaluation-models/${model.id}`} className="font-medium text-blue-600 hover:underline truncate block">
                              {model.name}
                            </Link>
                            {model.description && <p className="text-xs text-gray-400 truncate">{model.description}</p>}
                          </div>
                          <span className="text-xs text-gray-500">v{model.version}</span>
                          <span className="text-xs text-gray-400">{model._count?.axes ?? 0}軸</span>
                          <span className="text-xs text-gray-400">{new Date(model.createdAt).toLocaleDateString('ja-JP')}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              href={`/evaluation-models/${model.id}/test`}
                              className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <FlaskConical size={12} />
                              テスト
                            </Link>
                            <Link
                              href={`/evaluation-models/${model.id}`}
                              className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              編集
                              <ArrowRight size={12} />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
