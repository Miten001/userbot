"use client";

export function SkeletonCard({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] ${height}`}>
      <div className="absolute inset-0 animate-pulse bg-white/[0.02]" />
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      {/* Header row */}
      <div className="mb-4 flex gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-3 flex-1 rounded-full bg-white/[0.06]" />
        ))}
      </div>
      {/* Data rows */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="mb-3 flex items-center gap-4">
          {[1, 2, 3, 4, 5].map((j) => (
            <div
              key={j}
              className="h-3 flex-1 rounded-full bg-white/[0.04]"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      ))}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="relative h-20 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          <div className="absolute inset-0 animate-pulse bg-white/[0.02]" />
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      ))}
    </div>
  );
}
