'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getApiBaseUrl } from '@/lib/runtime-config';

const API = getApiBaseUrl();

async function getToken() {
  const session = await getServerSession(authOptions);
  return (session as any)?.accessToken ?? '';
}

export async function createApiKey(name: string) {
  const token = await getToken();
  const res = await fetch(`${API}/api-keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'APIキーの作成に失敗しました');
  }
  const json = await res.json();
  revalidatePath('/api-keys');
  revalidatePath('/portal/settings');
  return json.data ?? json;
}

export async function revokeApiKey(id: string) {
  const token = await getToken();
  const res = await fetch(`${API}/api-keys/${id}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'APIキーの無効化に失敗しました');
  }
  const json = await res.json();
  revalidatePath('/api-keys');
  revalidatePath('/portal/settings');
  return json.data ?? json;
}

export async function deleteApiKey(id: string) {
  const token = await getToken();
  const res = await fetch(`${API}/api-keys/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'APIキーの削除に失敗しました');
  }
  revalidatePath('/api-keys');
  revalidatePath('/portal/settings');
}
