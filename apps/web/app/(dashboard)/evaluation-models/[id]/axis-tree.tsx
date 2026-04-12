'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown, Plus, Settings2, Pencil, Trash2, X, Check, Sparkles, Info, Link2 } from 'lucide-react';
import { AxisForm } from './axis-form';
import { QuestionForm } from './question-form';
import {
  saveRubricLevel, updateAxis, deleteAxis,
  updateQuestion, deleteQuestion,
  upsertQuestionOption, deleteQuestionOption,
  upsertAxisMapping, removeAxisMapping,
  suggestCompressedQuestion,
} from '@/actions/model-builder.actions';

const questionTypeLabels: Record<string, string> = {
  SINGLE_CHOICE: '単一選択',
  MULTIPLE_CHOICE: '複数選択',
  FREE_TEXT: '自由記述',
  SCALE: 'スケール',
};

const levelColor = (level: number) => {
  if (level === 5) return 'bg-green-100 text-green-700';
  if (level === 4) return 'bg-blue-100 text-blue-700';
  if (level === 3) return 'bg-yellow-100 text-yellow-700';
  if (level === 2) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
};

const LEVEL_DEFAULTS = [
  { level: 5, label: '非常に高い', description: '' },
  { level: 4, label: '高い', description: '' },
  { level: 3, label: '普通', description: '' },
  { level: 2, label: '低い', description: '' },
  { level: 1, label: '非常に低い', description: '' },
];

/** リーフ軸の評価基準（Lv1〜5）設定パネル */
function CriteriaPanel({ axis, modelId }: { axis: any; modelId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const existing: any[] = axis.rubricLevels ?? [];
  const [levels, setLevels] = useState(
    LEVEL_DEFAULTS.map((d) => {
      const found = existing.find((e) => e.level === d.level);
      return { ...d, label: found?.label ?? d.label, description: found?.description ?? '' };
    }),
  );

  function update(level: number, field: 'label' | 'description', val: string) {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, [field]: val } : l)));
  }

  async function handleSave() {
    setError('');
    const lv5 = levels.find((l) => l.level === 5);
    const lv1 = levels.find((l) => l.level === 1);
    if (!lv5?.description.trim() || !lv1?.description.trim()) {
      setError('Lv5（最高水準）とLv1（最低水準）の説明は必須です');
      return;
    }
    startTransition(async () => {
      try {
        for (const lv of levels.filter((l) => l.description.trim())) {
          await saveRubricLevel(modelId, axis.id, {
            level: lv.level,
            label: lv.label,
            description: lv.description,
          });
        }
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  const savedCount = existing.length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">
        この軸の回答レベルを定義します。Lv5（最高）とLv1（最低）は必須。ベクトル化されスコアの基準になります。
      </p>
      {levels.map((lv) => {
        const isRequired = lv.level === 1 || lv.level === 5;
        return (
          <div key={lv.level} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-1 pt-2 text-center flex-shrink-0">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${levelColor(lv.level)}`}>
                Lv{lv.level}
              </span>
            </div>
            <div className="col-span-3">
              <input
                type="text"
                value={lv.label}
                onChange={(e) => update(lv.level, 'label', e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="ラベル"
              />
            </div>
            <div className="col-span-8">
              <textarea
                value={lv.description}
                onChange={(e) => update(lv.level, 'description', e.target.value)}
                rows={2}
                className={`w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none ${
                  isRequired ? 'border-gray-300' : 'border-gray-200'
                }`}
                placeholder={
                  lv.level === 5
                    ? 'この軸で最高水準の状態・回答を具体的に（必須）'
                    : lv.level === 1
                    ? 'この軸で最低水準の状態・回答を具体的に（必須）'
                    : `Lv${lv.level}の状態を具体的に（任意）`
                }
              />
            </div>
          </div>
        );
      })}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
      >
        {isPending ? '保存中...' : savedCount > 0 ? '評価基準を更新' : '評価基準を保存'}
      </button>
    </div>
  );
}

/** 軸の編集フォーム（インライン） */
function AxisEditForm({
  axis,
  modelId,
  onClose,
}: {
  axis: any;
  modelId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [name, setName] = useState(axis.name ?? '');
  const [description, setDescription] = useState(axis.description ?? '');
  const [weight, setWeight] = useState(String(axis.weight ?? 1.0));
  const [idealStateText, setIdealStateText] = useState(axis.idealStateText ?? '');
  const [lowStateText, setLowStateText] = useState(axis.lowStateText ?? '');

  async function handleSave() {
    if (!name.trim()) { setError('軸名は必須です'); return; }
    setError('');
    startTransition(async () => {
      try {
        await updateAxis(modelId, axis.id, {
          name,
          description: description || undefined,
          weight: parseFloat(weight) || 1.0,
          idealStateText: idealStateText || undefined,
          lowStateText: lowStateText || undefined,
        });
        onClose();
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-blue-700">「{axis.name}」を編集</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-3">
            <label className="block text-xs text-gray-600 mb-1">軸名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">重み</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">説明</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">理想状態（Lv5方向）</label>
          <textarea
            value={idealStateText}
            onChange={(e) => setIdealStateText(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">低状態（Lv1方向）</label>
          <textarea
            value={lowStateText}
            onChange={(e) => setLowStateText(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Check size={12} />
            {isPending ? '保存中...' : '保存'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

/** 質問の編集フォーム（インライン） */
function QuestionEditForm({
  question,
  modelId,
  allAxes,
  onClose,
  onDeleted,
}: {
  question: any;
  modelId: string;
  allAxes: any[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isSuggesting, startSuggestionTransition] = useTransition();
  const [error, setError] = useState('');
  const [suggestionRationale, setSuggestionRationale] = useState('');

  const [text, setText] = useState(question.text ?? '');
  const [type, setType] = useState<string>(question.type ?? 'FREE_TEXT');
  const [required, setRequired] = useState(question.required ?? true);
  const [scaleMin, setScaleMin] = useState(String(question.scaleMin ?? 1));
  const [scaleMax, setScaleMax] = useState(String(question.scaleMax ?? 5));
  const [scaleMinLabel, setScaleMinLabel] = useState(question.scaleMinLabel ?? '');
  const [scaleMaxLabel, setScaleMaxLabel] = useState(question.scaleMaxLabel ?? '');

  // 選択肢の状態管理
  type OptionRow = { id?: string; label: string; value: string; order: number; _delete?: boolean };
  const [options, setOptions] = useState<OptionRow[]>(
    (question.options ?? []).map((o: any, i: number) => ({
      id: o.id,
      label: o.label,
      value: o.value,
      order: o.order ?? i,
    })),
  );

  // 軸マッピングの状態管理
  type MappingRow = { axisId: string; weight: number; _remove?: boolean };
  const [mappings, setMappings] = useState<MappingRow[]>(
    (question.axisMappings ?? []).map((m: any) => ({
      axisId: m.axisId,
      weight: m.contributionWeight ?? 1.0,
    })),
  );

  const isChoice = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  const isScale = type === 'SCALE';

  // ── Option helpers ────────────────────────────────────────────────────────
  function addOption() {
    const order = options.filter((o) => !o._delete).length;
    setOptions((prev) => [...prev, { label: '', value: '', order }]);
  }

  function updateOption(idx: number, field: 'label' | 'value', val: string) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== idx) return o;
        const updated = { ...o, [field]: val };
        if (field === 'label' && (o.value === '' || o.value === o.label.toLowerCase().replace(/\s+/g, '_'))) {
          updated.value = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\u3000-\u9fff\u4e00-\u9fff]/g, '') || val;
        }
        return updated;
      }),
    );
  }

  function removeOption(idx: number) {
    const opt = options[idx];
    if (opt.id) {
      setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, _delete: true } : o)));
    } else {
      setOptions((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────
  const activeMappings = mappings.filter((m) => !m._remove);
  const mappedAxisIds = new Set(activeMappings.map((m) => m.axisId));
  const availableAxes = allAxes.filter((a: any) => !mappedAxisIds.has(a.id));

  function addMappingAxis(axisId: string) {
    const existing = mappings.find((m) => m.axisId === axisId);
    if (existing) {
      setMappings((prev) => prev.map((m) => (m.axisId === axisId ? { ...m, _remove: false } : m)));
    } else {
      setMappings((prev) => [...prev, { axisId, weight: 1.0 }]);
    }
  }

  function removeMappingAxis(axisId: string) {
    if (activeMappings.length <= 1) return;
    setMappings((prev) => prev.map((m) => (m.axisId === axisId ? { ...m, _remove: true } : m)));
  }

  function updateMappingWeight(axisId: string, raw: string) {
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
        const selectedAxes = activeMappings.map((m) => {
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

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!text.trim()) { setError('質問文は必須です'); return; }
    if (isChoice) {
      const activeOpts = options.filter((o) => !o._delete);
      if (activeOpts.length === 0) { setError('選択肢を1つ以上追加してください'); return; }
      if (activeOpts.some((o) => !o.label.trim())) { setError('選択肢のラベルは必須です'); return; }
    }
    setError('');
    startTransition(async () => {
      try {
        // 1. 質問基本情報を更新
        const data: any = { text, type, required };
        if (isScale) {
          data.scaleMin = parseInt(scaleMin) || 1;
          data.scaleMax = parseInt(scaleMax) || 5;
          data.scaleMinLabel = scaleMinLabel || undefined;
          data.scaleMaxLabel = scaleMaxLabel || undefined;
        }
        await updateQuestion(modelId, question.id, data);

        // 2. 選択肢を同期
        if (isChoice) {
          for (const opt of options.filter((o) => o._delete && o.id)) {
            await deleteQuestionOption(modelId, question.id, opt.id!);
          }
          const activeOpts = options.filter((o) => !o._delete);
          for (let i = 0; i < activeOpts.length; i++) {
            const o = activeOpts[i];
            await upsertQuestionOption(modelId, question.id, {
              optionId: o.id,
              label: o.label,
              value: o.value || o.label,
              text: o.label,
              order: i,
            });
          }
        } else if (!isChoice) {
          for (const opt of options.filter((o) => o.id)) {
            await deleteQuestionOption(modelId, question.id, opt.id!);
          }
        }

        // 3. 軸マッピングを同期
        const toRemove = mappings.filter((m) => m._remove);
        const toUpsert = activeMappings;
        for (const m of toRemove) {
          await removeAxisMapping(modelId, question.id, m.axisId);
        }
        for (const m of toUpsert) {
          await upsertAxisMapping(modelId, question.id, m.axisId, m.weight);
        }

        onClose();
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`「${question.text.slice(0, 30)}」を削除しますか？`)) return;
    startDeleteTransition(async () => {
      try {
        await deleteQuestion(modelId, question.id);
        onDeleted();
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  const activeOptions = options.filter((o) => !o._delete);
  const canSuggest = activeMappings.length >= 2;

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-lg mx-4 my-2 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-amber-700">質問を編集</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
      <div className="space-y-3">
        {/* 質問タイプ */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">質問タイプ</label>
          <div className="flex gap-1.5 flex-wrap">
            {(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'FREE_TEXT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  type === t
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'border-gray-300 text-gray-600 hover:border-amber-400'
                }`}
              >
                {questionTypeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 対象評価軸（複数軸マッピング管理） */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              <Link2 size={11} />
              対象評価軸
            </label>
            {canSuggest && (
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isSuggesting}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50"
              >
                <Sparkles size={11} />
                {isSuggesting ? 'AI提案中...' : `AIが${activeMappings.length}軸を1問に圧縮`}
              </button>
            )}
          </div>
          <div className="space-y-1">
            {activeMappings.map((m) => (
              <div key={m.axisId} className="flex items-center gap-1.5">
                <span className="flex-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded truncate">
                  {getAxisName(m.axisId)}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">貢献度</span>
                <input
                  type="number"
                  value={m.weight}
                  onChange={(e) => updateMappingWeight(m.axisId, e.target.value)}
                  min="0.1" max="2.0" step="0.1"
                  className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center flex-shrink-0"
                />
                <button
                  type="button"
                  onClick={() => removeMappingAxis(m.axisId)}
                  disabled={activeMappings.length <= 1}
                  className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          {availableAxes.length > 0 && (
            <select
              className="mt-1 text-xs border border-dashed border-gray-300 rounded px-2 py-1 text-gray-500 bg-white hover:border-amber-300 focus:outline-none w-full"
              value=""
              onChange={(e) => { if (e.target.value) addMappingAxis(e.target.value); }}
            >
              <option value="">＋ 別の軸も対象に追加...</option>
              {availableAxes.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* 質問文 */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">質問文 *</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
          />
          {suggestionRationale && (
            <div className="mt-1 flex items-start gap-1 text-xs text-purple-600 bg-purple-50 rounded px-2 py-1.5">
              <Info size={10} className="flex-shrink-0 mt-0.5" />
              <span>{suggestionRationale}</span>
            </div>
          )}
        </div>

        {/* スケール設定 */}
        {isScale && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">最小値</label>
              <input type="number" value={scaleMin} onChange={(e) => setScaleMin(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">最大値</label>
              <input type="number" value={scaleMax} onChange={(e) => setScaleMax(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">最小ラベル</label>
              <input type="text" value={scaleMinLabel} onChange={(e) => setScaleMinLabel(e.target.value)}
                placeholder="例: 全く思わない"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">最大ラベル</label>
              <input type="text" value={scaleMaxLabel} onChange={(e) => setScaleMaxLabel(e.target.value)}
                placeholder="例: 非常にそう思う"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
          </div>
        )}

        {/* 選択肢管理（SINGLE_CHOICE / MULTIPLE_CHOICE） */}
        {isChoice && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-600">選択肢 *</label>
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium"
              >
                <Plus size={11} />
                選択肢を追加
              </button>
            </div>
            <div className="space-y-1.5">
              {activeOptions.length === 0 && (
                <p className="text-xs text-gray-400 py-2 text-center border border-dashed border-gray-300 rounded">
                  「選択肢を追加」をクリックして選択肢を作成してください
                </p>
              )}
              {activeOptions.map((opt, idx) => {
                const origIdx = options.indexOf(opt);
                return (
                  <div key={origIdx} className="flex gap-1.5 items-center">
                    <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOption(origIdx, 'label', e.target.value)}
                      placeholder="選択肢のラベル（表示テキスト）"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(origIdx)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 必須チェック */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id={`req-${question.id}`} checked={required}
            onChange={(e) => setRequired(e.target.checked)} className="rounded border-gray-300" />
          <label htmlFor={`req-${question.id}`} className="text-xs text-gray-600">必須回答</label>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={isPending}
            className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50">
            <Check size={12} />{isPending ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose} className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100">
            キャンセル
          </button>
          <button onClick={handleDelete} disabled={isDeletePending}
            className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded hover:bg-red-50 disabled:opacity-50">
            <Trash2 size={11} />{isDeletePending ? '削除中...' : '削除'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 質問行（ホバーで編集・削除表示） */
function QuestionRow({
  question,
  index,
  modelId,
  allAxes,
}: {
  question: any;
  index: number;
  modelId: string;
  allAxes: any[];
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  // 複数軸マッピングを表示（自軸以外を「+N軸」で表示）
  const extraMappings: any[] = (question.axisMappings ?? []).slice(1);

  return (
    <>
      <div className="flex items-start gap-2 px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 group/q hover:bg-gray-100/60 transition-colors">
        <span className="text-gray-400 w-5 text-right flex-shrink-0 mt-0.5">{index + 1}.</span>
        <span className="text-gray-700 flex-1 leading-snug min-w-0">{question.text}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {extraMappings.length > 0 && (
            <span
              className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium"
              title={extraMappings.map((m: any) => allAxes.find((a: any) => a.id === m.axisId)?.name ?? m.axisId).join(', ')}
            >
              +{extraMappings.length}軸
            </span>
          )}
          <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
            {questionTypeLabels[question.type] ?? question.type}
          </span>
        </div>
        <button
          onClick={() => setShowEdit((v) => !v)}
          className="opacity-0 group-hover/q:opacity-100 text-gray-400 hover:text-amber-500 p-1 rounded transition-all flex-shrink-0"
          title="編集"
        >
          <Pencil size={11} />
        </button>
      </div>
      {showEdit && (
        <QuestionEditForm
          question={question}
          modelId={modelId}
          allAxes={allAxes}
          onClose={() => setShowEdit(false)}
          onDeleted={() => { setShowEdit(false); setDeleted(true); }}
        />
      )}
    </>
  );
}

function AxisNode({
  axis,
  depth = 0,
  modelId,
  allAxes,
}: {
  axis: any;
  depth?: number;
  modelId: string;
  allAxes: any[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(depth === 0);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasChildren = axis.children && axis.children.length > 0;
  const isLeaf = !hasChildren;

  const mappedQuestions: any[] = axis.mappings?.map((m: any) => ({
    ...m.question,
    contributionWeight: m.contributionWeight,
  })) ?? [];
  const questionCount = mappedQuestions.length;
  const criteriaCount = axis.rubricLevels?.length ?? 0;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleDelete() {
    setShowDeleteConfirm(true);
  }

  function confirmDelete() {
    setShowDeleteConfirm(false);
    startTransition(async () => {
      await deleteAxis(modelId, axis.id);
      router.refresh();
    });
  }

  return (
    <div>
      {/* 軸ヘッダー */}
      <div
        className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 group"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <span
          className="text-gray-300 w-4 flex-shrink-0 cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          {hasChildren
            ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <span className="block w-3 h-px bg-gray-200 ml-0.5" />}
        </span>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => hasChildren && setOpen(!open)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{axis.name}</span>
            {axis.description && (
              <span className="text-xs text-gray-400 truncate hidden sm:inline">{axis.description}</span>
            )}
          </div>
          {isLeaf && axis.idealStateText && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">Lv5: {axis.idealStateText}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* リーフ軸のみ：質問数・評価基準・追加ボタン */}
          {isLeaf && (
            <>
              <span className="text-xs text-gray-400">{questionCount}問</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                  setShowCriteria(!showCriteria);
                  setShowQuestionForm(false);
                  setShowEdit(false);
                }}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                  criteriaCount > 0
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Settings2 size={11} />
                評価基準 {criteriaCount > 0 ? `${criteriaCount}件` : '未設定'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                  setShowQuestionForm(!showQuestionForm);
                  setShowCriteria(false);
                  setShowEdit(false);
                }}
                className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
              >
                <Plus size={11} />
                質問を追加
              </button>
            </>
          )}
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
            重み {axis.weight}
          </span>
          {hasChildren && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
              {axis.children.length}軸
            </span>
          )}
          {/* 編集・削除ボタン（ホバー時） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEdit(!showEdit);
              setShowCriteria(false);
              setShowQuestionForm(false);
              setOpen(true);
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 p-1 rounded transition-all"
            title="編集"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            disabled={isPending}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition-all disabled:opacity-50"
            title="削除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* 編集フォーム */}
          {showEdit && (
            <div style={{ paddingLeft: `${depth * 20}px` }}>
              <AxisEditForm
                axis={axis}
                modelId={modelId}
                onClose={() => setShowEdit(false)}
              />
            </div>
          )}

          {/* 評価基準設定パネル（リーフのみ） */}
          {isLeaf && showCriteria && (
            <div
              className="bg-purple-50 border-b border-purple-100 px-4 py-4"
              style={{ paddingLeft: `${32 + depth * 20}px`, paddingRight: '16px' }}
            >
              <p className="text-xs font-semibold text-purple-700 mb-3">
                「{axis.name}」の評価基準（Lv1〜5）
              </p>
              <CriteriaPanel axis={axis} modelId={modelId} />
            </div>
          )}

          {/* 質問追加フォーム（リーフのみ） */}
          {isLeaf && showQuestionForm && (
            <div
              className="bg-emerald-50 border-b border-emerald-100 px-4 py-4"
              style={{ paddingLeft: `${32 + depth * 20}px`, paddingRight: '16px' }}
            >
              <p className="text-xs font-semibold text-emerald-700 mb-3">
                「{axis.name}」に質問を追加
              </p>
              <QuestionForm
                modelId={modelId}
                defaultAxisId={axis.id}
                allAxes={allAxes}
                onSuccess={() => setShowQuestionForm(false)}
              />
            </div>
          )}

          {/* 質問一覧（リーフのみ） */}
          {isLeaf && mappedQuestions.length > 0 && (
            <div
              className="bg-gray-50 border-b border-gray-100"
              style={{ paddingLeft: `${32 + depth * 20}px` }}
            >
              {mappedQuestions
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                .map((q: any, i: number) => (
                  <QuestionRow key={q.id} question={q} index={i} modelId={modelId} allAxes={allAxes} />
                ))}
            </div>
          )}

          {/* 子軸 */}
          {hasChildren &&
            axis.children.map((child: any) => (
              <AxisNode
                key={child.id}
                axis={child}
                depth={depth + 1}
                modelId={modelId}
                allAxes={allAxes}
              />
            ))}

          {/* 子軸追加ボタン */}
          <div
            style={{ paddingLeft: `${16 + depth * 20}px` }}
            className="py-1 border-b border-gray-50"
          >
            <AxisForm
              modelId={modelId}
              parentId={axis.id}
              parentName={axis.name}
              existingAxes={allAxes}
            />
          </div>
        </>
      )}

      {/* 軸削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">「{axis.name}」を削除</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              この評価軸を削除します。<br />
              {hasChildren && <span className="text-red-600 font-medium">子軸 {axis.children.length} 件</span>}
              {hasChildren && questionCount > 0 && '・'}
              {questionCount > 0 && <span className="text-red-600 font-medium">質問 {questionCount} 件</span>}
              {(hasChildren || questionCount > 0) && 'もすべて削除されます。'}
              <span className="text-red-600 font-medium"> この操作は取り消せません。</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? '削除中...' : '削除する'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AxisTree({ axes, modelId }: { axes: any[]; modelId: string }) {
  const flatten = (list: any[]): any[] =>
    list.flatMap((a) => [
      {
        id: a.id,
        name: a.name,
        description: a.description,
        rubricLevels: a.rubricLevels ?? [],
      },
      ...flatten(a.children ?? []),
    ]);
  const allAxes = flatten(axes);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {axes.map((axis) => (
        <AxisNode key={axis.id} axis={axis} depth={0} modelId={modelId} allAxes={allAxes} />
      ))}
    </div>
  );
}
