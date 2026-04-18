import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Users, TrendingUp, Building2 } from 'lucide-react';

type PageProps = {
  searchParams?: { tenantId?: string };
};

export default async function PortalResultsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.role ?? '';
  const selectedTenantId = role === 'SUPER_ADMIN' ? searchParams?.tenantId : undefined;
  const tenantScope = selectedTenantId ? { tenantId: selectedTenantId } : undefined;

  let sessions: any[] = [];
  let results: any[] = [];
  let tenants: any[] = [];

  await Promise.all([
    apiClient.get('/sessions', token, tenantScope).then((r) => {
      const d = r.data ?? r;
      sessions = Array.isArray(d) ? d : [];
    }).catch(() => {}),
    apiClient.get('/results?pageSize=50', token, tenantScope).then((r) => {
      results = r.data ?? [];
    }).catch(() => {}),
    role === 'SUPER_ADMIN'
      ? apiClient.get('/tenants?pageSize=100', token).then((r) => { tenants = (r.data ?? []).filter((tenant: any) => tenant.id !== 'tenant-platform-admin'); }).catch(() => {})
      : Promise.resolve(),
  ]);

  const sessionStatusLabels: Record<string, string> = {
    STARTED: '受付中', ANSWERING: '回答中', ANALYZING: '分析中', COMPLETED: '完了', FAILED: 'エラー',
  };
  const sessionStatusColors: Record<string, string> = {
    STARTED: 'bg-green-100 text-green-700', ANSWERING: 'bg-blue-100 text-blue-700',
    ANALYZING: 'bg-yellow-100 text-yellow-700', COMPLETED: 'bg-purple-100 text-purple-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  const avgScore = results.length
    ? results.reduce((s, r) => s + r.overallScore, 0) / results.length
    : 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">結果・分析</h1>
        <p className="text-sm text-gray-500 mt-1">
          {selectedTenantId ? '選択中のクライアントのセッション状況と評価結果を確認できます' : 'セッション状況と評価結果を確認できます'}
        </p>
      </div>

      {role === 'SUPER_ADMIN' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
            <Building2 size={16} className="text-indigo-500" />
            クライアント表示
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portal/results"
              className={`rounded-lg px-3 py-2 text-xs border ${!selectedTenantId ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
            >
              全体
            </Link>
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/portal/results?tenantId=${encodeURIComponent(tenant.id)}`}
                className={`rounded-lg px-3 py-2 text-xs border ${
                  selectedTenantId === tenant.id ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tenant.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">総セッション数</p>
          <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">総結果数</p>
          <p className="text-2xl font-bold text-gray-900">{results.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">平均スコア</p>
          <p className="text-2xl font-bold text-gray-900">
            {results.length ? `${Math.round(avgScore * 100)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
            <Users size={15} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">セッション一覧</h2>
            <span className="ml-auto text-xs text-gray-400">{sessions.length}件</span>
          </div>
          {sessions.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">セッションがありません</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {sessions.slice(0, 20).map((s: any) => (
                <Link
                  key={s.id}
                  href={`/answers/${s.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.model?.name ?? 'モデル不明'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.userExternalId} · {new Date(s.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sessionStatusColors[s.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {sessionStatusLabels[s.status] ?? s.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
            <TrendingUp size={15} className="text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-800">スコア結果</h2>
            <span className="ml-auto text-xs text-gray-400">{results.length}件</span>
          </div>
          {results.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              結果がありません<br />
              <span className="text-xs">回答が分析されると結果が表示されます</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {results.map((r: any) => {
                const pct = Math.round(r.overallScore * 100);
                return (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.respondentRef}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
