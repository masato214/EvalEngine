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

export async function createUser(data: {
  email: string;
  password: string;
  name?: string;
  role?: string;
}) {
  const token = await getToken();
  const res = await fetch(`${API}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'ユーザーの作成に失敗しました');
  }
  const json = await res.json();
  revalidatePath('/users');
  return json.data ?? json;
}

export async function updateUser(
  userId: string,
  data: { name?: string; role?: string; isActive?: boolean; password?: string },
) {
  const token = await getToken();
  const res = await fetch(`${API}/users/${userId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'ユーザーの更新に失敗しました');
  }
  const json = await res.json();
  revalidatePath('/users');
  return json.data ?? json;
}

export async function deleteUser(userId: string) {
  const token = await getToken();
  const res = await fetch(`${API}/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'ユーザーの削除に失敗しました');
  }
  revalidatePath('/users');
}
