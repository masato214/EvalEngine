'use client';

import { useEffect, useState } from 'react';
import {
  GraduationCap, Star, ArrowRight, TrendingUp, Award,
  Lightbulb, Target, CheckCircle, Sparkles, MapPin,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  decodePayload, flattenAxes, getBarColor, getRubricColor,
  COMPANIES, computeMatchScores, ResultPayload, AxisScore,
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

// ── Color map ─────────────────────────────────────────────────────────────────

const colorMap: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  green:  { bar: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  blue:   { bar: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  indigo: { bar: 'bg-indigo-400', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  amber:  { bar: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
};

// ── Career type ───────────────────────────────────────────────────────────────

function getCareerType(axes: AxisScore[], overall: number) {
  if (!axes.length) return null;
  const sorted = [...axes].sort((a, b) => b.percent - a.percent);
  const top = sorted[0];
  const variance = axes.reduce((s, a) => s + Math.pow(a.percent - overall, 2), 0) / axes.length;
  const isSpecialist = variance > 300 && top.percent >= 65;
  const isBalanced   = variance < 150;

  if (overall >= 75) return {
    type: 'オールラウンダー型', emoji: '🌟',
    description: '複数の評価軸で高いスコアを出せる総合力の高いタイプです。どんな環境にも適応しやすく、チームのハブとなれる人材です。',
    careers: ['プロジェクトマネージャー', 'コンサルタント', 'ゼネラリスト営業', '経営企画'],
  };
  if (isSpecialist) return {
    type: 'スペシャリスト型', emoji: '🎯',
    description: `特定分野（特に「${top.axisName}」）で突出した強みを持つタイプです。専門性を活かしたキャリアで本領を発揮します。`,
    careers: ['専門職・技術職', 'リサーチャー', 'プロフェッショナルサービス', '専門コンサル'],
  };
  if (isBalanced) return {
    type: 'バランス型', emoji: '⚖️',
    description: '全体的にバランスよく評価されています。チームワークや協調を要する環境で力を発揮しやすいタイプです。',
    careers: ['チームリーダー', 'カスタマーサクセス', '人事・組織開発', '教育・育成担当'],
  };
  return {
    type: '成長途中型', emoji: '🌱',
    description: '伸びしろが大きいタイプです。正しい方向性で努力すれば、大きな成長が期待できます。',
    careers: ['総合職（育成枠）', 'インターン・研修職', '教育系NPO', '地域活動・社会貢献'],
  };
}

// ── Career suggestions ────────────────────────────────────────────────────────

function getCareerSuggestions(axes: AxisScore[]) {
  if (!axes.length) return [];
  const top2 = [...axes].sort((a, b) => b.percent - a.percent).slice(0, 2);
  return top2.map((a, i) => ({
    rank: i + 1,
    axisName: a.axisName,
    percent: a.percent,
    field: i === 0 ? '最も適性が高い進路' : '2番目に向いている進路',
    reason: `${a.axisName}のスコアが${a.percent}%と${a.percent >= 70 ? '高く' : 'あり'}、この領域を活かせるフィールドです。`,
    examples: a.percent >= 75
      ? ['即戦力として活躍できる分野', `${a.axisName}専門の職種`, 'リーダー・マネジメント職']
      : a.percent >= 55
      ? [`${a.axisName}関連の一般職`, 'チームメンバーとして活躍', 'OJTで成長できる職場']
      : [`${a.axisName}の基礎を積める環境`, '育成制度が充実した職場', 'チャレンジできる成長環境'],
  }));
}

// ── Growth tips ───────────────────────────────────────────────────────────────

function getGrowthTips(weakAxes: AxisScore[]) {
  return weakAxes.slice(0, 2).map((a) => ({
    axis: a.axisName,
    percent: a.percent,
    tip: a.percent < 40
      ? `${a.axisName}は現在${a.percent}%。基礎から学べる場に積極的に参加してみましょう。`
      : `${a.axisName}は${a.percent}%。あと少しの努力で大きく伸びる領域です。`,
    action: a.percent < 40
      ? '入門レベルのインプット（書籍・講座など）から始めてみよう'
      : '実践経験を積むことで一気にスコアアップできる可能性があります',
  }));
}

// ── Main client ───────────────────────────────────────────────────────────────

export function StudentClient() {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [d, setD] = useState('');
  const [notFound, setNotFound] = useState(false);

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
  const weakAxes    = sorted.slice(Math.ceil(sorted.length / 2));
  const careerType  = getCareerType(axes, payload.overallPercent);
  const suggestions = getCareerSuggestions(axes);
  const growthTips  = getGrowthTips(weakAxes);
  const matchScores = computeMatchScores(axes);
  const ranked      = COMPANIES.map((c) => ({ ...c, match: matchScores[c.id] ?? 50 }));
  const top         = ranked[0];
  const topColor    = colorMap[top.colorToken];
  const radarData   = axes.map((a) => ({ axis: a.axisName, score: a.percent, fullMark: 100 }));

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Row 1: Score card + Radar chart ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Score card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap size={14} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">あなたの評価結果</h2>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded border ${getRubricColor(payload.overallRubricLevel)}`}>
                Lv {payload.overallRubricLevel.toFixed(1)}
              </span>
            </div>

            <div className="flex items-center gap-5">
              {/* Circle */}
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke={payload.overallPercent >= 75 ? '#22c55e' : payload.overallPercent >= 55 ? '#3b82f6' : payload.overallPercent >= 40 ? '#eab308' : '#ef4444'}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - payload.overallPercent / 100)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{payload.overallPercent}%</span>
                  <span className="text-xs text-gray-400">総合</span>
                </div>
              </div>

              {/* Axis bars */}
              <div className="flex-1 space-y-2 min-w-0">
                {axes.map((a) => (
                  <div key={a.axisId} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20 shrink-0 truncate">{a.axisName}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getBarColor(a.percent)}`} style={{ width: `${a.percent}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-8 text-right shrink-0">{a.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Radar card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Award size={14} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">評価軸レーダー</h2>
            </div>
            {radarData.length >= 3 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 20, right: 50, bottom: 20, left: 50 }}>
                    <PolarGrid stroke="#f3f4f6" />
                    <PolarAngleAxis dataKey="axis" tick={<RadarLabel />} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#d1d5db' }} tickCount={5} />
                    <Radar dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2}
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'スコア']}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {axes.map((a) => (
                  <div key={a.axisId} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 shrink-0 truncate">{a.axisName}</span>
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

        {/* ── Row 2: Career type + Top company ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Career type */}
          {careerType && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-800">あなたのキャリアタイプ</h2>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shrink-0">
                  {careerType.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 mb-1">{careerType.type}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2">{careerType.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {careerType.careers.map((c) => (
                      <span key={c} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Featured top company */}
          <div className={`rounded-xl border-2 p-5 ${topColor.bg} ${topColor.border}`}>
            <div className="flex items-center gap-1.5 mb-3">
              <Star size={12} className={topColor.text} fill="currentColor" />
              <span className={`text-xs font-bold ${topColor.text}`}>最もマッチしている進路先</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{top.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-gray-900">{top.name}</h3>
                  <span className="text-xs text-gray-500">{top.industry}</span>
                </div>
                <p className="text-xs text-gray-600 mb-2 leading-relaxed">{top.description}</p>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-2.5 bg-white/70 rounded-full overflow-hidden border border-white">
                    <div className={`h-full rounded-full ${topColor.bar}`} style={{ width: `${top.match}%` }} />
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${topColor.text}`}>{top.match}%</span>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <ArrowRight size={10} className="shrink-0" />
                  {top.seeking}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 3: Company ranking + Career suggestions ──────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Company ranking */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={14} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">進路先マッチングランキング</h2>
            </div>
            <div className="space-y-3">
              {ranked.map((company, idx) => {
                const col = colorMap[company.colorToken];
                return (
                  <div key={company.id} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-lg shrink-0">{company.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-800 truncate mr-2">{company.name}</span>
                        <span className={`text-xs font-bold shrink-0 ${idx === 0 ? 'text-green-600' : 'text-gray-500'}`}>{company.match}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? col.bar : 'bg-gray-300'}`}
                          style={{ width: `${company.match}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Career suggestions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={14} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">向いている進路・分野</h2>
            </div>
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div key={s.axisName} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${s.rank === 1 ? 'bg-blue-600' : 'bg-gray-400'}`}>{s.rank}</span>
                    <span className="text-xs font-semibold text-gray-700">{s.field}</span>
                    <span className="text-xs text-blue-600 font-bold ml-auto">{s.percent}%</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-1.5 ml-7">{s.reason}</p>
                  <div className="flex flex-wrap gap-1 ml-7">
                    {s.examples.map((e) => (
                      <span key={e} className="text-xs text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{e}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 4: Strengths + Growth ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Strengths */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-green-600" />
              <h2 className="text-sm font-semibold text-gray-800">あなたの強み</h2>
            </div>
            <div className="space-y-3">
              {strengths.map((a, i) => (
                <div key={a.axisId} className="flex items-start gap-2.5">
                  <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">{a.axisName}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${getRubricColor(a.rubricLevel)}`}>Lv {a.rubricLevel.toFixed(1)}</span>
                      <span className="text-xs font-bold text-green-600 ml-auto">{a.percent}%</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {i === 0
                        ? `最大の武器です。${a.percent >= 70 ? 'さらなる発展も期待できます。' : 'この方向性を伸ばしましょう。'}`
                        : `${a.percent >= 60 ? '十分な水準に達しています。' : '着実に力をつけています。'}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Growth areas */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={14} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-800">伸ばしていきたいこと</h2>
            </div>
            {growthTips.length > 0 ? (
              <div className="space-y-3">
                {growthTips.map((tip) => (
                  <div key={tip.axis} className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-amber-700">{tip.axis}</span>
                      <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 ml-auto">{tip.percent}%</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed mb-1.5">{tip.tip}</p>
                    <div className="flex items-start gap-1.5">
                      <ArrowRight size={10} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 font-medium">{tip.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">全軸で高いスコアです！</p>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-blue-700 mb-1">🎓 進路は自分で切り開くもの</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            この結果はあくまでひとつの参考です。気になることは先生に相談してみましょう。<br />
            あなたの可能性は数字だけでは測れません。
          </p>
        </div>
      </main>
    </div>
  );
}
