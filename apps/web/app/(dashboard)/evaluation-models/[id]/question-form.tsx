'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Sparkles, X, Info } from 'lucide-react';
import { createQuestion, suggestCompressedQuestion } from '@/actions/model-builder.actions';

const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: '単一選択' },
  { value: 'MULTIPLE_CHOICE', label: '複数選択' },
  { value: 'FREE_TEXT', label: '自由記述' },
  { value: 'SCALE', label: 'スケール' },
];

interface OptionRow {
  label: string;
  value: string;
  text: string;
}

interface MappingRow {
  axisId: string;
  weight: number;
}

interface Props {
  modelId: string;
  /** 最初からマッピングされる軸ID */
  defaultAxisId: string;
  /** モデル内の全軸（id, name, description, rubricLevels を含む） */
  allAxes: any[];
  onSuccess?: () => void;
}

export function QuestionForm({ modelId, defaultAxisId, allAxes, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, startSuggestionTransition] = useTransition();
  const [error, setError] = useState('');
  const [suggestionRationale, setSuggestionRationale] = useState('');

  const [text, setText] = useState('');
  const [type, setType] = useState('FREE_TEXT');
  const [required, setRequired] = useState(true);

  // 軸マッピング（複数軸対応）
  const [mappings, setMappings] = useState<MappingRow[]>([
    { axisId: defaultAxisId, weight: 1.0 },
  ]);

  const [options, setOptions] = useState<OptionRow[]>([
    { label: '', value: '', text: '' },
    { label: '', value: '', text: '' },
  ]);

  const [scaleMin, setScaleMin] = useState('1');
  const [scaleMax, setScaleMax] = useState('5');
  const [scaleMinLabel, setScaleMinLabel] = useState('');
  const [scaleMaxLabel, setScaleMaxLabel] = useState('');

  // ── Option helpers ────────────────────────────────────────────────────────
  function addOption() {
    setOptions((prev) => [...prev, { label: '', value: '', text: '' }]);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateOption(i: number, field: keyof OptionRow, val: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [field]: val } : o)));
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────
  const mappedAxisIds = new Set(mappings.map((m) => m.axisId));
  const availableAxes = allAxes.filter((a: any) => !mappedAxisIds.has(a.id));

  function addMapping(axisId: string) {
    setMappings((prev) => [...prev, { axisId, weight: 1.0 }]);
  }
  function removeMapping(axisId: string) {
    if (mappings.length <= 1) return; // 最低1軸は必須
    setMappings((prev) => prev.filter((m) => m.axisId !== axisId));
  }
  function updateWeight(axisId: string, raw: string) {
    const parsed = parseFloat(raw);
    const val = isNaN(parsed) ? 1.0 : Math.max(0.1, Math.min(2.0, parsed));
    setMappings((prev) => prev.map((m) => (m.axisId === axisId ? { ...m, weight: val } : m)));
  }

  function getAxisName(axisId: string): string {
    return allAxes.find((a: any) => a.id === axisId)?.name ?? axisId;
  }

  // ── AI 圧縮提案 ───────────────────────────────────────────────────────────
  function handleSuggest() {
    setSuggestionRationale('');
    startSuggestionTransition(async () => {
      try {
        const selectedAxes = mappings.map((m) => {
          const axisData = allAxes.find((a: any) => a.id === m.axisId);
          return {
            id: m.axisId,
            name: axisData?.name ?? m.axisId,
            description: axisData?.description,
            rubricLevels: axisData?.rubricLevels ?? [],
          };
        });
        const result = await suggestCompressedQuestion(selectedAxes, type);
        setText(result.questionText);
        setSuggestionRationale(result.rationale);
      } catch (e: any) {
        setError(`AI提案エラー: ${e.message}`);
      }
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      try {
        const data: Parameters<typeof createQuestion>[2] = { text, type, required };

        if (type === 'SCALE') {
          data.scaleMin = parseInt(scaleMin);
          data.scaleMax = parseInt(scaleMax);
          if (scaleMinLabel) data.scaleMinLabel = scaleMinLabel;
          if (scaleMaxLabel) data.scaleMaxLabel = scaleMaxLabel;
        }

        if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
          data.options = options
            .filter((o) => o.label.trim() && o.value.trim())
            .map((o) => ({ label: o.label, value: o.value, text: o.text || o.label }));
        }

        await createQuestion(
          modelId,
          mappings.map((m) => ({ axisId: m.axisId, contributionWeight: m.weight })),
          data,
        );
        onSuccess?.();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  const isChoice = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  const canSuggest = mappings.length >= 2;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 対象評価軸 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          対象評価軸
          <span className="ml-1.5 text-gray-400 font-normal">（複数選択で質問を圧縮できます）</span>
        </label>
        <div className="space-y-1.5">
          {mappings.map((m) => (
            <div key={m.axisId} className="flex items-center gap-2">
              <span className="flex-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg font-medium truncate">
                {getAxisName(m.axisId)}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400">貢献度</span>
                <input
                  type="number"
                  value={m.weight}
                  onChange={(e) => updateWeight(m.axisId, e.target.value)}
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs text-center"
                />
              </div>
              <button
                type="button"
                onClick={() => removeMapping(m.axisId)}
                disabled={mappings.length <= 1}
                className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title="この軸マッピングを削除"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* 軸追加ドロップダウン */}
        {availableAxes.length > 0 && (
          <div className="mt-1.5">
            <select
              className="text-xs border border-dashed border-gray-300 rounded-lg px-2 py-1.5 text-gray-500 bg-white hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 w-full"
              value=""
              onChange={(e) => { if (e.target.value) addMapping(e.target.value); }}
            >
              <option value="">＋ 別の軸も対象に追加...</option>
              {availableAxes.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* タイプ選択 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">質問タイプ</label>
        <div className="flex gap-2 flex-wrap">
          {QUESTION_TYPES.map((t) => (
            <label
              key={t.value}
              className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                type === t.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="qtype"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* 質問文 + AI提案 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-700">
            質問文 <span className="text-red-500">*</span>
          </label>
          {canSuggest && (
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isSuggesting}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50"
            >
              <Sparkles size={12} />
              {isSuggesting ? 'AI提案中...' : `AIが${mappings.length}軸を1問に圧縮`}
            </button>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder={
            canSuggest
              ? 'AIボタンで質問文を自動生成、または直接入力...'
              : '例: 仕事において自分から新しい取り組みを始めることがありますか？'
          }
        />
        {suggestionRationale && (
          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-purple-600 bg-purple-50 rounded-lg px-2.5 py-2">
            <Info size={11} className="flex-shrink-0 mt-0.5" />
            <span>{suggestionRationale}</span>
          </div>
        )}
      </div>

      {/* 選択肢 */}
      {isChoice && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">選択肢</label>
            <button type="button" onClick={addOption} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Plus size={12} /> 追加
            </button>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <input
                    type="text"
                    value={o.label}
                    onChange={(e) => updateOption(i, 'label', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    placeholder="表示テキスト"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={o.value}
                    onChange={(e) => updateOption(i, 'value', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    placeholder="値"
                  />
                </div>
                <div className="col-span-5">
                  <input
                    type="text"
                    value={o.text}
                    onChange={(e) => updateOption(i, 'text', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    placeholder="意味テキスト（空欄=表示テキストを使用）"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* スケール */}
      {type === 'SCALE' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">最小値</label>
            <input type="number" value={scaleMin} onChange={(e) => setScaleMin(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
            <input type="text" value={scaleMinLabel} onChange={(e) => setScaleMinLabel(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs mt-1" placeholder="ラベル（例: 全くない）" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">最大値</label>
            <input type="number" value={scaleMax} onChange={(e) => setScaleMax(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
            <input type="text" value={scaleMaxLabel} onChange={(e) => setScaleMaxLabel(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs mt-1" placeholder="ラベル（例: 常にある）" />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || !text}
          className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? '作成中...' : '質問を追加'}
        </button>
        <button type="button" onClick={() => onSuccess?.()} className="px-4 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
          キャンセル
        </button>
      </div>
    </form>
  );
}
