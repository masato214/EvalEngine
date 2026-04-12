'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Code2,
  ChevronDown, ChevronUp, AlertTriangle, MessageSquare,
  BarChart2, Target, ClipboardList,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  decodePayload, flattenAxes, getRubricColor, getBarColor,
  ResultPayload, AxisScore,
} from '../_shared';
import { NotFoundScreen, LoadingScreen } from '../result-client';

// ── Radar label ───────────────────────────────────────────────────────────────

function RadarLabel({ x, y, cx, cy, payload }: any) {
  const label = (payload.value as string).length > 8
    ? (payload.value as string).slice(0, 8) + '…'
    : payload.value;
  const dx = (x as number) - (cx as number);
  const dy = (y as number) - (cy as number);
  const ox = dx > 2 ? 10 : dx < -2 ? -10 : 0;
  const oy = dy > 2 ? 8 : dy < -2 ? -8 : 0;
  return (
    <text x={(x as number) + ox} y={(y as number) + oy}
      textAnchor={dx > 2 ? 'start' : dx < -2 ? 'end' : 'middle'}
      dominantBaseline="central" fontSize={10} fill="#6b7280">
      {label}
    </text>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMockBenchmark(axisCount: number): number[] {
  const base = [52, 58, 48, 62, 55, 50, 45, 60];
  return Array.from({ length: axisCount }, (_, i) => base[i % base.length]);
}

function overallLevel(pct: number) {
  if (pct >= 80) return { label: 'S', desc: '優秀', sub: '上位5%水準', cls: 'text-green-700 bg-green-50 border-green-200' };
  if (pct >= 70) return { label: 'A', desc: '良好', sub: '上位20%水準', cls: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (pct >= 55) return { label: 'B', desc: '標準', sub: '平均的水準', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
  if (pct >= 40) return { label: 'C', desc: '要支援', sub: '平均以下', cls: 'text-orange-700 bg-orange-50 border-orange-200' };
  return              { label: 'D', desc: '要重点指導', sub: '大幅改善が必要', cls: 'text-red-700 bg-red-50 border-red-200' };
}

function rubricDesc(level: number): string {
  if (level >= 4.5) return '熟達・即戦力レベル';
  if (level >= 3.5) return '概ね習得・応用可能';
  if (level >= 2.5) return '基礎習得・指導で伸びる';
  if (level >= 1.5) return '基礎未達・重点支援が必要';
  return '未習得・入門から支援が必要';
}

function getCounselingPoints(axes: AxisScore[], overall: number): string[] {
  const sorted = [...axes].sort((a, b) => b.percent - a.percent);
  const top    = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const points: string[] = [];

  if (top?.percent >= 70)
    points.push(`「${top.axisName}」が${top.percent}%と高評価。この強みをどのように活かしたいかを引き出す。`);
  else
    points.push(`全軸で突出した強みが見当たらない。得意分野の自己認識を確認し、掘り起こしを行う。`);

  if (bottom?.percent < 45)
    points.push(`「${bottom.axisName}」が${bottom.percent}%と低い。苦手意識の有無・原因を確認し、具体的な改善策を一緒に考える。`);

  if (overall < 50)
    points.push('全体スコアが50%未満。自己評価と比較して乖離がないか確認。モチベーション低下の可能性も検討する。');
  else if (overall >= 70)
    points.push('高いスコアを持ちつつ、本人の自己評価との一致度を確認。過小評価していないかフォローする。');

  points.push('評価結果と今後の進路の関連性について、本人の考えを丁寧にヒアリングする。');
  return points;
}

function getActionPlan(axes: AxisScore[], overall: number) {
  const sorted  = [...axes].sort((a, b) => b.percent - a.percent);
  const weakest = sorted.filter(a => a.percent < 55).slice(0, 2);
  const plan: { term: string; action: string; priority: 'high' | 'medium' | 'low' }[] = [];

  if (overall < 50)
    plan.push({ term: '今すぐ', action: '個別面談を実施し、現状の課題認識と意欲を確認する', priority: 'high' });
  if (weakest[0])
    plan.push({ term: '1ヶ月以内', action: `「${weakest[0].axisName}」の強化を目的とした追加課題・補習の検討`, priority: 'high' });
  if (weakest[1])
    plan.push({ term: '2ヶ月以内', action: `「${weakest[1].axisName}」の理解度を再確認。グループワークやロールプレイを活用`, priority: 'medium' });
  plan.push({ term: '3ヶ月以内', action: '再テストまたは中間評価を実施し、成長度を数値で確認する', priority: 'medium' });
  plan.push({ term: '長期目標', action: '強みの軸を軸にした進路選択肢を整理し、具体的な進路資料収集へ誘導する', priority: 'low' });
  return plan;
}

function getRiskFlags(axes: AxisScore[], overall: number): string[] {
  const flags: string[] = [];
  if (overall < 40) flags.push('総合スコアが40%未満 — 早期の個別サポートを推奨');
  const veryLow = axes.filter(a => a.percent < 30);
  if (veryLow.length > 0) flags.push(`${veryLow.map(a => `「${a.axisName}」`).join('・')}が30%未満 — 集中的なフォローが必要`);
  const gap = axes.length > 1 ? Math.max(...axes.map(a => a.percent)) - Math.min(...axes.map(a => a.percent)) : 0;
  if (gap > 50) flags.push(`最高軸と最低軸のスコア差が${gap}pt超 — 凸凹プロファイル。強みへの偏重に注意`);
  return flags;
}

function getCareerMatrix(axes: AxisScore[]) {
  const sorted = [...axes].sort((a, b) => b.percent - a.percent);
  return [
    {
      fit: sorted[0]?.percent >= 65 ? '◎' : sorted[0]?.percent >= 50 ? '○' : '△',
      path: `${sorted[0]?.axisName ?? ''}を活かした進路`,
      evidence: `${sorted[0]?.axisName ?? ''}: ${sorted[0]?.percent ?? 0}% (Lv${sorted[0]?.rubricLevel?.toFixed(1) ?? '-'})`,
      note: sorted[0]?.percent >= 65 ? '現時点でも十分な適性あり' : '基礎はあるが追加強化を推奨',
    },
    {
      fit: sorted[1]?.percent >= 60 ? '○' : '△',
      path: `${sorted[1]?.axisName ?? ''}関連の進路`,
      evidence: `${sorted[1]?.axisName ?? ''}: ${sorted[1]?.percent ?? 0}% (Lv${sorted[1]?.rubricLevel?.toFixed(1) ?? '-'})`,
      note: sorted[1]?.percent >= 60 ? '伸びしろあり。継続的な育成で有望' : '中期的な育成課題として設定',
    },
    {
      fit: '×',
      path: `${sorted[sorted.length - 1]?.axisName ?? ''}が必須要件の進路`,
      evidence: `${sorted[sorted.length - 1]?.axisName ?? ''}: ${sorted[sorted.length - 1]?.percent ?? 0}%`,
      note: '現段階では適性が低い。本人の意向次第で中長期的な目標に設定',
    },
  ];
}

// ── Main client ───────────────────────────────────────────────────────────────

export function TeacherClient() {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [d, setD] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [showApi, setShowApi] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('d');
    if (!raw) { setNotFound(true); return; }
    try { setPayload(decodePayload(raw)); setD(raw); }
    catch { setNotFound(true); }
  }, []);

  if (notFound) return <NotFoundScreen />;
  if (!payload) return <LoadingScreen />;

  const axes        = flattenAxes(payload.axisScores);
  const sorted      = [...axes].sort((a, b) => b.percent - a.percent);
  const strengths   = sorted.slice(0, Math.ceil(sorted.length / 2));
  const development = sorted.slice(Math.ceil(sorted.length / 2));
  const benchmarks  = getMockBenchmark(axes.length);
  const lv          = overallLevel(payload.overallPercent);
  const counseling  = getCounselingPoints(axes, payload.overallPercent);
  const actionPlan  = getActionPlan(axes, payload.overallPercent);
  const riskFlags   = getRiskFlags(axes, payload.overallPercent);
  const careerMatrix = getCareerMatrix(axes);
  const radarData   = axes.map((a, i) => ({ axis: a.axisName, score: a.percent, benchmark: benchmarks[i] ?? 55, fullMark: 100 }));

  const priorityColors = { high: 'text-red-600 bg-red-50 border-red-200', medium: 'text-yellow-700 bg-yellow-50 border-yellow-200', low: 'text-gray-600 bg-gray-50 border-gray-200' };
  const priorityLabels = { high: '優先', medium: '推奨', low: '任意' };

  const apiShape = {
    endpoint: 'GET /api/v1/results/:resultId/summary',
    model: payload.modelName,
    respondent: payload.respondentRef,
    timestamp: payload.timestamp,
    scores: {
      overall: { score: payload.overallScore, rubricLevel: payload.overallRubricLevel, percent: payload.overallPercent },
      axes: axes.map((a) => ({ id: a.axisId, name: a.axisName, score: a.score, rubricLevel: a.rubricLevel, percent: a.percent })),
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Row 1: Metrics summary + Radar ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5">

          {/* Metrics card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            {/* Letter grade */}
            <div className={`rounded-lg border-2 p-4 text-center ${lv.cls}`}>
              <p className="text-4xl font-black leading-none">{lv.label}</p>
              <p className="text-sm font-bold mt-1">{lv.desc}</p>
              <p className="text-xs opacity-70 mt-0.5">{lv.sub}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                <p className="text-xl font-bold text-gray-900">{payload.overallPercent}<span className="text-xs text-gray-400">%</span></p>
                <p className="text-xs text-gray-500 mt-0.5">総合スコア</p>
              </div>
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                <p className="text-xl font-bold text-gray-900">{payload.overallRubricLevel.toFixed(1)}<span className="text-xs text-gray-400"> Lv</span></p>
                <p className="text-xs text-gray-500 mt-0.5">ルーブリック</p>
              </div>
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                <p className="text-xl font-bold text-gray-900">{axes.length}<span className="text-xs text-gray-400"> 軸</span></p>
                <p className="text-xs text-gray-500 mt-0.5">評価軸数</p>
              </div>
            </div>

            {/* Risk flags */}
            {riskFlags.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={12} className="text-red-600" />
                  <span className="text-xs font-bold text-red-700">要注意フラグ</span>
                </div>
                <ul className="space-y-1">
                  {riskFlags.map((f, i) => (
                    <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                      <span className="font-bold shrink-0">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Radar card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 size={14} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">評価軸レーダー</h2>
              <span className="ml-auto text-xs text-gray-400 flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500 rounded-full" />本人</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-gray-300 rounded-full" />コホート平均</span>
              </span>
            </div>
            {radarData.length >= 3 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 20, right: 55, bottom: 20, left: 55 }}>
                    <PolarGrid stroke="#f3f4f6" />
                    <PolarAngleAxis dataKey="axis" tick={<RadarLabel />} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#d1d5db' }} tickCount={6} />
                    <Radar name="コホート平均" dataKey="benchmark" stroke="#d1d5db" fill="#e5e7eb" fillOpacity={0.4} strokeWidth={1.5} strokeDasharray="4 2" />
                    <Radar name="本人" dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2}
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'スコア']}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {axes.map((a, i) => (
                  <div key={a.axisId} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{a.axisName}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getBarColor(a.percent)}`} style={{ width: `${a.percent}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-9 text-right shrink-0">{a.percent}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 2: Axis detail table + Right column ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">

          {/* Axis detail table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <BarChart2 size={13} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">評価軸詳細スコア</h2>
              <span className="ml-auto text-xs text-gray-400 flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 bg-blue-500 rounded-full" />本人</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 bg-gray-300 rounded-full" />コホート平均</span>
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {sorted.map((axis, idx) => {
                const bench = benchmarks[idx] ?? 55;
                return (
                  <div key={axis.axisId} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-gray-800 flex-1 truncate">{axis.axisName}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0 ${getRubricColor(axis.rubricLevel)}`}>
                        Lv {axis.rubricLevel.toFixed(1)}
                      </span>
                      <span className="text-xs font-bold text-gray-700 w-9 text-right shrink-0">{axis.percent}%</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-10 shrink-0">本人</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${getBarColor(axis.percent)}`} style={{ width: `${axis.percent}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-10 shrink-0">平均</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gray-300" style={{ width: `${bench}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-7 text-right shrink-0">{bench}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{rubricDesc(axis.rubricLevel)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: Career matrix + Strengths/Dev */}
          <div className="flex flex-col gap-5">

            {/* Career matrix */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Target size={13} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-800">進路適性マトリクス</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {careerMatrix.map((row, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-2">
                    <span className={`text-base font-black shrink-0 mt-0.5 w-5 text-center ${
                      row.fit === '◎' ? 'text-green-600' : row.fit === '○' ? 'text-blue-600' : row.fit === '△' ? 'text-yellow-600' : 'text-red-500'
                    }`}>{row.fit}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{row.path}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{row.evidence}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{row.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths / Development */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp size={12} className="text-green-600" />
                  <span className="text-xs font-semibold text-gray-700">強み</span>
                </div>
                <div className="space-y-2">
                  {strengths.map((a) => (
                    <div key={a.axisId}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 truncate mr-1">{a.axisName}</span>
                        <span className="text-xs font-bold text-green-600 shrink-0">{a.percent}%</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{rubricDesc(a.rubricLevel)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown size={12} className="text-orange-500" />
                  <span className="text-xs font-semibold text-gray-700">成長領域</span>
                </div>
                <div className="space-y-2">
                  {development.length > 0 ? development.map((a) => (
                    <div key={a.axisId}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 truncate mr-1">{a.axisName}</span>
                        <span className="text-xs font-bold text-orange-500 shrink-0">{a.percent}%</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{rubricDesc(a.rubricLevel)}</p>
                    </div>
                  )) : <p className="text-xs text-gray-400 italic">全領域高水準</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 3: Counseling + Action plan ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Counseling points */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={13} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">面談・進路指導のポイント</h2>
            </div>
            <ul className="space-y-2.5">
              {counseling.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed">{point}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Action plan */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <ClipboardList size={13} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">指導アクションプラン</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {actionPlan.map((item, i) => (
                <div key={i} className="px-5 py-2.5 flex items-start gap-3">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${priorityColors[item.priority]}`}>
                    {priorityLabels[item.priority]}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 mr-2">{item.term}</span>
                    <span className="text-xs text-gray-700">{item.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── API data ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowApi((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors text-left"
          >
            <Code2 size={13} />
            APIデータ形式（クライアント実装用）
            <span className="ml-auto">{showApi ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
          </button>
          {showApi && (
            <div className="border-t border-gray-100">
              <pre className="px-5 py-4 text-xs text-gray-600 overflow-x-auto leading-relaxed">
                {JSON.stringify(apiShape, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
