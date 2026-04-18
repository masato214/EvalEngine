import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Brain, FlaskConical, ArrowRight, Plus, Building2 } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-gray-100 text-gray-500' },
  REVIEW: { label: 'レビュー中', color: 'bg-yellow-100 text-yellow-700' },
  PUBLISHED: { label: '公開中', color: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'アーカイブ', color: 'bg-red-100 text-red-600' },
};

type PageProps = {
  searchParams?: { tenantId?: string };
};

export default async function PortalModelsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.role ?? '';
  const selectedTenantId = role === 'SUPER_ADMIN' ? searchParams?.tenantId : undefined;
  const tenantScope = selectedTenantId ? { tenantId: selectedTenantId } : undefined;

  let models: any[] = [];
  let tenants: any[] = [];
  try {
    const res = await apiClient.get('/evaluation-models?pageSize=100', token, tenantScope);
    models = res.data ?? [];
  } catch {}
  if (role === 'SUPER_ADMIN') {
    try {
      const res = await apiClient.get('/tenants?pageSize=100', token);
      tenants = (res.data ?? []).filter((tenant: any) => tenant.id !== 'tenant-platform-admin');
    } catch {}
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">評価モデル</h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedTenantId ? '選択中のクライアントの評価軸・質問・出力形式を管理します' : '評価軸・質問・出力形式を管理します'}
          </p>
        </div>
        <Link
          href="/evaluation-models/new"
          className={`flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 ${role === 'SUPER_ADMIN' ? '' : 'hidden'}`}
        >
          <Plus size={15} />
          新規作成
        </Link>
      </div>

      {role === 'SUPER_ADMIN' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
            <Building2 size={16} className="text-indigo-500" />
            クライアント表示
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portal/models"
              className={`rounded-lg px-3 py-2 text-xs border ${!selectedTenantId ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
            >
              全体
            </Link>
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/portal/models?tenantId=${encodeURIComponent(tenant.id)}`}
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

      {models.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Brain size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">評価モデルがありません</p>
          {role === 'SUPER_ADMIN' && (
            <Link href="/evaluation-models/new" className="text-indigo-600 text-sm hover:underline mt-2 inline-block">
              最初の評価モデルを作成 →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {models.map((m) => {
            const s = STATUS_MAP[m.status] ?? { label: m.status, color: 'bg-gray-100 text-gray-500' };
            const axisCount = m._count?.axes ?? 0;
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Brain size={18} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{m.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                      <span className="text-xs text-gray-400">v{m.version}</span>
                    </div>
                    {m.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{m.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {axisCount > 0 && <span>{axisCount} 評価軸</span>}
                      <span>{new Date(m.createdAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  {role === 'SUPER_ADMIN' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/evaluation-models/${m.id}/test`}
                        className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <FlaskConical size={12} />
                        テスト
                      </Link>
                      <Link
                        href={`/evaluation-models/${m.id}`}
                        className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        編集
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
