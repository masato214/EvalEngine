import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { ResultDto } from '@evalengine/types';
import { Building2, FolderOpen, Brain } from 'lucide-react';

export default async function ResultsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let results: ResultDto[] = [];
  try {
    const res = await apiClient.get('/results?pageSize=100', token);
    results = res.data ?? [];
  } catch {}

  const grouped = (results as any[]).reduce<Record<string, { tenant: any; projects: Record<string, { project: any; models: Record<string, { model: any; results: any[] }> }> }>>(
    (acc, result) => {
      const tenant = result.tenant ?? { id: result.tenantId, name: result.tenantId ?? 'テナント不明' };
      const project = result.model?.project ?? { id: result.model?.projectId ?? 'unknown', name: 'プロジェクト不明' };
      const model = result.model ?? { id: result.modelId ?? 'unknown', name: 'モデル不明' };
      if (!acc[tenant.id]) acc[tenant.id] = { tenant, projects: {} };
      if (!acc[tenant.id].projects[project.id]) acc[tenant.id].projects[project.id] = { project, models: {} };
      if (!acc[tenant.id].projects[project.id].models[model.id]) acc[tenant.id].projects[project.id].models[model.id] = { model, results: [] };
      acc[tenant.id].projects[project.id].models[model.id].results.push(result);
      return acc;
    },
    {},
  );
  const tenantGroups = Object.values(grouped);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">分析結果</h1>
          <p className="text-sm text-gray-500 mt-1">クライアント、プロジェクト、評価モデルごとに分析結果を確認します</p>
        </div>
        <span className="text-sm text-gray-400">{results.length}件</span>
      </div>

      {tenantGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">
          分析結果がまだありません。
        </div>
      ) : (
        <div className="space-y-8">
          {tenantGroups.map(({ tenant, projects }) => (
            <section key={tenant.id}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={17} className="text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900">{tenant.name}</h2>
              </div>
              <div className="space-y-5">
                {Object.values(projects).map(({ project, models }) => (
                  <div key={project.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <FolderOpen size={15} className="text-gray-500" />
                      <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-gray-800 hover:underline">
                        {project.name}
                      </Link>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {Object.values(models).map(({ model, results: modelResults }) => (
                        <div key={model.id} className="p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Brain size={14} className="text-blue-400" />
                            <Link href={`/evaluation-models/${model.id}`} className="text-sm font-semibold text-gray-700 hover:underline">
                              {model.name}
                            </Link>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {modelResults.length}件
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {modelResults.map((r) => (
                                <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                                  <td className="px-3 py-3">
                                    <Link href={`/results/${r.id}`} className="text-blue-600 hover:underline font-medium">
                                      {r.respondentRef}
                                    </Link>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-blue-500 rounded-full"
                                          style={{ width: `${Math.round(r.overallScore * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-gray-700 font-medium">
                                        {Math.round(r.overallScore * 100)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-gray-500">{r.scores?.length ?? 0} 軸</td>
                                  <td className="px-3 py-3 text-gray-500 text-right">{new Date(r.createdAt).toLocaleDateString('ja-JP')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
