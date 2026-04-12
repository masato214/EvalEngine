'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X, LayoutGrid, ChevronDown } from 'lucide-react';
import {
  createOutputFormat,
  updateOutputFormat,
  deleteOutputFormat,
} from '@/actions/model-builder.actions';

// ─── 出力タイプ定義 ──────────────────────────────────────────────────────────

const OUTPUT_TYPES = [
  {
    value: 'TYPE_CLASSIFICATION',
    label: 'タイプ分類',
    desc: 'スコアパターンからタイプを判定（例: リーダー型・スペシャリスト型）',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'SKILL_GAP',
    label: 'スキルギャップ',
    desc: '目標スコアとの差分を分析し、育成ポイントを提示',
    color: 'bg-orange-100 text-orange-700',
  },
  {
    value: 'TENDENCY_MAP',
    label: '傾向マッピング',
    desc: '2つの軸を組み合わせた4象限プロファイルを生成',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'CUSTOM',
    label: 'カスタム',
    desc: 'AIへのプロンプト指示を自由に設定',
    color: 'bg-gray-100 text-gray-700',
  },
] as const;

type OutputTypeValue = (typeof OUTPUT_TYPES)[number]['value'];

interface OutputFormat {
  id: string;
  name: string;
  description?: string;
  outputType: string;
  config: any;
  promptTemplate?: string;
  order: number;
}

// ─── タイプ分類フォーム ───────────────────────────────────────────────────────

interface TypeItem {
  label: string;
  description: string;
  minScores: Record<string, string>; // axisName → score string
}

function TypeClassificationForm({
  axes,
  value,
  onChange,
}: {
  axes: { id: string; name: string }[];
  value: any;
  onChange: (v: any) => void;
}) {
  const [types, setTypes] = useState<TypeItem[]>(() => {
    const t = value?.types ?? [];
    return t.length > 0
      ? t.map((item: any) => ({
          label: item.label ?? '',
          description: item.description ?? '',
          minScores: Object.fromEntries(
            Object.entries(item.minScores ?? {}).map(([k, v]) => [k, String(v)]),
          ),
        }))
      : [{ label: '', description: '', minScores: {} }];
  });
  const [defaultLabel, setDefaultLabel] = useState(value?.defaultLabel ?? 'バランス型');

  function emit(newTypes: TypeItem[], newDefault: string) {
    onChange({
      types: newTypes.map((t) => ({
        label: t.label,
        description: t.description,
        minScores: Object.fromEntries(
          Object.entries(t.minScores)
            .filter(([, v]) => v !== '')
            .map(([k, v]) => [k, parseFloat(v)]),
        ),
      })),
      defaultLabel: newDefault,
    });
  }

  function addType() {
    const updated = [...types, { label: '', description: '', minScores: {} }];
    setTypes(updated);
    emit(updated, defaultLabel);
  }

  function removeType(i: number) {
    const updated = types.filter((_, idx) => idx !== i);
    setTypes(updated);
    emit(updated, defaultLabel);
  }

  function updateType(i: number, field: keyof Omit<TypeItem, 'minScores'>, val: string) {
    const updated = types.map((t, idx) => (idx === i ? { ...t, [field]: val } : t));
    setTypes(updated);
    emit(updated, defaultLabel);
  }

  function updateScore(i: number, axisName: string, val: string) {
    const updated = types.map((t, idx) =>
      idx === i ? { ...t, minScores: { ...t.minScores, [axisName]: val } } : t,
    );
    setTypes(updated);
    emit(updated, defaultLabel);
  }

  function updateDefault(val: string) {
    setDefaultLabel(val);
    emit(types, val);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">回答者をどのタイプに分類するかを定義します</p>
        <button
          type="button"
          onClick={addType}
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Plus size={12} /> タイプを追加
        </button>
      </div>

      {types.map((t, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2 relative">
          <button
            type="button"
            onClick={() => removeType(i)}
            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
          >
            <X size={13} />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">タイプ名 *</label>
              <input
                type="text"
                value={t.label}
                onChange={(e) => updateType(i, 'label', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="例: リーダー型"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">説明</label>
              <input
                type="text"
                value={t.description}
                onChange={(e) => updateType(i, 'description', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="例: 高いコミュニケーション力と判断力"
              />
            </div>
          </div>
          {axes.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                このタイプと判定する最低スコア（0〜1、空欄=条件なし）
              </label>
              <div className="grid grid-cols-2 gap-2">
                {axes.map((ax) => (
                  <div key={ax.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 truncate flex-1">{ax.name}</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={t.minScores[ax.name] ?? ''}
                      onChange={(e) => updateScore(i, ax.name, e.target.value)}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center"
                      placeholder="0.7"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          どのタイプにも該当しない場合のデフォルトラベル
        </label>
        <input
          type="text"
          value={defaultLabel}
          onChange={(e) => updateDefault(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="例: バランス型"
        />
      </div>
    </div>
  );
}

// ─── スキルギャップフォーム ────────────────────────────────────────────────────

function SkillGapForm({
  axes,
  value,
  onChange,
}: {
  axes: { id: string; name: string }[];
  value: any;
  onChange: (v: any) => void;
}) {
  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const t = value?.targets ?? {};
    return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, String(v)]));
  });
  const [gapThreshold, setGapThreshold] = useState(String(value?.gapThreshold ?? 0.2));

  function emit(newTargets: Record<string, string>, newGap: string) {
    onChange({
      targets: Object.fromEntries(
        Object.entries(newTargets)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => [k, parseFloat(v)]),
      ),
      gapThreshold: parseFloat(newGap) || 0.2,
    });
  }

  function updateTarget(axisName: string, val: string) {
    const updated = { ...targets, [axisName]: val };
    setTargets(updated);
    emit(updated, gapThreshold);
  }

  function updateGap(val: string) {
    setGapThreshold(val);
    emit(targets, val);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        各軸の目標スコアを設定します。実際のスコアとの差分がギャップとして表示されます。
      </p>
      {axes.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
          評価軸を先に作成してください
        </p>
      )}
      {axes.map((ax) => (
        <div key={ax.id} className="flex items-center gap-3">
          <span className="text-sm text-gray-700 flex-1">{ax.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">目標スコア</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={targets[ax.name] ?? ''}
              onChange={(e) => updateTarget(ax.name, e.target.value)}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="0.8"
            />
          </div>
          <div className="w-32">
            <div
              className="h-2 bg-blue-200 rounded-full"
              style={{
                width: `${Math.min(parseFloat(targets[ax.name] ?? '0') * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <label className="text-xs text-gray-600 flex-1">ギャップ検出の閾値（この値以上の差をギャップとみなす）</label>
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={gapThreshold}
          onChange={(e) => updateGap(e.target.value)}
          className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
    </div>
  );
}

// ─── 傾向マッピングフォーム ────────────────────────────────────────────────────

function TendencyMapForm({
  axes,
  value,
  onChange,
}: {
  axes: { id: string; name: string }[];
  value: any;
  onChange: (v: any) => void;
}) {
  const [dim1, setDim1] = useState(value?.dimensions?.[0] ?? '');
  const [dim2, setDim2] = useState(value?.dimensions?.[1] ?? '');
  const [labels, setLabels] = useState({
    high_high: value?.labels?.high_high ?? '',
    high_low: value?.labels?.high_low ?? '',
    low_high: value?.labels?.low_high ?? '',
    low_low: value?.labels?.low_low ?? '',
  });

  function emit(
    newDim1: string,
    newDim2: string,
    newLabels: typeof labels,
  ) {
    onChange({
      dimensions: [newDim1, newDim2].filter(Boolean),
      labels: newLabels,
    });
  }

  function updateLabel(key: keyof typeof labels, val: string) {
    const updated = { ...labels, [key]: val };
    setLabels(updated);
    emit(dim1, dim2, updated);
  }

  const dim1Label = dim1 || '軸1';
  const dim2Label = dim2 || '軸2';

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        2つの評価軸を選んで4象限のプロファイルを定義します
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">横軸（X軸）</label>
          <select
            value={dim1}
            onChange={(e) => { setDim1(e.target.value); emit(e.target.value, dim2, labels); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          >
            <option value="">軸を選択...</option>
            {axes.map((ax) => (
              <option key={ax.id} value={ax.name}>{ax.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">縦軸（Y軸）</label>
          <select
            value={dim2}
            onChange={(e) => { setDim2(e.target.value); emit(dim1, e.target.value, labels); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          >
            <option value="">軸を選択...</option>
            {axes.map((ax) => (
              <option key={ax.id} value={ax.name}>{ax.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4象限ラベル */}
      <div>
        <label className="block text-xs text-gray-600 mb-2">4象限のラベル</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-2">
            <p className="text-xs text-green-600 mb-1">
              {dim1Label}↑ × {dim2Label}↑
            </p>
            <input
              type="text"
              value={labels.high_high}
              onChange={(e) => updateLabel('high_high', e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              placeholder="例: 全方位型"
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-600 mb-1">
              {dim1Label}↑ × {dim2Label}↓
            </p>
            <input
              type="text"
              value={labels.high_low}
              onChange={(e) => updateLabel('high_low', e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              placeholder="例: 技術特化型"
            />
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-xs text-yellow-600 mb-1">
              {dim1Label}↓ × {dim2Label}↑
            </p>
            <input
              type="text"
              value={labels.low_high}
              onChange={(e) => updateLabel('low_high', e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              placeholder="例: 調整役型"
            />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
            <p className="text-xs text-gray-500 mb-1">
              {dim1Label}↓ × {dim2Label}↓
            </p>
            <input
              type="text"
              value={labels.low_low}
              onChange={(e) => updateLabel('low_low', e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              placeholder="例: 成長期待型"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── カスタムフォーム ────────────────────────────────────────────────────────

function CustomForm({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        AIへの指示を自由に記述します。スコアや軸名を参照して説明文・コメントを生成します。
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        placeholder={`例:
結果はポジティブな表現で記述してください。
採用文脈で使用します。各軸のスコアを踏まえて、
応募者の強みと成長ポテンシャルを200字以内で説明してください。`}
      />
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  outputType: OutputTypeValue;
  config: any;
  promptTemplate: string;
}

const defaultForm = (): FormState => ({
  name: '',
  description: '',
  outputType: 'TYPE_CLASSIFICATION',
  config: { types: [], defaultLabel: 'バランス型' },
  promptTemplate: '',
});

function configFromFormat(fmt: OutputFormat): any {
  return fmt.config ?? {};
}

interface Props {
  modelId: string;
  initialFormats: OutputFormat[];
  axes: { id: string; name: string }[];
}

export function OutputFormatsSection({ modelId, initialFormats, axes }: Props) {
  const [formats, setFormats] = useState<OutputFormat[]>(initialFormats);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditingId(null);
    setForm(defaultForm());
    setError('');
    setShowForm(true);
  }

  function openEdit(fmt: OutputFormat) {
    setEditingId(fmt.id);
    setForm({
      name: fmt.name,
      description: fmt.description ?? '',
      outputType: (fmt.outputType as OutputTypeValue) ?? 'TYPE_CLASSIFICATION',
      config: configFromFormat(fmt),
      promptTemplate: fmt.promptTemplate ?? '',
    });
    setError('');
    setShowForm(true);
  }

  function handleTypeChange(type: OutputTypeValue) {
    if (editingId) {
      setForm((prev) => ({ ...prev, outputType: type }));
    } else {
      // 新規作成時はconfigをリセット
      const defaultConfigs: Record<OutputTypeValue, any> = {
        TYPE_CLASSIFICATION: { types: [], defaultLabel: 'バランス型' },
        SKILL_GAP: { targets: {}, gapThreshold: 0.2 },
        TENDENCY_MAP: { dimensions: [], labels: {} },
        CUSTOM: {},
      };
      setForm((prev) => ({ ...prev, outputType: type, config: defaultConfigs[type] }));
    }
  }

  async function handleSave() {
    setError('');
    if (!form.name.trim()) { setError('名前は必須です'); return; }

    startTransition(async () => {
      try {
        const body = {
          name: form.name,
          description: form.description || undefined,
          outputType: form.outputType,
          config: form.outputType === 'CUSTOM' ? {} : form.config,
          promptTemplate: form.outputType === 'CUSTOM' ? form.promptTemplate || undefined : form.promptTemplate || undefined,
        };

        if (editingId) {
          const updated = await updateOutputFormat(modelId, editingId, body);
          setFormats((prev) => prev.map((f) => (f.id === editingId ? { ...f, ...updated } : f)));
        } else {
          const created = await createOutputFormat(modelId, body);
          setFormats((prev) => [...prev, created]);
        }

        setShowForm(false);
        setEditingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('この出力形式を削除しますか？')) return;
    startTransition(async () => {
      try {
        await deleteOutputFormat(modelId, id);
        setFormats((prev) => prev.filter((f) => f.id !== id));
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  const selectedType = OUTPUT_TYPES.find((o) => o.value === form.outputType);

  return (
    <div>
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">出力形式</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            この評価モデルがどんな結果を出力するかを定義します（複数設定可）
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            追加
          </button>
        )}
      </div>

      {/* エラー表示（フォーム外） */}
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* 既存の出力形式カード一覧 */}
      {formats.length > 0 && !showForm && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {formats.map((fmt) => {
            const typeInfo = OUTPUT_TYPES.find((t) => t.value === fmt.outputType);
            return (
              <div
                key={fmt.id}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <LayoutGrid size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 truncate">{fmt.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => openEdit(fmt)}
                      className="text-gray-400 hover:text-blue-500 p-1 rounded transition-colors"
                      title="編集"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(fmt.id)}
                      disabled={isPending}
                      className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors disabled:opacity-50"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo?.color ?? 'bg-gray-100 text-gray-500'}`}>
                    {typeInfo?.label ?? fmt.outputType}
                  </span>
                </div>
                {fmt.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{fmt.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 空の状態 */}
      {formats.length === 0 && !showForm && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <LayoutGrid size={24} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">出力形式がまだ設定されていません</p>
          <p className="text-xs text-gray-400 mt-1">「追加」ボタンから最初の出力形式を設定してください</p>
        </div>
      )}

      {/* 作成/編集フォーム */}
      {showForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-800">
              {editingId ? '出力形式を編集' : '新しい出力形式を作成'}
            </h3>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setError(''); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-5">
            {/* 出力タイプ */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">出力タイプ</label>
              <div className="grid grid-cols-2 gap-2">
                {OUTPUT_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      form.outputType === t.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="outputType"
                      value={t.value}
                      checked={form.outputType === t.value}
                      onChange={() => handleTypeChange(t.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${t.color}`}>
                        {t.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{t.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* 名前 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`例: ${selectedType?.label}テンプレート`}
              />
            </div>

            {/* 説明 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">説明（任意）</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="この出力形式の用途を簡潔に"
              />
            </div>

            {/* タイプ別設定 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-700 mb-3">
                {selectedType?.label}の設定
              </p>
              {form.outputType === 'TYPE_CLASSIFICATION' && (
                <TypeClassificationForm
                  axes={axes}
                  value={form.config}
                  onChange={(v) => setForm((prev) => ({ ...prev, config: v }))}
                />
              )}
              {form.outputType === 'SKILL_GAP' && (
                <SkillGapForm
                  axes={axes}
                  value={form.config}
                  onChange={(v) => setForm((prev) => ({ ...prev, config: v }))}
                />
              )}
              {form.outputType === 'TENDENCY_MAP' && (
                <TendencyMapForm
                  axes={axes}
                  value={form.config}
                  onChange={(v) => setForm((prev) => ({ ...prev, config: v }))}
                />
              )}
              {form.outputType === 'CUSTOM' && (
                <CustomForm
                  value={form.promptTemplate}
                  onChange={(v) => setForm((prev) => ({ ...prev, promptTemplate: v }))}
                />
              )}
            </div>

            {/* AIへの追加指示（CUSTOM以外） */}
            {form.outputType !== 'CUSTOM' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  AIへの追加指示 <span className="text-xs text-gray-400 font-normal">（任意）</span>
                </label>
                <textarea
                  value={form.promptTemplate}
                  onChange={(e) => setForm((prev) => ({ ...prev, promptTemplate: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="例: 結果はポジティブな表現で記述してください。採用文脈で使用します。"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isPending || !form.name}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setError(''); }}
                className="px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
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
