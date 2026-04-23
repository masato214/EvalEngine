'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const AI_SERVICE = process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000';
const AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY ?? '';

async function getToken() {
  const session = await getServerSession(authOptions);
  return (session as any)?.accessToken ?? '';
}

// 評価軸を作成
export async function createAxis(
  modelId: string,
  data: {
    name: string;
    description?: string;
    weight?: number;
    parentId?: string;
    idealStateText?: string;
    lowStateText?: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/axes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '軸の作成に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

// 評価基準（ルーブリックレベル）を保存
export async function saveRubricLevel(
  modelId: string,
  axisId: string,
  data: {
    level: number;
    label: string;
    description: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/axes/${axisId}/rubric-levels`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '評価基準の保存に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

// 質問を作成（オプション・軸マッピングも含む）
export async function createQuestion(
  modelId: string,
  axisMappings: { axisId: string; contributionWeight: number }[],
  data: {
    text: string;
    type: string;
    required?: boolean;
    scaleMin?: number;
    scaleMax?: number;
    scaleMinLabel?: string;
    scaleMaxLabel?: string;
    options?: { label: string; value: string; text?: string }[];
  },
) {
  const token = await getToken();

  const { options, ...questionData } = data;

  // 1. 質問を作成
  const qRes = await fetch(`${API}/evaluation-models/${modelId}/questions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(questionData),
  });
  if (!qRes.ok) {
    const err = await qRes.json().catch(() => ({ message: qRes.statusText }));
    throw new Error(err.message ?? '質問の作成に失敗しました');
  }
  const qJson = await qRes.json();
  const questionId: string = (qJson.data ?? qJson).id;

  // 2. 選択肢を登録
  if (options && options.length > 0) {
    const validOptions = options.filter((o) => o.label.trim() && o.value.trim());
    for (let i = 0; i < validOptions.length; i++) {
      const o = validOptions[i];
      await fetch(`${API}/evaluation-models/${modelId}/questions/${questionId}/options`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: o.label, value: o.value, text: o.text || o.label, order: i }),
      });
    }
  }

  // 3. 軸マッピングを登録（複数軸対応）
  for (const mapping of axisMappings) {
    await fetch(`${API}/evaluation-models/${modelId}/questions/${questionId}/axis-mappings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ axisId: mapping.axisId, contributionWeight: mapping.contributionWeight }),
    });
  }

  revalidatePath(`/evaluation-models/${modelId}`);
  return qJson.data ?? qJson;
}

// 軸マッピングを追加または更新
export async function upsertAxisMapping(
  modelId: string,
  questionId: string,
  axisId: string,
  contributionWeight: number = 1.0,
) {
  const token = await getToken();
  const res = await fetch(
    `${API}/evaluation-models/${modelId}/questions/${questionId}/axis-mappings`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ axisId, contributionWeight }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '軸マッピングの保存に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
  const json = await res.json();
  return json.data ?? json;
}

// 軸マッピングを削除
export async function removeAxisMapping(
  modelId: string,
  questionId: string,
  axisId: string,
) {
  const token = await getToken();
  const res = await fetch(
    `${API}/evaluation-models/${modelId}/questions/${questionId}/axis-mappings/${axisId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '軸マッピングの削除に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
}

// AI質問文圧縮提案（複数の評価軸 → 1問に凝縮）
export async function suggestCompressedQuestion(
  axes: {
    id: string;
    name: string;
    description?: string;
    rubricLevels?: { level: number; label?: string; description?: string }[];
  }[],
  questionType: string = 'FREE_TEXT',
  extraContext?: string,
): Promise<{ questionText: string; rationale: string }> {
  const res = await fetch(`${AI_SERVICE}/suggest/compress-question`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': AI_INTERNAL_KEY,
    },
    body: JSON.stringify({
      axes: axes.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        rubric_levels: (a.rubricLevels ?? []).map((rl) => ({
          level: rl.level,
          label: rl.label,
          description: rl.description,
        })),
      })),
      question_type: questionType,
      extra_context: extraContext ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'AI提案の取得に失敗しました');
  }
  const json = await res.json();
  return { questionText: json.question_text ?? '', rationale: json.rationale ?? '' };
}

// 出力形式を作成
export async function createOutputFormat(
  modelId: string,
  data: {
    name: string;
    description?: string;
    outputType: string;
    config: any;
    promptTemplate?: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/output-formats`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '出力形式の作成に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

// 出力形式を更新
export async function updateOutputFormat(
  modelId: string,
  formatId: string,
  data: {
    name: string;
    description?: string;
    outputType: string;
    config: any;
    promptTemplate?: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/output-formats/${formatId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '出力形式の更新に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

export async function exportModelResponsesCsv(
  modelId: string,
  data: {
    questionGroupIds?: string[];
    dates?: string[];
    columnKeys?: string[];
    questionIds?: string[];
    useDisplayText?: boolean;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/responses/export`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'CSVエクスポートに失敗しました');
  }
  const json = await res.json();
  return json.data ?? json;
}

// 出力形式を削除
export async function deleteOutputFormat(modelId: string, formatId: string) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/output-formats/${formatId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '出力形式の削除に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
}

// 評価軸を更新
export async function updateAxis(
  modelId: string,
  axisId: string,
  data: {
    name?: string;
    description?: string;
    weight?: number;
    idealStateText?: string;
    lowStateText?: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/axes/${axisId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '評価軸の更新に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

// 評価軸を削除
export async function deleteAxis(modelId: string, axisId: string) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/axes/${axisId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '評価軸の削除に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
}

// 質問を更新
export async function updateQuestion(
  modelId: string,
  questionId: string,
  data: {
    text?: string;
    type?: string;
    required?: boolean;
    scaleMin?: number;
    scaleMax?: number;
    scaleMinLabel?: string;
    scaleMaxLabel?: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/questions/${questionId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問の更新に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
  const json = await res.json();
  return json.data ?? json;
}

// 質問を削除
export async function deleteQuestion(modelId: string, questionId: string) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/questions/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問の削除に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
}

// 選択肢を作成または更新（upsert）
export async function upsertQuestionOption(
  modelId: string,
  questionId: string,
  data: { optionId?: string; label: string; value: string; text: string; order: number; explicitWeight?: number },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/questions/${questionId}/options`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '選択肢の保存に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
  const json = await res.json();
  return json.data ?? json;
}

// 選択肢を削除
export async function deleteQuestionOption(modelId: string, questionId: string, optionId: string) {
  const token = await getToken();
  const res = await fetch(
    `${API}/evaluation-models/${modelId}/questions/${questionId}/options/${optionId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '選択肢の削除に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
}

export async function reorderQuestions(modelId: string, questionIds: string[]) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/questions/order`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問順の保存に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

export async function createQuestionGroup(
  modelId: string,
  data: {
    name: string;
    description?: string;
    groupType?: string;
    order?: number;
    isActive?: boolean;
    config?: Record<string, unknown>;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/question-groups`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問グループの作成に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

export async function updateQuestionGroup(
  modelId: string,
  groupId: string,
  data: {
    name?: string;
    description?: string;
    groupType?: string;
    order?: number;
    isActive?: boolean;
    config?: Record<string, unknown>;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/question-groups/${groupId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問グループの更新に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

export async function deleteQuestionGroup(modelId: string, groupId: string) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/question-groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問グループの削除に失敗しました');
  }
  revalidatePath(`/evaluation-models/${modelId}`);
}

export async function replaceQuestionGroupItems(
  modelId: string,
  groupId: string,
  items: {
    questionId: string;
    displayText?: string;
    order?: number;
    block?: string;
    shuffleGroup?: string;
    required?: boolean;
    contributionWeight?: number;
    metadata?: Record<string, unknown>;
  }[],
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/question-groups/${groupId}/items`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? '質問グループの質問割当に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  return json.data ?? json;
}

// テスト実行（同期スコアリング）
export async function testRunModel(
  modelId: string,
  data: {
    respondentRef: string;
    questionGroupId?: string;
    outputFormatIds?: string[];
    items: { questionId: string; value: unknown }[];
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/test-run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'テスト実行に失敗しました');
  }
  const json = await res.json();
  return json.data ?? json;
}

// 評価モデルのスナップショット（新バージョン）を作成
export async function snapshotModel(modelId: string) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}/snapshot`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'スナップショットの作成に失敗しました');
  }
  const json = await res.json();
  revalidatePath('/evaluation-models');
  return json.data ?? json;
}

// 評価モデルを更新
export async function updateModel(
  modelId: string,
  data: {
    name?: string;
    description?: string;
    status?: string;
  },
) {
  const token = await getToken();
  const res = await fetch(`${API}/evaluation-models/${modelId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'モデルの更新に失敗しました');
  }
  const json = await res.json();
  revalidatePath(`/evaluation-models/${modelId}`);
  revalidatePath('/evaluation-models');
  return json.data ?? json;
}
