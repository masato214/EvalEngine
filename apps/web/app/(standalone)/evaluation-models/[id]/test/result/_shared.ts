export interface AxisScore {
  axisId: string;
  axisName: string;
  score: number;
  rubricLevel: number;
  percent: number;
  childScores?: AxisScore[];
}

export interface ResultPayload {
  modelName: string;
  overallScore: number;
  overallRubricLevel: number;
  overallPercent: number;
  axisScores: AxisScore[];
  respondentRef: string;
  timestamp: number;
}

export function decodePayload(d: string): ResultPayload {
  const bytes = Uint8Array.from(atob(d), (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

export function flattenAxes(axes: AxisScore[]): AxisScore[] {
  const result: AxisScore[] = [];
  for (const a of axes) {
    result.push(a);
    if (a.childScores?.length) result.push(...flattenAxes(a.childScores));
  }
  return result;
}

export function getRubricColor(level: number) {
  if (level >= 4.5) return 'text-green-700 bg-green-50 border-green-200';
  if (level >= 3.5) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (level >= 2.5) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (level >= 1.5) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

export function getBarColor(percent: number) {
  if (percent >= 80) return 'bg-green-500';
  if (percent >= 60) return 'bg-blue-500';
  if (percent >= 40) return 'bg-yellow-500';
  return 'bg-red-400';
}

// ── Mock companies ─────────────────────────────────────────────────────────────

export interface Company {
  id: string;      // 'A' | 'B' | 'C' | 'D'
  name: string;
  industry: string;
  emoji: string;
  description: string;
  seeking: string;
  // tailwind color token (without bg-/text- prefix)
  colorToken: string;
}

export const COMPANIES: Company[] = [
  {
    id: 'C',
    name: 'EduFuture C社',
    industry: '教育・社会貢献',
    emoji: '🌱',
    description: '教育系団体・NPO。コミュニケーション力と対人スキルを最重視。',
    seeking: '共感力・コミュニケーション能力が高い人材',
    colorToken: 'green',
  },
  {
    id: 'A',
    name: 'TechVenture A社',
    industry: 'IT・スタートアップ',
    emoji: '🚀',
    description: '急成長中のSaaSスタートアップ。高い専門スキルと挑戦意欲を積極採用。',
    seeking: '専門スキルと挑戦意欲を持つ人材',
    colorToken: 'blue',
  },
  {
    id: 'B',
    name: 'GlobalCorp B社',
    industry: '総合商社・大企業',
    emoji: '🏢',
    description: '国内大手総合商社。バランス型の人材を重視し、長期育成プログラムあり。',
    seeking: 'バランスのとれたポテンシャル人材',
    colorToken: 'indigo',
  },
  {
    id: 'D',
    name: 'CreativeHub D社',
    industry: 'クリエイティブ・広告',
    emoji: '🎨',
    description: 'デジタルクリエイティブ企業。創造性と問題解決力を評価。',
    seeking: '創造性と表現力に優れた人材',
    colorToken: 'amber',
  },
];

export function computeMatchScores(axes: AxisScore[]): Record<string, number> {
  if (!axes.length) return { C: 72, A: 61, B: 57, D: 54 };

  // Weight functions per company (axis index → weight)
  const weightFns: Record<string, (i: number, t: number) => number> = {
    C: (i, t) => i >= Math.floor(t / 2) ? 1.6 : 0.7,   // C社: always #1 — favors last axes
    A: (i, t) => i < Math.ceil(t / 2) ? 1.4 : 0.8,     // A社: first axes (specialist)
    B: () => 1.0,                                         // B社: balanced
    D: (i, t) => { const m = (t - 1) / 2; return 1.2 - Math.abs(i - m) / (t / 2) * 0.5; },
  };

  // Fixed biases to ensure C社 stays #1
  const biases: Record<string, number> = { C: +18, A: +3, B: 0, D: -2 };

  const scores: Record<string, number> = {};
  for (const [id, wFn] of Object.entries(weightFns)) {
    let sum = 0, total = 0;
    axes.forEach((a, i) => { const w = wFn(i, axes.length); sum += (a.percent / 100) * w; total += w; });
    scores[id] = Math.min(98, Math.max(15, Math.round((sum / total) * 100) + biases[id]));
  }
  return scores;
}
