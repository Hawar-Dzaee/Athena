"use client";

const quadrants = [
  { label: "II", dx: "−", dy: "+", sign: "−", positive: false },
  { label: "I", dx: "+", dy: "+", sign: "+", positive: true },
  { label: "III", dx: "−", dy: "−", sign: "+", positive: true },
  { label: "IV", dx: "+", dy: "−", sign: "−", positive: false },
];

export function QuadrantDiagram() {
  return (
    <div className="my-8 flex justify-center">
      <div className="relative">
        {/* Axis labels */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-medium text-amber-400/80">
          ȳ
        </div>
        <div className="absolute -right-7 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-400/80">
          x̄
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/60">
          {quadrants.map((q) => (
            <div
              key={q.label}
              className={`flex flex-col items-center justify-center gap-1.5 px-10 py-6 ${
                q.positive ? "bg-emerald-500/[0.08]" : "bg-rose-500/[0.08]"
              } ${q.label === "I" || q.label === "III" ? "" : "border-r-0"}`}
              style={{
                borderRight:
                  q.label === "II" || q.label === "III"
                    ? "1px dashed var(--color-amber-400, #fbbf24)"
                    : undefined,
                borderBottom:
                  q.label === "II" || q.label === "I"
                    ? "1px dashed var(--color-amber-400, #fbbf24)"
                    : undefined,
              }}
            >
              <span className="text-[11px] font-medium text-foreground/40">
                {q.label}
              </span>
              <span className="text-xs text-foreground/60">
                ({q.dx})({q.dy})
              </span>
              <span
                className={`text-lg font-bold ${
                  q.positive ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {q.sign}
              </span>
            </div>
          ))}
        </div>

        {/* Legend below */}
        <div className="mt-3 flex justify-center gap-5 text-xs text-foreground/40">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/40" />
            pushes Cov positive
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400/40" />
            pushes Cov negative
          </span>
        </div>
      </div>
    </div>
  );
}
