'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createEvaluationModel } from '@/actions/model.actions';
import type { ProjectDto } from '@evalengine/types';

interface Props {
  projects: ProjectDto[];
}

export function CreateModelForm({ projects }: Props) {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      try {
        await createEvaluationModel(formData);
      } catch (e: any) {
        setError(e.message ?? '作成に失敗しました');
      }
    });
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          モデル名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: エンジニア候補者評価モデル v1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
        <textarea
          name="description"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="このモデルの目的・対象者・用途を記入"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          プロジェクト <span className="text-red-500">*</span>
        </label>
        {projects.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-700">
            プロジェクトが見つかりません。先に
            <Link href="/projects/new" className="underline mx-1">プロジェクトを作成</Link>
            してください。
          </div>
        ) : (
          <select
            name="projectId"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">プロジェクトを選択</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">次のステップ</p>
        <p>モデル作成後、評価軸（例: 技術力・コミュニケーション力）と質問を追加できます。</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || projects.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '作成中...' : 'モデルを作成'}
        </button>
        <Link href="/evaluation-models" className="px-6 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
