'use client';

import { useState, useTransition } from 'react';
import { testRunModel } from '@/actions/model-builder.actions';
import { ChevronRight, RotateCcw, Play, TrendingUp, AlertCircle, Layers, BarChart2, Target, FileText, MapPin, X, ChevronDown, Info, Cpu, Brain, Scale, AlertTriangle, ExternalLink } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  type: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  required: boolean;
  options?: { id: string; label: string; value: string; order: number }[];
  axisBreadcrumb: string[];
  axisName: string;
}

interface OutputFormat {
  id: string;
  name: string;
  description?: string;
  outputType: string;
  order: number;
  config?: any;
  promptTemplate?: string;
}

interface QuestionGroup {
  id: string;
  name: string;
  description?: string;
  groupType: string;
  isActive?: boolean;
  items?: {
    questionId: string;
    displayText?: string | null;
    order: number;
    block?: string | null;
    shuffleGroup?: string | null;
    required?: boolean;
  }[];
  _count?: { items?: number; sessions?: number };
}

interface TestResult {
  modelName: string;
  overallScore: number;
  overallRubricLevel: number;
  overallPercent: number;
  axisScores: AxisScore[];
  formattedOutputs?: Record<string, any>; // formatId → AI-generated output
  note?: string;
}

interface RubricSim {
  level: number;
  label?: string;
  similarity: number;
  normalized: number;
  sharpened: number;
  weight: number;
}

interface ScoreDetail {
  scoreMethod: string;
  selectedOptionLabels?: string[];
  exclusiveOptionSelected?: boolean;
  exclusiveFiltered?: boolean;
  rubricSimilarities?: RubricSim[];
  meanCos?: number;
  maxCos?: number;
  qualityScore?: number;
  relevanceScore?: number;
  llmLevel?: number;
  llmIsRelevant?: boolean;
  llmRationale?: string;
  llmEmbeddingCorrection?: number;
  rawValue?: number;
  scaleMin?: number;
  scaleMax?: number;
}

interface QuestionScore {
  questionId: string;
  text: string;
  type?: string;
  answered: boolean;
  weight?: number;
  score: number | null;
  percent: number | null;
  rubricLevel: number | null;
  detail?: ScoreDetail | null;
}

interface AxisScore {
  axisId: string;
  axisName: string;
  score: number;
  rubricLevel: number;
  percent: number;
  questionScores: QuestionScore[];
  childScores?: AxisScore[];
}

function ScoreBar({ percent, color = 'bg-blue-500' }: { percent: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function getRubricColor(level: number) {
  if (level >= 4.5) return 'text-green-700 bg-green-100';
  if (level >= 3.5) return 'text-blue-700 bg-blue-100';
  if (level >= 2.5) return 'text-yellow-700 bg-yellow-100';
  if (level >= 1.5) return 'text-orange-700 bg-orange-100';
  return 'text-red-700 bg-red-100';
}

function getBarColor(percent: number) {
  if (percent >= 80) return 'bg-green-500';
  if (percent >= 60) return 'bg-blue-500';
  if (percent >= 40) return 'bg-yellow-500';
  if (percent >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

// ── Question Score Row with expandable detail ────────────────────────────────

function QuestionScoreRow({ q }: { q: QuestionScore }) {
  const [showDetail, setShowDetail] = useState(false);
  const pct = q.percent ?? 0;
  const rl = q.rubricLevel;
  const barC = q.answered && q.score !== null ? getBarColor(pct) : 'bg-gray-200';
  const typeLabel: Record<string, string> = {
    FREE_TEXT: '自由記述', SCALE: 'スケール',
    SINGLE_CHOICE: '単一選択', MULTIPLE_CHOICE: '複数選択',
  };
  const hasDetail = !!q.detail && q.answered;

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
      {/* Question header */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`mt-0.5 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${q.answered ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
          {typeLabel[q.type ?? ''] ?? q.type}
        </span>
        <span className="text-xs text-gray-700 leading-snug flex-1">{q.text}</span>
      </div>

      {/* Score bar */}
      {q.answered && q.score !== null ? (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all duration-700 ${barC}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="font-bold text-sm text-gray-800 w-10 text-right flex-shrink-0">{pct}%</span>
            {rl !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${getRubricColor(rl)}`}>
                Lv{rl.toFixed(1)}
              </span>
            )}
            {hasDetail && (
              <button
                onClick={() => setShowDetail((v) => !v)}
                className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded border transition-colors flex-shrink-0 ${
                  showDetail
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                    : 'border-gray-200 text-gray-400 hover:border-indigo-200 hover:text-indigo-500'
                }`}
              >
                <Info size={10} />
                詳細
                <ChevronDown size={10} className={`transition-transform ${showDetail ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          {showDetail && q.detail && <ScoreDetailPanel detail={q.detail} percent={pct} />}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5" />
          <span className="text-xs text-gray-400 font-medium">未回答 (0%)</span>
        </div>
      )}
    </div>
  );
}

// ── Score Detail Panel ────────────────────────────────────────────────────────

function ScoreDetailPanel({ detail, percent }: { detail: ScoreDetail; percent: number | null }) {
  const method = detail.scoreMethod;

  return (
    <div className="mt-2 rounded-lg bg-white border border-gray-200 text-xs overflow-hidden">

      {/* ── 矛盾選択警告 ──────────────────────────────────────────────── */}
      {detail.exclusiveOptionSelected && (
        <div className={`flex items-start gap-2 px-3 py-2 ${detail.exclusiveFiltered ? 'bg-yellow-50 border-b border-yellow-100' : 'bg-orange-50 border-b border-orange-100'}`}>
          <AlertTriangle size={12} className={`flex-shrink-0 mt-0.5 ${detail.exclusiveFiltered ? 'text-yellow-600' : 'text-orange-600'}`} />
          <div>
            {detail.exclusiveFiltered ? (
              <span className="text-yellow-700">
                <strong>矛盾選択を自動修正</strong>：「特定のツールは使っていない」と他の選択肢が同時に選ばれていたため、「使っていない」を除外してスコアを計算しました。
              </span>
            ) : (
              <span className="text-orange-700">
                <strong>排他的選択肢のみ選択</strong>：「特定のツールは使っていない」のみ選択されたため、スコアは0です。
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── SCALE ─────────────────────────────────────────────────────── */}
      {method === 'scale_linear' && (
        <div className="px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-500 font-medium mb-1.5">
            <Scale size={11} />スケール線形変換
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span>入力値：<strong className="text-gray-800">{detail.rawValue}</strong></span>
            <span className="text-gray-300">|</span>
            <span>範囲：{detail.scaleMin} 〜 {detail.scaleMax}</span>
            <span className="text-gray-300">|</span>
            <span>計算：({detail.rawValue} − {detail.scaleMin}) ÷ ({detail.scaleMax} − {detail.scaleMin}) = <strong className="text-blue-600">{percent}%</strong></span>
          </div>
        </div>
      )}

      {/* ── FREE_TEXT LLM ─────────────────────────────────────────────── */}
      {method === 'llm_primary' && (
        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-purple-600 font-medium">
            <Brain size={11} />LLM評価（GPT-4o-mini）
          </div>

          {/* Embedding pre-check */}
          {detail.meanCos != null && (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="w-28 flex-shrink-0 text-gray-400">embedding事前チェック</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, detail.meanCos * 200)}%` }} />
              </div>
              <span className="font-mono text-gray-600">mean_cos={detail.meanCos.toFixed(3)}</span>
              {detail.meanCos < 0.20 && <span className="text-red-500 font-medium">→ LLMスキップ</span>}
              {detail.meanCos >= 0.20 && detail.meanCos < 0.30 && <span className="text-yellow-600">→ 補正あり</span>}
              {detail.meanCos >= 0.30 && <span className="text-green-600">→ 関連性OK</span>}
            </div>
          )}

          {/* LLM result */}
          {detail.llmLevel != null && (
            <div className="bg-purple-50 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-gray-500">判定レベル：</span>
                <span className={`font-bold text-sm px-2 py-0.5 rounded ${detail.llmIsRelevant ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                  {detail.llmIsRelevant ? `Lv ${detail.llmLevel?.toFixed(1)}` : '無関連 (0)'}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-mono text-gray-600">
                  ({(detail.llmLevel ?? 0).toFixed(1)} − 1) ÷ 4 = {detail.llmIsRelevant ? ((((detail.llmLevel ?? 1) - 1) / 4) * 100).toFixed(0) : 0}%
                </span>
              </div>
              {detail.llmRationale && (
                <p className="text-gray-600 leading-relaxed border-t border-purple-100 pt-1 mt-1">
                  <span className="text-purple-500 font-medium">根拠：</span>{detail.llmRationale}
                </p>
              )}
            </div>
          )}

          {/* Embedding correction */}
          {detail.llmEmbeddingCorrection != null && detail.llmEmbeddingCorrection < 1.0 && (
            <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 rounded px-2 py-1.5">
              <Info size={10} className="flex-shrink-0" />
              <span>
                embedding補正：mean_cos({detail.meanCos?.toFixed(3)}) &lt; 0.30 → 補正係数 <strong>{detail.llmEmbeddingCorrection.toFixed(3)}</strong> を乗算
                → {((((detail.llmLevel ?? 1) - 1) / 4) * detail.llmEmbeddingCorrection * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── CHOICE / FREE_TEXT fallback: embedding rubric ─────────────── */}
      {method === 'embedding_rubric' && (
        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-blue-600 font-medium">
            <Cpu size={11} />埋め込みベクトル × ルーブリック類似度
          </div>

          {/* Selected options */}
          {detail.selectedOptionLabels && detail.selectedOptionLabels.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 flex-shrink-0 w-20">選択肢</span>
              <div className="flex flex-wrap gap-1">
                {detail.selectedOptionLabels.map((lbl, i) => (
                  <span key={i} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">{lbl}</span>
                ))}
                {detail.exclusiveFiltered && (
                  <span className="bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded text-xs line-through opacity-60">排他的選択肢（除外）</span>
                )}
              </div>
            </div>
          )}

          {/* Mean/max cos */}
          {detail.meanCos != null && (
            <div className="flex items-center gap-3 text-gray-500">
              <span>mean_cos=<strong className="text-gray-700">{detail.meanCos.toFixed(3)}</strong></span>
              {detail.maxCos != null && <span>max_cos=<strong className="text-gray-700">{detail.maxCos.toFixed(3)}</strong></span>}
              <span className="text-gray-300 text-xs">（全ルーブリックへの平均/最大コサイン類似度）</span>
            </div>
          )}

          {/* Why low scores for "good" options */}
          {detail.meanCos != null && detail.meanCos < 0.45 && detail.selectedOptionLabels && detail.selectedOptionLabels.length > 0 && (
            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 text-amber-700">
              <Info size={10} className="flex-shrink-0 mt-0.5" />
              <span>mean_cos が低い（{detail.meanCos.toFixed(3)}）のは、選択肢のテキストが「ツール名」でルーブリックが「能力記述」のため意味空間が異なるからです。選択肢の「意味テキスト」欄に能力を記述すると精度が上がります。</span>
            </div>
          )}

          {/* Rubric similarity table */}
          {detail.rubricSimilarities && detail.rubricSimilarities.length > 0 && (
            <div className="space-y-1">
              <p className="text-gray-400 mb-1">ルーブリック各レベルとのコサイン類似度：</p>
              {[...detail.rubricSimilarities].sort((a, b) => b.level - a.level).map((rs) => {
                const barW = Math.round(rs.similarity * 200); // scale for visibility
                const isTop = rs.weight === Math.max(...detail.rubricSimilarities!.map(r => r.weight));
                return (
                  <div key={rs.level} className={`flex items-center gap-2 rounded px-1.5 py-1 ${isTop ? 'bg-blue-50' : ''}`}>
                    <span className={`w-20 flex-shrink-0 font-medium ${isTop ? 'text-blue-700' : 'text-gray-500'}`}>
                      Lv{rs.level}{rs.label ? `（${rs.label}）` : ''}
                    </span>
                    <div className="w-24 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                      <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, barW)}%` }} />
                    </div>
                    <span className="font-mono text-gray-600 w-12">{rs.similarity.toFixed(3)}</span>
                    <span className="text-gray-400 w-16">相対:{(rs.normalized * 100).toFixed(0)}%</span>
                    <span className={`font-mono w-12 ${isTop ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                      寄与:{(rs.weight * 100).toFixed(0)}%
                    </span>
                    {isTop && <span className="text-blue-600 font-medium">← 最近傍</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quality score and relevance gate */}
          {detail.qualityScore != null && (
            <div className="flex items-center gap-3 border-t border-gray-100 pt-2 text-gray-600">
              <span>品質スコア（加重平均ルーブリック）：<strong>{(detail.qualityScore * 100).toFixed(0)}%</strong></span>
              {detail.relevanceScore != null && (
                <>
                  <span className="text-gray-300">×</span>
                  <span>関連性ゲート：<strong className={detail.relevanceScore < 0.5 ? 'text-orange-600' : 'text-green-600'}>{(detail.relevanceScore * 100).toFixed(0)}%</strong></span>
                  <span className="text-gray-300">=</span>
                  <span className="text-blue-600 font-bold">最終：{percent}%</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── fallback_zero / exclusive_zero ───────────────────────────── */}
      {(method === 'fallback_zero' || method === 'exclusive_zero') && (
        <div className="px-3 py-2 flex items-center gap-2 text-gray-500">
          <Info size={11} />
          <span>{method === 'exclusive_zero' ? '排他的選択肢のみ選択 → スコア0' : 'ルーブリック未設定またはembeddingなし → スコア0'}</span>
        </div>
      )}
    </div>
  );
}

function AxisResultCard({ axis, depth = 0 }: { axis: AxisScore; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = axis.childScores && axis.childScores.length > 0;
  const hasQuestions = axis.questionScores && axis.questionScores.length > 0;
  const rubricColor = getRubricColor(axis.rubricLevel);
  const barColor = getBarColor(axis.percent);

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l-2 border-gray-100 pl-3' : ''}`}>
      <div
        className={`flex items-center gap-3 py-2.5 ${hasChildren || hasQuestions ? 'cursor-pointer' : ''}`}
        onClick={() => (hasChildren || hasQuestions) && setExpanded((v) => !v)}
      >
        {(hasChildren || hasQuestions) && (
          <ChevronRight size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
        {!hasChildren && !hasQuestions && <span className="w-3.5" />}

        <span className={`text-sm font-medium ${depth === 0 ? 'text-gray-900' : 'text-gray-700'}`}>
          {axis.axisName}
        </span>

        <div className="flex-1 min-w-0">
          <ScoreBar percent={axis.percent} color={barColor} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800 w-10 text-right">{axis.percent}%</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rubricColor}`}>
            Lv {axis.rubricLevel.toFixed(1)}
          </span>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {axis.childScores!.map((child) => (
            <AxisResultCard key={child.axisId} axis={child} depth={depth + 1} />
          ))}
        </div>
      )}

      {expanded && !hasChildren && hasQuestions && (
        <div className="ml-5 mt-2 mb-3 space-y-2">
          {axis.questionScores.map((q) => (
            <QuestionScoreRow key={q.questionId} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === 'SCALE') {
    const min = question.scaleMin ?? 1;
    const max = question.scaleMax ?? 5;
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {nums.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`w-10 h-10 rounded-lg border-2 text-sm font-semibold transition-colors ${
                String(value) === String(n)
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {(question.scaleMinLabel || question.scaleMaxLabel) && (
          <div className="flex justify-between mt-1.5 text-xs text-gray-400">
            <span>{question.scaleMinLabel ?? `最小 (${min})`}</span>
            <span>{question.scaleMaxLabel ?? `最大 (${max})`}</span>
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'SINGLE_CHOICE') {
    const opts = [...(question.options ?? [])].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-2">
        {opts.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="hidden"
            />
            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${value === opt.value ? 'border-blue-500' : 'border-gray-300'}`}>
              {value === opt.value && <span className="w-2 h-2 rounded-full bg-blue-500" />}
            </span>
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const opts = [...(question.options ?? [])].sort((a, b) => a.order - b.order);
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {opts.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(checked ? selected.filter((v) => v !== opt.value) : [...selected, opt.value]);
                }}
                className="hidden"
              />
              <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                {checked && <span className="text-white text-xs font-bold">✓</span>}
              </span>
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // FREE_TEXT
  return (
    <textarea
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      placeholder="回答を入力してください"
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
    />
  );
}

// ── Format-specific result views ────────────────────────────────────────────

function flattenAxisScores(axisScores: AxisScore[]): AxisScore[] {
  const result: AxisScore[] = [];
  function walk(scores: AxisScore[]) {
    for (const a of scores) {
      result.push(a);
      if (a.childScores?.length) walk(a.childScores);
    }
  }
  walk(axisScores);
  return result;
}

function FormatResultView({ result, format }: { result: TestResult; format: OutputFormat }) {
  const aiOutput = result.formattedOutputs?.[format.id];
  const allAxes = flattenAxisScores(result.axisScores);
  const scoreByName = Object.fromEntries(allAxes.map((a) => [a.axisName, a.score]));

  // ── TYPE CLASSIFICATION ────────────────────────────────────────────────────
  if (format.outputType === 'TYPE_CLASSIFICATION') {
    const ai = aiOutput?.type_classification;
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={14} className="text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">タイプ分類結果</span>
          <span className="ml-auto text-xs text-purple-400">AI分析</span>
        </div>
        {ai ? (
          <>
            <div className="bg-white rounded-lg p-3 mb-3">
              <p className="text-xs text-purple-500 mb-1">判定タイプ</p>
              <p className="text-xl font-bold text-purple-700">{ai.type_label}</p>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{ai.type_description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xs font-semibold text-green-700 mb-1.5">強み</p>
                <ul className="space-y-1">
                  {(ai.strengths ?? []).map((s: string, i: number) => (
                    <li key={i} className="text-xs text-gray-700 flex gap-1.5"><span className="text-green-500 flex-shrink-0">▲</span>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-orange-50 rounded-lg p-2">
                <p className="text-xs font-semibold text-orange-700 mb-1.5">成長領域</p>
                <ul className="space-y-1">
                  {(ai.growth_areas ?? []).map((s: string, i: number) => (
                    <li key={i} className="text-xs text-gray-700 flex gap-1.5"><span className="text-orange-400 flex-shrink-0">▼</span>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            {ai.all_types_matched?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 mb-1">全タイプ判定</p>
                {ai.all_types_matched.map((t: any) => (
                  <div key={t.label} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded ${t.matched ? 'bg-purple-100' : 'bg-gray-50'}`}>
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.matched ? 'bg-purple-500' : 'bg-gray-300'}`} />
                    <span className={`font-medium flex-shrink-0 ${t.matched ? 'text-purple-700' : 'text-gray-400'}`}>{t.label}</span>
                    <span className="text-gray-500 flex-1">{t.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400 italic">スコアを送信するとAIが分析します</p>
        )}
      </div>
    );
  }

  // ── SKILL GAP ──────────────────────────────────────────────────────────────
  if (format.outputType === 'SKILL_GAP') {
    const ai = aiOutput?.skill_gap;
    const targets: Record<string, number> = format.config?.targets ?? {};
    const gaps = Object.entries(targets).map(([name, target]) => {
      const current = scoreByName[name] ?? 0;
      return { name, current, target: target as number, gap: (target as number) - current };
    }).sort((a, b) => b.gap - a.gap);

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} className="text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">スキルギャップ分析</span>
          <span className="ml-auto text-xs text-blue-400">AI分析</span>
        </div>
        {ai?.summary && (
          <div className="bg-white rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">構造的ギャップ解釈</p>
            <p className="text-xs text-gray-700 leading-relaxed">{ai.summary}</p>
            {ai.priority_action && (
              <div className="mt-2 pt-2 border-t border-blue-100">
                <p className="text-xs font-semibold text-orange-600">🎯 最優先アクション</p>
                <p className="text-xs text-gray-700 mt-0.5">{ai.priority_action}</p>
              </div>
            )}
          </div>
        )}
        <div className="space-y-3">
          {(ai?.gaps?.length ? ai.gaps : gaps.map((g) => ({ axis: g.name, current_pct: Math.round(g.current * 100), target_pct: Math.round(g.target * 100), gap_pct: Math.round(g.gap * 100), root_cause: null, action: null }))).map((g: any) => (
            <div key={g.axis ?? g.name} className="bg-white rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-700 font-medium truncate max-w-[55%]">{g.axis ?? g.name}</span>
                <span className={g.gap_pct > 15 ? 'text-red-600 font-semibold' : g.gap_pct > 0 ? 'text-yellow-600' : 'text-green-600 font-semibold'}>
                  {g.gap_pct > 0 ? `▼ ${g.gap_pct}%不足` : '▲ 目標達成'}
                </span>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                <div className="absolute h-full bg-blue-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, g.current_pct)}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-400" style={{ left: `${g.target_pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>現在: {g.current_pct}%</span><span>目標: {g.target_pct}%</span>
              </div>
              {g.root_cause && <p className="text-xs text-gray-600 mt-1"><span className="font-medium text-gray-500">原因:</span> {g.root_cause}</p>}
              {g.action && <p className="text-xs text-blue-700 mt-1"><span className="font-medium">→</span> {g.action}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── TENDENCY MAP ───────────────────────────────────────────────────────────
  if (format.outputType === 'TENDENCY_MAP') {
    const ai = aiOutput?.tendency_map;
    const axes: { key: string; label: string; color: string }[] = format.config?.axes ?? [];
    const benchmarks = format.config?.benchmarks ?? {};

    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-green-600" />
          <span className="text-sm font-semibold text-green-800">傾向マップ</span>
          <span className="ml-auto text-xs text-green-400">AI分析</span>
        </div>
        {ai && (
          <div className="bg-white rounded-lg p-3 mb-3">
            <p className="text-sm font-bold text-green-700">{ai.pattern_label}</p>
            <p className="text-xs text-gray-700 mt-1 leading-relaxed">{ai.pattern_description}</p>
            {ai.behavioral_implications && (
              <div className="mt-2 pt-2 border-t border-green-100">
                <p className="text-xs font-semibold text-gray-500">実務での行動特性</p>
                <p className="text-xs text-gray-700 mt-0.5">{ai.behavioral_implications}</p>
              </div>
            )}
          </div>
        )}
        <div className="space-y-2.5">
          {axes.map(({ key, label, color }) => {
            const score = scoreByName[key] ?? 0;
            const top = benchmarks.topPerformer?.[key] ?? 0.85;
            const avg = benchmarks.averagePerformer?.[key] ?? 0.6;
            const aiInterpret = ai?.axis_interpretations?.find((x: any) => x.axis === key || x.axis === label);
            return (
              <div key={key} className="bg-white rounded-lg p-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{label}</span>
                  <span className="text-gray-500">{Math.round(score * 100)}%</span>
                </div>
                <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div className="absolute h-full bg-gray-200 rounded-full" style={{ width: `${avg * 100}%` }} />
                  <div className="absolute h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, score * 100)}%`, backgroundColor: color ?? '#3b82f6' }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 opacity-80" style={{ left: `${avg * 100}%` }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-green-500 opacity-80" style={{ left: `${top * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>平均{Math.round(avg * 100)}% / トップ{Math.round(top * 100)}%</span>
                  <span className={score >= top ? 'text-green-600 font-medium' : score >= avg ? 'text-blue-600' : 'text-orange-500'}>
                    {score >= top ? '▲ トップ水準' : score >= avg ? '= 平均水準' : '▼ 平均以下'}
                  </span>
                </div>
                {aiInterpret?.interpretation && (
                  <p className="text-xs text-gray-600 mt-1 italic">{aiInterpret.interpretation}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CUSTOM ─────────────────────────────────────────────────────────────────
  if (format.outputType === 'CUSTOM') {
    const ai = aiOutput?.custom;
    const decisionColor: Record<string, string> = { '◎': 'text-green-700 bg-green-100', '○': 'text-blue-700 bg-blue-100', '△': 'text-yellow-700 bg-yellow-100', '×': 'text-red-700 bg-red-100' };
    const fitColor: Record<string, string> = { '◎': 'text-green-700', '○': 'text-blue-700', '△': 'text-yellow-600', '×': 'text-red-600' };
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={14} className="text-orange-600" />
          <span className="text-sm font-semibold text-orange-800">採用・配置・育成レポート</span>
          <span className="ml-auto text-xs text-orange-400">AI分析</span>
        </div>
        {ai ? (
          <div className="space-y-3">
            {/* Hiring Decision */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1.5">採用判定</p>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-2xl font-black px-3 py-1 rounded-lg ${decisionColor[ai.hiring_decision] ?? 'bg-gray-100 text-gray-700'}`}>{ai.hiring_decision}</span>
                <p className="text-xs text-gray-700 flex-1">{ai.hiring_rationale}</p>
              </div>
            </div>
            {/* Role Fits */}
            {ai.role_fits?.length > 0 && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">適性ポジション</p>
                <div className="space-y-1.5">
                  {ai.role_fits.map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`font-black flex-shrink-0 ${fitColor[r.fit] ?? 'text-gray-500'}`}>{r.fit}</span>
                      <span className="font-medium text-gray-700 flex-shrink-0">{r.role}</span>
                      <span className="text-gray-500">— {r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Development Plan */}
            {ai.development_plan?.length > 0 && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">育成プラン</p>
                <ol className="space-y-1">
                  {ai.development_plan.map((step: string, i: number) => (
                    <li key={i} className="text-xs text-gray-700 flex gap-2">
                      <span className="flex-shrink-0 w-4 h-4 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {/* Summary */}
            {ai.summary && (
              <div className="bg-orange-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-orange-700 mb-1">総合コメント</p>
                <p className="text-xs text-gray-700 leading-relaxed">{ai.summary}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">スコアを送信するとAIが採用・配置・育成プランを生成します</p>
        )}
      </div>
    );
  }

  return null;
}

// ── Score coordinate modal ────────────────────────────────────────────────────

function CoordModal({ result, onClose }: { result: TestResult; onClose: () => void }) {
  const allAxes = flattenAxisScores(result.axisScores);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900">スコア座標</h2>
            <span className="text-xs text-gray-400">（評価空間上の現在地）</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-64px)] p-5 space-y-5">
          {/* Overall coordinate */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-500 mb-2">総合座標</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">スコア (0–1)</p>
                <p className="text-2xl font-bold text-indigo-700">{result.overallScore.toFixed(3)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">ルーブリック Lv</p>
                <p className="text-2xl font-bold text-indigo-700">{result.overallRubricLevel.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">パーセント</p>
                <p className="text-2xl font-bold text-indigo-700">{result.overallPercent}%</p>
              </div>
            </div>
          </div>

          {/* Axis coordinates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3">評価軸座標ベクトル</p>
            <div className="space-y-2">
              {allAxes.map((axis) => {
                const depth = result.axisScores.find(a => a.axisId === axis.axisId) ? 0 : 1;
                return (
                  <div key={axis.axisId} className={`flex items-center gap-3 p-3 rounded-lg border ${depth === 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100 ml-4'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{axis.axisName}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <div className="text-right">
                        <p className="text-gray-400">score</p>
                        <p className="font-mono font-bold text-gray-800">{axis.score.toFixed(3)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400">Lv</p>
                        <p className="font-mono font-bold text-gray-800">{axis.rubricLevel.toFixed(2)}</p>
                      </div>
                      <div className="w-20">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getBarColor(axis.percent)}`}
                            style={{ width: `${axis.percent}%` }}
                          />
                        </div>
                        <p className="text-right text-gray-500 mt-0.5">{axis.percent}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question-level scores */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3">質問レベルスコア（設問座標）</p>
            <div className="space-y-1">
              {allAxes.flatMap((axis) =>
                (axis.questionScores ?? []).map((q) => {
                  const pct = q.percent ?? (q.answered ? Math.round((q.score ?? 0) * 100) : 0);
                  const rl = q.rubricLevel;
                  const barColor = pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400';
                  return (
                    <div key={q.questionId} className="px-3 py-2 rounded-lg bg-white border border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.answered ? 'bg-blue-400' : 'bg-gray-300'}`} />
                        <p className="flex-1 text-xs text-gray-600 truncate">{q.text}</p>
                        <span className="text-xs text-gray-400 flex-shrink-0">{axis.axisName}</span>
                      </div>
                      {q.answered && q.score !== null ? (
                        <div className="flex items-center gap-2 pl-4">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-mono font-bold text-gray-700 w-8 text-right">{pct}%</span>
                          {rl !== null && rl !== undefined && (
                            <span className="text-xs text-gray-400 font-mono">Lv{rl.toFixed(1)}</span>
                          )}
                          <span className="text-xs text-gray-400">{q.type ?? ''}</span>
                        </div>
                      ) : (
                        <div className="pl-4">
                          <span className="text-xs text-gray-400">未回答 (0%)</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-400">
            <p>スコア座標 = 各評価軸における0〜1の実数値ベクトル</p>
            <p className="mt-0.5">本番では各質問回答をEmbeddingし、ルーブリックLv1〜5のEmbeddingとのコサイン類似度でこの座標値が決定されます。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const OUTPUT_TYPE_ICONS: Record<string, JSX.Element> = {
  TYPE_CLASSIFICATION: <Layers size={14} />,
  SKILL_GAP: <BarChart2 size={14} />,
  TENDENCY_MAP: <Target size={14} />,
  CUSTOM: <FileText size={14} />,
};

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  TYPE_CLASSIFICATION: 'タイプ分類',
  SKILL_GAP: 'スキルギャップ',
  TENDENCY_MAP: '傾向マップ',
  CUSTOM: 'カスタム',
};

const OUTPUT_TYPE_COLORS: Record<string, string> = {
  TYPE_CLASSIFICATION: 'bg-purple-100 text-purple-700 border-purple-200',
  SKILL_GAP: 'bg-blue-100 text-blue-700 border-blue-200',
  TENDENCY_MAP: 'bg-green-100 text-green-700 border-green-200',
  CUSTOM: 'bg-orange-100 text-orange-700 border-orange-200',
};

export function TestClient({
  modelId,
  questions,
  outputFormats = [],
  questionGroups = [],
}: {
  modelId: string;
  questions: Question[];
  outputFormats?: OutputFormat[];
  questionGroups?: QuestionGroup[];
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [respondentRef, setRespondentRef] = useState('test-user-001');
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const defaultGroup = questionGroups.find((group) => group.groupType === 'FULL') ?? questionGroups[0] ?? null;
  const [selectedQuestionGroupId, setSelectedQuestionGroupId] = useState<string>(defaultGroup?.id ?? '');
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(
    outputFormats.length > 0 ? outputFormats[0].id : null,
  );
  const [showCoords, setShowCoords] = useState(false);

  const selectedFormat = outputFormats.find((f) => f.id === selectedFormatId) ?? null;
  const selectedQuestionGroup = questionGroups.find((group) => group.id === selectedQuestionGroupId) ?? null;
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const activeQuestions = selectedQuestionGroup
    ? [...(selectedQuestionGroup.items ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((item) => {
          const question = questionById.get(item.questionId);
          if (!question) return null;
          return {
            ...question,
            text: item.displayText || question.text,
            required: item.required ?? question.required,
            groupItem: item,
          };
        })
        .filter(Boolean) as Question[]
    : questions;

  // Group questions by top-level axis
  const grouped: { breadcrumb: string; questions: Question[] }[] = [];
  for (const q of activeQuestions) {
    const key = q.axisBreadcrumb[0] ?? q.axisName;
    const existing = grouped.find((g) => g.breadcrumb === key);
    if (existing) existing.questions.push(q);
    else grouped.push({ breadcrumb: key, questions: [q] });
  }

  const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));
  const answeredCount = Object.keys(answers).filter((questionId) => {
    if (!activeQuestionIds.has(questionId)) return false;
    const v = answers[questionId];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const totalCount = activeQuestions.length;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const items = activeQuestions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? null }));
    startTransition(async () => {
      try {
        const res = await testRunModel(modelId, {
          respondentRef,
          questionGroupId: selectedQuestionGroup?.id,
          outputFormatIds: selectedFormatId ? [selectedFormatId] : undefined,
          items,
        });
        setResult(res);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function openResultPage() {
    if (!result) return;
    // Encode only the essential fields (no question detail) directly into the URL.
    // This avoids any cross-tab storage (localStorage/sessionStorage) entirely.
    const payload = {
      modelName: result.modelName,
      overallScore: result.overallScore,
      overallRubricLevel: result.overallRubricLevel,
      overallPercent: result.overallPercent,
      axisScores: result.axisScores.map((a) => ({
        axisId: a.axisId,
        axisName: a.axisName,
        score: a.score,
        rubricLevel: a.rubricLevel,
        percent: a.percent,
        childScores: (a.childScores ?? []).map((c) => ({
          axisId: c.axisId,
          axisName: c.axisName,
          score: c.score,
          rubricLevel: c.rubricLevel,
          percent: c.percent,
        })),
      })),
      respondentRef,
      timestamp: Date.now(),
    };
    // TextEncoder → Uint8Array → base64 (modern, no deprecated escape/unescape)
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const encoded = btoa(String.fromCharCode(...bytes));
    // encodeURIComponent is REQUIRED: btoa output contains + which URLSearchParams reads as space
    window.open(`/evaluation-models/${modelId}/test/result?d=${encodeURIComponent(encoded)}`, '_blank');
  }

  function handleReset() {
    setAnswers({});
    setResult(null);
    setError('');
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form */}
      <div className="lg:col-span-3">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {questionGroups.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  実行する質問グループ
                </label>
                <select
                  value={selectedQuestionGroupId}
                  onChange={(e) => {
                    setSelectedQuestionGroupId(e.target.value);
                    setResult(null);
                    setError('');
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {questionGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} / {group.groupType} / {group._count?.items ?? group.items?.length ?? 0}問
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  選択した質問グループの質問だけを使ってテストします。テスト実行APIにもこの questionGroupId を渡します。
                </p>
              </div>
            )}

            {/* Respondent ID */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                テスト回答者ID
              </label>
              <input
                type="text"
                value={respondentRef}
                onChange={(e) => setRespondentRef(e.target.value)}
                placeholder="test-user-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">任意の識別子（テスト用）</p>
            </div>

            {/* Questions by group */}
            {grouped.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
                <p className="text-sm text-gray-400">この質問グループには質問が割り当てられていません。</p>
                <p className="text-xs text-gray-400 mt-1">評価モデル詳細の「質問グループ」タブで質問を割り当ててください。</p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.breadcrumb} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">{group.breadcrumb}</h3>
                </div>
                <div className="p-5 space-y-6">
                  {group.questions.map((q, idx) => (
                    <div key={q.id}>
                      {idx > 0 && <div className="border-t border-gray-100 mb-6" />}
                      <div className="mb-1.5 flex items-start gap-2">
                        <span className="text-xs text-gray-400 font-mono mt-0.5">
                          {q.axisBreadcrumb.slice(1).join(' › ')}
                        </span>
                      </div>
                      <label className="block text-sm font-medium text-gray-800 mb-3">
                        {q.text}
                        {q.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <QuestionInput
                        question={q}
                        value={answers[q.id]}
                        onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending || totalCount === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Play size={14} />
                {isPending ? 'スコアリング中...' : 'テスト実行'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm px-3 py-2.5"
              >
                <RotateCcw size={14} />
                リセット
              </button>
              <span className="text-xs text-gray-400 ml-auto">
                {answeredCount} / {totalCount} 問回答済
              </span>
            </div>
          </div>
        </form>
      </div>

      {/* Results panel */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 space-y-4">

          {/* Output format selector */}
          {outputFormats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">出力フォーマット</h3>
              <div className="space-y-2">
                {outputFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormatId(fmt.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedFormatId === fmt.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${OUTPUT_TYPE_COLORS[fmt.outputType] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {OUTPUT_TYPE_ICONS[fmt.outputType]}
                        {OUTPUT_TYPE_LABELS[fmt.outputType] ?? fmt.outputType}
                      </span>
                      {selectedFormatId === fmt.id && (
                        <span className="ml-auto text-blue-500 text-xs font-semibold">選択中</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">{fmt.name}</p>
                    {fmt.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{fmt.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
              <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">テスト実行するとここにスコアが表示されます</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall score + coordinate button */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-800">総合スコア</h3>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={openResultPage}
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300 transition-colors font-medium"
                    >
                      <ExternalLink size={11} />
                      結果ページを開く
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCoords(true)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200 transition-colors"
                    >
                      <MapPin size={11} />
                      スコア座標
                    </button>
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">テスト結果</span>
                  </div>
                </div>
                <div className="flex items-center justify-center mb-2">
                  <div className="relative w-28 h-28">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={result.overallPercent >= 80 ? '#22c55e' : result.overallPercent >= 60 ? '#3b82f6' : result.overallPercent >= 40 ? '#eab308' : '#ef4444'}
                        strokeWidth="10"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - result.overallPercent / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{result.overallPercent}%</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-0.5 ${getRubricColor(result.overallRubricLevel)}`}>
                        Lv {result.overallRubricLevel.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Format-specific result view */}
              {selectedFormat && (
                <FormatResultView result={result} format={selectedFormat} />
              )}

              {/* Axis breakdown */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">評価軸ブレイクダウン</h3>
                <div className="space-y-2">
                  {result.axisScores.map((axis) => (
                    <AxisResultCard key={axis.axisId} axis={axis} depth={0} />
                  ))}
                </div>
              </div>

              {/* Scoring info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-xs text-blue-700 font-medium">OpenAI text-embedding-3-small + コサイン類似度によるルーブリックスコアリング</p>
                <p className="text-xs text-blue-600 mt-1">SCALE=線形正規化 / SINGLE・MULTIPLE_CHOICE=選択肢ベクトルとルーブリックの類似度 / FREE_TEXT=回答テキストのEmbedding×ルーブリック</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Score coordinate modal */}
    {showCoords && result && (
      <CoordModal result={result} onClose={() => setShowCoords(false)} />
    )}
    </>
  );
}
