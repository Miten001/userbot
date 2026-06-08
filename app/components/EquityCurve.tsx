"use client";

interface DataPoint {
  date: string;
  value: number;
}

interface EquityCurveProps {
  data: DataPoint[];
  height?: number;
  className?: string;
  title?: string;
}

export default function EquityCurve({
  data,
  height = 200,
  className = "",
  title,
}: EquityCurveProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const viewWidth = 500;
  const viewHeight = height;
  const padX = 50;
  const padTop = 20;
  const padBottom = 30;
  const chartWidth = viewWidth - padX * 2;
  const chartHeight = viewHeight - padTop - padBottom;

  // Map data to SVG coordinates
  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartWidth,
    y: padTop + (1 - (d.value - min) / range) * chartHeight,
  }));

  // Build smooth path using cubic bezier approximation
  function buildSmoothPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return "";
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i];
      const next = pts[i + 1];
      const prev = pts[i - 1] || current;
      const afterNext = pts[i + 2] || next;

      const cp1x = current.x + (next.x - prev.x) / 6;
      const cp1y = current.y + (next.y - prev.y) / 6;
      const cp2x = next.x - (afterNext.x - current.x) / 6;
      const cp2y = next.y - (afterNext.y - current.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
    }
    return path;
  }

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x},${padTop + chartHeight} L ${points[0].x},${padTop + chartHeight} Z`;

  const isUp = data[data.length - 1].value >= data[0].value;
  const gradId = `eq-fill-${Math.random().toString(36).slice(2, 8)}`;
  const lineGradId = `eq-line-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className={`rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-display text-lg font-bold text-white">{title}</h3>
        </div>
      )}
      <svg
        width="100%"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? "#fbbf24" : "#fb7185"} stopOpacity="0.25" />
            <stop offset="50%" stopColor={isUp ? "#34d399" : "#fb7185"} stopOpacity="0.1" />
            <stop offset="100%" stopColor={isUp ? "#34d399" : "#fb7185"} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor={isUp ? "#34d399" : "#fb7185"} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${lineGradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Y-axis labels */}
        <text x={padX - 8} y={padTop + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
          ${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
        <text x={padX - 8} y={padTop + chartHeight} textAnchor="end" className="fill-slate-500 text-[10px]">
          ${min.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>

        {/* X-axis labels */}
        <text x={padX} y={viewHeight - 6} textAnchor="start" className="fill-slate-500 text-[10px]">
          {data[0].date}
        </text>
        <text x={padX + chartWidth} y={viewHeight - 6} textAnchor="end" className="fill-slate-500 text-[10px]">
          {data[data.length - 1].date}
        </text>
      </svg>
    </div>
  );
}
