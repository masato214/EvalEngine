import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { ProjectDto } from '@evalengine/types';
import { Building2, FolderOpen } from 'lucide-react';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let projects: ProjectDto[] = [];
  try {
    const res = await apiClient.get('/projects?pageSize=100', token);
    projects = res.data ?? [];
  } catch {}

  const grouped = (projects as any[]).reduce<Record<string, { tenant: any; projects: any[] }>>((acc, project) => {
    const tenant = project.tenant ?? { id: project.tenantId, name: project.tenantId ?? 'テナント不明' };
    if (!acc[tenant.id]) acc[tenant.id] = { tenant, projects: [] };
    acc[tenant.id].projects.push(project);
    return acc;
  }, {});
  const tenantGroups = Object.values(grouped);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">プロジェクト</h1>
          <p className="text-sm text-gray-500 mt-1">クライアントごとにプロジェクトを確認します</p>
        </div>
        <Link
          href="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          新規作成
        </Link>
      </div>

      {tenantGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">
          プロジェクトがまだありません。
        </div>
      ) : (
        <div className="space-y-8">
          {tenantGroups.map(({ tenant, projects: tenantProjects }) => (
            <section key={tenant.id}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={17} className="text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900">{tenant.name}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {tenantProjects.length}プロジェクト
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tenantProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <FolderOpen size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                        {project.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{project.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                      <span>{project._count?.evaluationModels ?? 0} 評価モデル</span>
                      <span>{new Date(project.createdAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
