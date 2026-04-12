import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { PortalSidebar } from '@/components/layout/portal-sidebar';
import { Header } from '@/components/layout/header';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.role ?? '';

  // Fetch tenant info to display name
  let tenantName = '';
  try {
    const tenantId = (session as any)?.tenantId ?? '';
    if (tenantId) {
      const res = await apiClient.get(`/tenants/${tenantId}`, token);
      tenantName = (res.data ?? res)?.name ?? '';
    }
  } catch {}

  return (
    <div className="flex h-screen">
      <PortalSidebar tenantName={tenantName} role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
