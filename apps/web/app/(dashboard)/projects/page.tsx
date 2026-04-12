import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import type { ProjectDto } from '@evalengine/types';
import { ProjectsClient } from './projects-client';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let projects: ProjectDto[] = [];
  try {
    const res = await apiClient.get('/projects', token);
    projects = res.data ?? [];
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロジェクト</h1>
        <Link
          href="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          新規作成
        </Link>
      </div>

      <ProjectsClient initialProjects={projects as any} />
    </div>
  );
}
