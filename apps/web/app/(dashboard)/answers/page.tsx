import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { Users, Calendar, ChevronRight, ClipboardList, Building2, FolderOpen, Brain } from 'lucide-react';

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

function respondentNameFrom(value: any) {
  const latestAnswer = value?.answers?.[0];
  return latestAnswer?.respondentMeta?.name
    ?? latestAnswer?.respondentRef
    ?? value?.userExternalId
    ?? null;
}

export default async function AnswersPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let sessions: any[] = [];
  try {
    const res = await apiClient.get('/sessions', token);
    sessions = res.data ?? res ?? [];
    if (!Array.isArray(sessions)) sessions = [];
  } catch {}

  const grouped = sessions.reduce<Record<string, { tenant: any; projects: Record<string, { project: any; models: Record<string, { model: any; sessions: any[] }> }> }>>(
    (acc, s) => {
      const tenant = s.tenant ?? { id: s.tenantId, name: s.tenantId ?? 'テナント不明' };
      const project = s.model?.project ?? { id: s.model?.projectId ?? 'unknown', name: 'プロジェクト不明' };
      const model = s.model ?? { id: s.modelId ?? 'unknown', name: 'モデル不明' };
      if (!acc[tenant.id]) acc[tenant.id] = { tenant, projects: {} };
      if (!acc[tenant.id].projects[project.id]) acc[tenant.id].projects[project.id] = { project, models: {} };
      if (!acc[tenant.id].projects[project.id].models[model.id]) acc[tenant.id].projects[project.id].models[model.id] = { model, sessions: [] };
      acc[tenant.id].projects[project.id].models[model.id].sessions.push(s);
      return acc;
    },
    {},
  );

  const tenantGroups = Object.values(grouped);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">回答一覧</h1>
          <p className="text-sm text-gray-500 mt-1">クライアント、プロジェクト、評価モデルごとに回答を確認します</p>
        </div>
        <span className="text-sm text-gray-400">{sessions.length}件</span>
      </div>

      {tenantGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">回答セッションがまだありません</p>
          <p className="text-gray-400 text-xs mt-1">
            評価モデルを作成し、アンケートURLを配布すると回答が集まります
          </p>
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
                  <div key={project.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <FolderOpen size={15} className="text-gray-500" />
                      <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-gray-800 hover:underline">
                        {project.name}
                      </Link>
                    </div>
                    <div className="space-y-5">
                      {Object.values(models).map(({ model, sessions: modelSessions }) => (
                        <div key={model.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <Brain size={14} className="text-blue-400" />
                            <Link href={`/evaluation-models/${model.id}`} className="text-sm font-semibold text-gray-700 hover:underline">
                              {model.name}
                            </Link>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {modelSessions.length}セッション
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {modelSessions.map((s) => {
                              const statusInfo = sessionStatusLabels[s.status] ?? s.status;
                              const statusColor = sessionStatusColors[s.status] ?? 'bg-gray-100 text-gray-500';
                              const answerCount = s._count?.answers ?? 0;
                              const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleDateString('ja-JP') : '';
                              const respondentName = respondentNameFrom(s);
                              return (
                                <Link
                                  key={s.id}
                                  href={`/answers/${s.id}`}
                                  className="block border border-gray-100 rounded-lg p-4 hover:border-blue-200 transition-colors group"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                      {statusInfo}
                                    </span>
                                    <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors mt-0.5" />
                                  </div>
                                  <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                                    {respondentName ?? `セッション ${s.id.slice(0, 8)}`}
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
