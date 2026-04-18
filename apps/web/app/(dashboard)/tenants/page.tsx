import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { TenantDto } from '@evalengine/types';
import { TenantsClient } from './tenants-client';

export default async function TenantsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let tenants: TenantDto[] = [];
  try {
    const res = await apiClient.get('/tenants?pageSize=100', token);
    tenants = (res.data ?? []).filter((tenant: any) => tenant.id !== 'tenant-platform-admin');
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">テナント管理</h1>
          <p className="text-sm text-gray-500 mt-1">クライアント企業の一覧・管理</p>
        </div>
        <Link
          href="/tenants/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          新規テナント作成
        </Link>
      </div>

      <TenantsClient initialTenants={tenants as any} />
    </div>
  );
}
