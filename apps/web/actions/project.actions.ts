'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function getToken() {
  const session = await getServerSession(authOptions);
  return (session as any)?.accessToken ?? '';
}

export async function createProject(formData: FormData) {
  const token = await getToken();

  const body = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  };

  const res = await fetch(`${API}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'プロジェクトの作成に失敗しました');
  }

  revalidatePath('/projects');
  redirect('/projects');
}

export async function updateProject(id: string, data: { name?: string; description?: string }) {
  const token = await getToken();
  const res = await fetch(`${API}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '更新に失敗しました');
  }
  revalidatePath('/projects');
  const json = await res.json();
  return json.data ?? json;
}

export async function deleteProject(id: string) {
  const token = await getToken();
  const res = await fetch(`${API}/projects/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '削除に失敗しました');
  }
  revalidatePath('/projects');
}
