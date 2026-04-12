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

export async function createEvaluationModel(formData: FormData) {
  const token = await getToken();

  const body = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    projectId: formData.get('projectId'),
  };

  const res = await fetch(`${API}/evaluation-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('評価モデルの作成に失敗しました');
  const json = await res.json();
  const modelId = json.data?.id ?? json.id;

  revalidatePath('/evaluation-models');
  redirect(`/evaluation-models/${modelId}`);
}

export async function createAxis(modelId: string, formData: FormData) {
  const token = await getToken();
  const body = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    weight: parseFloat((formData.get('weight') as string) ?? '1'),
    order: parseInt((formData.get('order') as string) ?? '0'),
  };

  const res = await fetch(`${API}/evaluation-models/${modelId}/axes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('評価軸の作成に失敗しました');
  revalidatePath(`/evaluation-models/${modelId}`);
}

export async function createQuestion(axisId: string, modelId: string, formData: FormData) {
  const token = await getToken();
  const type = formData.get('type') as string;

  const body: Record<string, unknown> = {
    text: formData.get('text'),
    type,
    required: true,
    order: parseInt((formData.get('order') as string) ?? '0'),
  };

  if (type === 'SCALE') {
    body.scaleMin = parseInt((formData.get('scaleMin') as string) ?? '1');
    body.scaleMax = parseInt((formData.get('scaleMax') as string) ?? '5');
    body.scaleMinLabel = formData.get('scaleMinLabel') || undefined;
    body.scaleMaxLabel = formData.get('scaleMaxLabel') || undefined;
  }

  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    const labels = formData.getAll('optionLabel') as string[];
    const values = formData.getAll('optionValue') as string[];
    const scores = formData.getAll('optionScore') as string[];
    body.options = labels.map((label, i) => ({
      label,
      value: values[i],
      score: parseFloat(scores[i] ?? '0.5'),
    }));
  }

  const res = await fetch(`${API}/axes/${axisId}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('質問の作成に失敗しました');
  revalidatePath(`/evaluation-models/${modelId}`);
}
