"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { ScoreView } from "@/lib/analysis-view";

/**
 * Beş boyut, tek bakış. Skorlar ajanlardan gelir; ağırlıklı ortalama
 * sistemde hesaplanır (bkz. lib/scoring.ts).
 */
export function ScoreRadar({ scores }: { scores: ScoreView[] }) {
  if (!scores.length) return null;

  const data = scores.map((score) => ({
    dimension: score.dimension,
    value: score.value,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* Boyut adları uzun; kenar boşluğu ve küçük yarıçap olmadan kırpılıyorlar. */}
        <RadarChart
          data={data}
          outerRadius="68%"
          margin={{ top: 8, right: 56, bottom: 8, left: 56 }}
        >
          <PolarGrid stroke="#e5eaf4" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#35508c", fontSize: 10 }}
            tickLine={false}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke="#1e5eff"
            fill="#1e5eff"
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
