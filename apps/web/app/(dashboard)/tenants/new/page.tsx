'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTenant } from '@/actions/tenant.actions';

const plans = [
  { value: 'FREE', label: '無料', desc: '機能制限あり' },
  { value: 'STARTER', label: 'スターター', desc: '中小規模向け' },
  { value: 'PROFESSIONAL', label: 'プロフェッショナル', desc: '本格運用向け' },
  { value: 'ENTERPRISE', label: 'エンタープライズ', desc: '大規模・専用サポート' },
];

export default function NewTenantPage() {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [slug, setSlug] = useState('');

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const auto = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    setSlug(auto);
  }

  function handleSubmit(formData: FormData) {
    setError('');
    formData.set('slug', slug);
    startTransition(async () => {
      try {
        await createTenant(formData);
      } catch (e: any) {
        setError(e.message ?? '作成に失敗しました');
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/tenants" className="text-sm text-blue-600 hover:underline">← テナント一覧</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">新規テナント作成</h1>
        <p className="text-sm text-gray-500 mt-1">クライアント企業をテナントとして登録します</p>
      </div>

      <form action={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            会社名 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            onChange={handleNameChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 株式会社テックスタート"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            スラッグ（ID） <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              name="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="techstart"
              pattern="[a-z0-9\-]+"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">英小文字・数字・ハイフンのみ。APIキー認証時に使用</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">プラン</label>
          <div className="grid grid-cols-2 gap-2">
            {plans.map((p) => (
              <label key={p.value} className="flex items-start gap-2 border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-300 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input type="radio" name="plan" value={p.value} defaultChecked={p.value === 'FREE'} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.label}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending || !slug}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? '作成中...' : 'テナントを作成'}
          </button>
          <Link href="/tenants" className="px-6 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
