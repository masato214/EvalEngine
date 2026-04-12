'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createAxis } from '@/actions/model-builder.actions';

interface Props {
  modelId: string;
  parentId?: string;
  parentName?: string;
  existingAxes?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function AxisForm({ modelId, parentId, parentName, existingAxes = [], onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('1.0');
  const [idealStateText, setIdealStateText] = useState('');
  const [lowStateText, setLowStateText] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await createAxis(modelId, {
          name,
          description: description || undefined,
          weight: parseFloat(weight) || 1.0,
          parentId: parentId || undefined,
          idealStateText: idealStateText || undefined,
          lowStateText: lowStateText || undefined,
        });

        setOpen(false);
        setName('');
        setDescription('');
        setWeight('1.0');
        setIdealStateText('');
        setLowStateText('');
        onSuccess?.();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <Plus size={14} />
        {parentName ? `「${parentName}」に子軸を追加` : '評価軸を追加'}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mt-3">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        {parentName ? `「${parentName}」の子軸を作成` : '新しい評価軸を作成'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 基本情報 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              軸名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 主体性・技術力・コミュニケーション力"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">重み</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">説明</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="この評価軸が測定するものを簡潔に"
          />
        </div>

        {/* 理想状態テキスト（Lv5方向） */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            理想状態テキスト（Lv5方向）
            <span className="text-gray-400 font-normal ml-1">→ 軸全体の高い方向を示します</span>
          </label>
          <textarea
            value={idealStateText}
            onChange={(e) => setIdealStateText(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="例: 自ら課題を発見し、組織全体を動かして変革を推進できる。周囲への影響力が高く、常に高い視座で行動する。"
          />
        </div>

        {/* 低状態テキスト（Lv1方向） */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            低状態テキスト（Lv1方向）
            <span className="text-gray-400 font-normal ml-1">→ 軸全体の低い方向を示します</span>
          </label>
          <textarea
            value={lowStateText}
            onChange={(e) => setLowStateText(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="例: 指示待ちで自発的に動くことが少ない。課題があっても放置しがちで、周囲への影響をほとんど与えない。"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || !name}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? '作成中...' : '作成'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
