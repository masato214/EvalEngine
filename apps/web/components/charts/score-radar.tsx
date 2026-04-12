'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface ScoreRadarProps {
  data: Array<{ axis: string; score: number }>;
}

export function ScoreRadar({ data }: ScoreRadarProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
        />
        <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
