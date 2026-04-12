import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { CreateModelForm } from './create-model-form';
import Link from 'next/link';
import type { ProjectDto } from '@evalengine/types';

export default async function NewModelPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let projects: ProjectDto[] = [];
  try {
    const res = await apiClient.get('/projects', token);
    projects = res.data ?? [];
  } catch {}

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/evaluation-models" className="text-sm text-blue-600 hover:underline">← 評価モデル一覧</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">評価モデルを作成</h1>
        <p className="text-sm text-gray-500 mt-1">新しい評価・アセスメントモデルを定義します</p>
      </div>
      <CreateModelForm projects={projects} />
    </div>
  );
}
