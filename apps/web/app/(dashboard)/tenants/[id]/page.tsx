import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ApiKeySection } from './api-key-section';
import type { TenantDto } from '@evalengine/types';

const planLabels: Record<string, string> = {
  FREE: '無料', STARTER: 'スターター', PROFESSIONAL: 'プロフェッショナル', ENTERPRISE: 'エンタープライズ',
};

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let tenant: TenantDto | null = null;
  let apiKeys: any[] = [];

  try {
    const [tenantRes, keysRes] = await Promise.all([
      apiClient.get(`/tenants/${params.id}`, token),
      apiClient.get('/api-keys', token),
    ]);
    tenant = tenantRes.data ?? tenantRes;
    apiKeys = keysRes.data ?? [];
  } catch {
    notFound();
  }

  if (!tenant) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/tenants" className="text-sm text-blue-600 hover:underline">← テナント一覧</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{tenant.name}</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
          <span>@{tenant.slug}</span>
          <span>•</span>
          <span>{planLabels[tenant.plan]}</span>
          <span>•</span>
          <span className={tenant.isActive ? 'text-green-600' : 'text-gray-400'}>
            {tenant.isActive ? '有効' : '停止中'}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* テナント情報 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">基本情報</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-32 text-gray-500">テナントID</dt>
              <dd className="font-mono text-gray-800 text-xs bg-gray-50 px-2 py-0.5 rounded">{tenant.id}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-gray-500">登録日</dt>
              <dd className="text-gray-800">{new Date(tenant.createdAt).toLocaleDateString('ja-JP')}</dd>
            </div>
          </dl>
        </div>

        {/* APIキー管理 */}
        <ApiKeySection tenantId={params.id} initialKeys={apiKeys} />
      </div>
    </div>
  );
}
