'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createProject } from '@/actions/project.actions';

export default function NewProjectPage() {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      try {
        await createProject(formData);
      } catch (e: any) {
        setError(e.message ?? '作成に失敗しました');
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">← プロジェクト一覧</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">新規プロジェクト作成</h1>
        <p className="text-sm text-gray-500 mt-1">評価モデルをまとめるプロジェクトを作成します</p>
      </div>

      <form action={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            プロジェクト名 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: エンジニア採用2024"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
          <textarea
            name="description"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="プロジェクトの目的・概要（任意）"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? '作成中...' : 'プロジェクトを作成'}
          </button>
          <Link href="/projects" className="px-6 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
