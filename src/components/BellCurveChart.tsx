"use client";

import { useRouter } from "next/navigation";
import type { ScoreBucket } from "@/lib/scoring";

type Props = {
  distribution: ScoreBucket[];
  compact?: boolean;
};

const ZONE_COLORS: Record<string, string> = {
  low:    "var(--bell-low)",
  medium: "var(--bell-medium)",
  high:   "var(--bell-high)",
};

const ZONE_HOVER: Record<string, string> = {
  low:    "var(--bell-low-hover)",
  medium: "var(--bell-medium-hover)",
  high:   "var(--bell-high-hover)",
};

export default function BellCurveChart({ distribution, compact }: Props) {
  const router = useRouter();

  const SVG_W = 480;
  const SVG_H = compact ? 110 : 160;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_TOP = 16;
  const PAD_BOT = 36;
  const chartW = SVG_W - PAD_L - PAD_R;
  const chartH = SVG_H - PAD_TOP - PAD_BOT;

  const maxCount = Math.max(...distribution.map((b) => b.count), 1);
  const barCount = distribution.length;
  const gap = 6;
  const barW = (chartW - gap * (barCount - 1)) / barCount;

  // Bar x positions
  const barX = (i: number) => PAD_L + i * (barW + gap);
  const barY = (count: number) => PAD_TOP + chartH - (count / maxCount) * chartH;
  const barH = (count: number) => (count / maxCount) * chartH;

  // Bezier curve through bar top-center points
  const points = distribution.map((b, i) => ({
    x: barX(i) + barW / 2,
    y: barY(b.count),
  }));

  function buildCurve(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const curvePath = buildCurve(points);

  const handleBarClick = (bucket: ScoreBucket) => {
    const [min, max] = bucket.range;
    router.push(`/leads?minScore=${min}&maxScore=${Math.min(max - 1, 100)}`);
  };

  const baselineY = PAD_TOP + chartH;

  return (
    <div className="bell-curve-wrap">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="bell-curve-svg"
        aria-label="Lead match score distribution"
      >
        {/* Bars */}
        {distribution.map((bucket, i) => (
          <g key={bucket.label} className="bell-bar-group" onClick={() => handleBarClick(bucket)}>
            <rect
              x={barX(i)}
              y={barY(bucket.count)}
              width={barW}
              height={Math.max(barH(bucket.count), bucket.count > 0 ? 2 : 0)}
              rx={3}
              fill={ZONE_COLORS[bucket.zone]}
              className="bell-bar"
              data-hover={ZONE_HOVER[bucket.zone]}
            />
            {/* Invisible wide hit target */}
            <rect
              x={barX(i) - gap / 2}
              y={PAD_TOP}
              width={barW + gap}
              height={chartH + 4}
              fill="transparent"
              className="bell-bar-hit"
            />
            {/* Count label above bar */}
            {bucket.count > 0 && (
              <text
                x={barX(i) + barW / 2}
                y={barY(bucket.count) - 4}
                textAnchor="middle"
                className="bell-count-label"
              >
                {bucket.count}
              </text>
            )}
            {/* Bucket label below */}
            <text
              x={barX(i) + barW / 2}
              y={baselineY + 14}
              textAnchor="middle"
              className="bell-axis-label"
            >
              {bucket.label}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={PAD_L}
          y1={baselineY}
          x2={SVG_W - PAD_R}
          y2={baselineY}
          className="bell-baseline"
        />

        {/* Curve overlay */}
        {curvePath && (
          <path
            d={curvePath}
            fill="none"
            className="bell-curve-line"
          />
        )}
      </svg>

      <div className="bell-legend">
        <span className="bell-legend-item bell-legend-low">Low match</span>
        <span className="bell-legend-item bell-legend-medium">Moderate</span>
        <span className="bell-legend-item bell-legend-high">Strong match</span>
        <span className="bell-legend-hint">Click a bar to filter leads</span>
      </div>
    </div>
  );
}
