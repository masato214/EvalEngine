'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { GraduationCap, BookOpen, Award, Printer, ChevronRight } from 'lucide-react';
import { decodePayload, flattenAxes, getRubricColor, getBarColor, ResultPayload } from './_shared';

// ── Shared header ──────────────────────────────────────────────────────────────

export function ResultHeader({ payload, d }: { payload: ResultPayload; d: string }) {
  const pathname = usePathname();
  const base = pathname.replace(/\/(student|teacher)$/, '');
  const dateStr = new Date(payload.timestamp).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });

  const tabs = [
    { href: `${base}?d=${encodeURIComponent(d)}`, label: '概要', exact: true },
    { href: `${base}/student?d=${encodeURIComponent(d)}`, label: '生徒用', icon: <GraduationCap size={13} /> },
    { href: `${base}/teacher?d=${encodeURIComponent(d)}`, label: '先生用', icon: <BookOpen size={13} /> },
  ];

  const isActive = (href: string, exact: boolean) => {
    const path = href.split('?')[0];
    return exact ? pathname === path : pathname.startsWith(path);
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-20 print:static">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">EvalEngine / テスト結果</p>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-gray-900 truncate">{payload.modelName}</h1>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{payload.respondentRef}</span>
              <span className="text-xs text-gray-400 shrink-0">{dateStr}</span>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors print:hidden shrink-0"
          >
            <Printer size={12} />
            印刷
          </button>
        </div>
        <div className="flex gap-1 print:hidden">
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.exact ?? false);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// ── Radar label ────────────────────────────────────────────────────────────────

function RadarLabel({ x, y, cx, cy, payload }: any) {
  const label = (payload.value as string).length > 10
    ? (payload.value as string).slice(0, 10) + '…'
    : payload.value;
  const dx = (x as number) - (cx as number);
  const dy = (y as number) - (cy as number);
  const ox = dx > 2 ? 12 : dx < -2 ? -12 : 0;
  const oy = dy > 2 ? 10 : dy < -2 ? -10 : 0;
  return (
    <text
      x={(x as number) + ox}
      y={(y as number) + oy}
      textAnchor={dx > 2 ? 'start' : dx < -2 ? 'end' : 'middle'}
      dominantBaseline="central"
      fontSize={11}
      fill="#6b7280"
    >
      {label}
    </text>
  );
}

// ── Overview page ──────────────────────────────────────────────────────────────

export function OverviewClient() {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [d, setD] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('d');
    if (!raw) { setNotFound(true); return; }
    try {
      setPayload(decodePayload(raw));
      setD(raw);
    } catch {
      setNotFound(true);
    }
  }, []);

  if (notFound) return <NotFoundScreen />;
  if (!payload) return <LoadingScreen />;

  const axes = flattenAxes(payload.axisScores);
  const radarData = axes.map((a) => ({ axis: a.axisName, score: a.percent, fullMark: 100 }));
  const pathname = window.location.pathname;

  return (
    <div className="min-h-screen bg-gray-50">
      <ResultHeader payload={payload} d={d} />

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Top stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">総合スコア</p>
            <p className="text-4xl font-bold text-gray-900">{payload.overallPercent}<span className="text-lg font-medium text-gray-400">%</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">ルーブリックレベル</p>
            <p className="text-4xl font-bold text-gray-900">
              {payload.overallRubricLevel.toFixed(1)}
              <span className="text-sm font-medium text-gray-400"> / 5.0</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">評価軸数</p>
            <p className="text-4xl font-bold text-gray-900">{axes.length}<span className="text-lg font-medium text-gray-400"> 軸</span></p>
          </div>
        </div>

        {/* Main: Radar (left) + Nav (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">

          {/* Radar card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award size={14} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">評価軸レーダー</h2>
            </div>

            {radarData.length >= 3 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
                    <PolarGrid stroke="#f3f4f6" />
                    <PolarAngleAxis dataKey="axis" tick={<RadarLabel />} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#d1d5db' }} tickCount={6} />
                    <Radar dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2}
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'スコア']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-3">
                {axes.map((a) => (
                  <div key={a.axisId} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-36 shrink-0 truncate">{a.axisName}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getBarColor(a.percent)}`} style={{ width: `${a.percent}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-9 text-right shrink-0">{a.percent}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Axis chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              {axes.map((a) => (
                <div key={a.axisId} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                  <span className="text-xs text-gray-700">{a.axisName}</span>
                  <span className="text-xs font-bold text-blue-600">{a.percent}%</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${getRubricColor(a.rubricLevel)}`}>
                    Lv{a.rubricLevel.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation cards stacked */}
          <div className="flex flex-col gap-4">
            <a
              href={`${pathname}/student?d=${encodeURIComponent(d)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition-all group flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <GraduationCap size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">生徒用ビュー</h3>
                  <p className="text-xs text-gray-500">進路マッチング結果</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                企業・進路とのマッチ度をわかりやすく表示。自分の強みと推薦進路を確認できます。
              </p>
            </a>

            <a
              href={`${pathname}/teacher?d=${encodeURIComponent(d)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition-all group flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                  <BookOpen size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">先生用ビュー</h3>
                  <p className="text-xs text-gray-500">指導・分析データ</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                評価軸の詳細スコア、強み・成長領域の分析、進路指導のアドバイスを確認できます。
              </p>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Shared utility screens ─────────────────────────────────────────────────────

export function NotFoundScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Award size={20} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700">結果データが見つかりません</p>
        <p className="text-xs text-gray-400 mt-1">テスト実行画面から「結果ページを開く」ボタンを使用してください</p>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-pulse text-xs text-gray-400">読み込み中...</div>
    </div>
  );
}
