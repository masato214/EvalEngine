import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { ApiKeysClient } from './api-keys-client';

export default async function ApiKeysPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let apiKeys: any[] = [];
  try {
    const res = await apiClient.get('/api-keys', token);
    apiKeys = res.data ?? res ?? [];
    if (!Array.isArray(apiKeys)) apiKeys = [];
  } catch {}

  return <ApiKeysClient initialKeys={apiKeys} />;
}
