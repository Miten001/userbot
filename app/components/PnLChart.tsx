"use client";

interface DataPoint {
  date: string;
  value: number;
}

interface PnLChartProps {
  data: DataPoint[];
  height?: number;
  className?: string;
}

export default function PnLChart({
  data,
  height = 180,
  className = "",
}: PnLChartProps) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const viewWidth = 500;
  const viewHeight = height;
  const padX = 40;
  const padTop = 16;
  const padBottom = 28;
  const chartWidth = viewWidth - padX * 2;
  const chartHeight = viewHeight - padTop - padBottom;

  const barWidth = Math.max(4, (chartWidth / data.length) * 0.6);
  const gap = chartWidth / data.length;

  // Zero line Y position
  const zeroY = padTop + (maxVal / range) * chartHeight;

  return (
    <div className={`rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-lg font-bold text-white">Daily P/L</h3>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Zero line */}
        <line
          x1={padX}
          y1={zeroY}
          x2={padX + chartWidth}
          y2={zeroY}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="4 2"
        />

        {/* Bars */}
        {data.map((d, i) => {
          const isPositive = d.value >= 0;
          const barHeight = (Math.abs(d.value) / range) * chartHeight;
          const x = padX + i * gap + (gap - barWidth) / 2;
          const y = isPositive ? zeroY - barHeight : zeroY;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(1, barHeight)}
                rx={2}
                fill={isPositive ? "#34d399" : "#fb7185"}
                opacity={0.85}
              />
            </g>
          );
        })}

        {/* X-axis labels (first, middle, last) */}
        {data.length > 0 && (
          <>
            <text
              x={padX}
              y={viewHeight - 6}
              textAnchor="start"
              className="fill-slate-500 text-[9px]"
            >
              {abbreviateDate(data[0].date)}
            </text>
            {data.length > 2 && (
              <text
                x={padX + chartWidth / 2}
                y={viewHeight - 6}
                textAnchor="middle"
                className="fill-slate-500 text-[9px]"
              >
                {abbreviateDate(data[Math.floor(data.length / 2)].date)}
              </text>
            )}
            <text
              x={padX + chartWidth}
              y={viewHeight - 6}
              textAnchor="end"
              className="fill-slate-500 text-[9px]"
            >
              {abbreviateDate(data[data.length - 1].date)}
            </text>
          </>
        )}

        {/* Y-axis labels */}
        <text x={padX - 6} y={padTop + 4} textAnchor="end" className="fill-slate-500 text-[9px]">
          +${maxVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
        <text x={padX - 6} y={padTop + chartHeight} textAnchor="end" className="fill-slate-500 text-[9px]">
          -${Math.abs(minVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
      </svg>
    </div>
  );
}

function abbreviateDate(date: string) {
  const parts = date.split("-");
  if (parts.length === 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${months[monthIdx]} ${parseInt(parts[2], 10)}`;
  }
  return date;
}
