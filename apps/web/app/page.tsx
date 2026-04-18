import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = (session as any)?.role;
  if (role === 'SUPER_ADMIN') redirect('/dashboard');
  redirect('/portal');
}
