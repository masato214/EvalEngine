import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { UsersClient } from './users-client';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let users: any[] = [];
  try {
    const res = await apiClient.get('/users', token);
    users = res.data ?? [];
  } catch {}

  const tenantId = (session as any)?.tenantId ?? '';
  return <UsersClient initialUsers={users} tenantId={tenantId} />;
}
