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

export async function createTenant(formData: FormData) {
  const token = await getToken();
  const body = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    plan: formData.get('plan') ?? 'FREE',
  };

  const res = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? '作成に失敗しました');
  }

  revalidatePath('/tenants');
  redirect('/tenants');
}

export async function updateTenant(id: string, data: { name?: string; plan?: string; isActive?: boolean }) {
  const token = await getToken();
  const res = await fetch(`${API}/tenants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '更新に失敗しました');
  }
  revalidatePath('/tenants');
  const json = await res.json();
  return json.data ?? json;
}

export async function deleteTenant(id: string) {
  const token = await getToken();
  const res = await fetch(`${API}/tenants/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '削除に失敗しました');
  }
  revalidatePath('/tenants');
}

export async function createApiKey(tenantId: string, formData: FormData) {
  const token = await getToken();
  const res = await fetch(`${API}/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: formData.get('name') }),
  });

  if (!res.ok) throw new Error('APIキーの作成に失敗しました');

  const json = await res.json();
  revalidatePath(`/tenants/${tenantId}`);
  return json.data;
}

export async function revokeApiKey(keyId: string, tenantId: string) {
  const token = await getToken();
  await fetch(`${API}/api-keys/${keyId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  revalidatePath(`/tenants/${tenantId}`);
}
