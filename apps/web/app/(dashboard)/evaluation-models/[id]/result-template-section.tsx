'use client';

import { useState, useTransition } from 'react';

const OUTPUT_TYPES = [
  {
    value: 'TYPE_CLASSIFICATION',
    label: 'タイプ分類',
    desc: 'スコアパターンからこの人のタイプを判定（例: リーダー型・スペシャリスト型）',
    configExample: JSON.stringify({
      types: [
        { label: 'リーダー型', description: '高いコミュニケーション力と判断力を持つ', minScores: { コミュニケーション力: 0.7 } },
        { label: 'スペシャリスト型', description: '特定分野に深い専門性を持つ', minScores: { 技術力: 0.8 } },
      ],
      defaultLabel: 'バランス型',
    }, null, 2),
  },
  {
    value: 'SKILL_GAP',
    label: 'スキルギャップ分析',
    desc: '目標スコアとの差分を分析し、育成ポイントを提示',
    configExample: JSON.stringify({
      targets: { 技術力: 0.8, コミュニケーション力: 0.7, カルチャーフィット: 0.6 },
      gapThreshold: 0.2,
    }, null, 2),
  },
  {
    value: 'TENDENCY_MAP',
    label: '傾向マッピング',
    desc: '各軸の傾向を組み合わせた特徴プロファイルを生成',
    configExample: JSON.stringify({
      dimensions: ['技術力', 'コミュニケーション力'],
      labels: { high_high: '全方位型', high_low: '技術特化型', low_high: '調整役型', low_low: '成長期待型' },
    }, null, 2),
  },
  {
    value: 'CUSTOM',
    label: 'カスタム',
    desc: 'AIへのプロンプト指示を自由に設定',
    configExample: JSON.stringify({}, null, 2),
  },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function ResultTemplateSection({
  modelId,
  initialTemplate,
}: {
  modelId: string;
  initialTemplate: any;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [editing, setEditing] = useState(!initialTemplate);
  const [outputType, setOutputType] = useState(initialTemplate?.outputType ?? 'TYPE_CLASSIFICATION');
  const [name, setName] = useState(initialTemplate?.name ?? '');
  const [config, setConfig] = useState(
    initialTemplate?.config ? JSON.stringify(initialTemplate.config, null, 2) : OUTPUT_TYPES[0].configExample,
  );
  const [promptTemplate, setPromptTemplate] = useState(initialTemplate?.promptTemplate ?? '');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleTypeChange(type: string) {
    setOutputType(type);
    const t = OUTPUT_TYPES.find((o) => o.value === type);
    if (t && !initialTemplate) setConfig(t.configExample);
  }

  async function handleSave() {
    setError('');
    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      setError('configのJSONが不正です');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${API}/evaluation-models/${modelId}/result-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, outputType, config: parsedConfig, promptTemplate: promptTemplate || undefined }),
        });
        if (!res.ok) throw new Error('保存に失敗しました');
        const json = await res.json();
        setTemplate(json.data ?? json);
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  const selectedType = OUTPUT_TYPES.find((o) => o.value === outputType);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">結果テンプレート</h2>
          <p className="text-xs text-gray-400 mt-0.5">この評価モデルがどんな結果を出力するかを定義します</p>
        </div>
        {!editing && template && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            編集
          </button>
        )}
      </div>

      {!editing && template ? (
        <div className="space-y-3">
          <div className="flex gap-3 text-sm">
            <span className="text-gray-500 w-32">出力タイプ</span>
            <span className="font-medium text-gray-800">
              {OUTPUT_TYPES.find((o) => o.value === template.outputType)?.label ?? template.outputType}
            </span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-gray-500 w-32">テンプレート名</span>
            <span className="text-gray-800">{template.name}</span>
          </div>
          {template.promptTemplate && (
            <div className="flex gap-3 text-sm">
              <span className="text-gray-500 w-32">追加指示</span>
              <span className="text-gray-700">{template.promptTemplate}</span>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-1">Config</p>
            <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-auto">
              {JSON.stringify(template.config, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">出力タイプ</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    outputType === t.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="outputType"
                    value={t.value}
                    checked={outputType === t.value}
                    onChange={() => handleTypeChange(t.value)}
                    className="sr-only"
                  />
                  <p className="text-sm font-medium text-gray-900">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              テンプレート名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`例: ${selectedType?.label}テンプレート`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Config <span className="text-xs text-gray-400">（JSON）</span>
            </label>
            <p className="text-xs text-gray-400 mb-1">{selectedType?.desc}</p>
            <textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AIへの追加指示 <span className="text-xs text-gray-400">（任意）</span>
            </label>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="例: 結果はポジティブな表現で記述してください。採用文脈で使用します。"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isPending || !name}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
            {template && (
              <button
                onClick={() => setEditing(false)}
                className="px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
