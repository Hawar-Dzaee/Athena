"use client";

import { useState, useRef, useCallback } from "react";

const PREDICTIONS: Array<{ confidence: number; actual: 0 | 1 }> = [
  { confidence: 0.97, actual: 1 },
  { confidence: 0.88, actual: 1 },
  { confidence: 0.73, actual: 0 },
  { confidence: 0.61, actual: 1 },
  { confidence: 0.50, actual: 0 },
  { confidence: 0.37, actual: 1 },
  { confidence: 0.25, actual: 0 },
  { confidence: 0.12, actual: 1 },
];

const TOTAL_POS = PREDICTIONS.filter((p) => p.actual === 1).length;

type Classification = "TP" | "FP" | "FN" | "TN";

// color by ground truth; brightness by correctness
const SYMBOL_COLOR: Record<Classification, string> = {
  TP: "#34d399",                   // emerald — correct positive
  FN: "rgba(52,211,153,0.22)",     // emerald dim — missed positive
  TN: "#fb7185",                   // rose — correct negative
  FP: "rgba(251,113,133,0.22)",    // rose dim — wrong on negative
};

const W = 560;
const H = 148;
const PAD_X = 24;
const TRACK_W = W - 2 * PAD_X;
const TRACK_Y = 82;
const TRACK_H = 28;
const ARM = 8; // half-length of each symbol arm
const HANDLE_Y = 30;

export function ConfidenceNumberLine() {
  const [threshold, setThreshold] = useState(0.5);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toX = (v: number) => PAD_X + v * TRACK_W;

  const updateFromClientX = useCallback((clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (clientX - rect.left) * (W / rect.width);
    setThreshold(Math.max(0, Math.min(1, (svgX - PAD_X) / TRACK_W)));
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    updateFromClientX(e.clientX);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) updateFromClientX(e.clientX);
  };
  const onMouseUp = () => { dragging.current = false; };

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    updateFromClientX(e.touches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragging.current) updateFromClientX(e.touches[0].clientX);
  };
  const onTouchEnd = () => { dragging.current = false; };

  const threshX = toX(threshold);

  const classified: Classification[] = PREDICTIONS.map((p) => {
    const predicted = p.confidence >= threshold;
    if (predicted && p.actual === 1) return "TP";
    if (predicted && p.actual === 0) return "FP";
    if (!predicted && p.actual === 1) return "FN";
    return "TN";
  });

  const tp = classified.filter((c) => c === "TP").length;
  const fp = classified.filter((c) => c === "FP").length;
  const fn = classified.filter((c) => c === "FN").length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp / TOTAL_POS;

  const negWidth = threshX - PAD_X;
  const posWidth = PAD_X + TRACK_W - threshX;
  const negMid = Math.max(PAD_X + 50, (PAD_X + threshX) / 2);
  const posMid = Math.min(W - PAD_X - 50, (threshX + PAD_X + TRACK_W) / 2);

  return (
    <div className="my-8 flex flex-col items-center gap-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[560px] select-none"
        style={{ cursor: "ew-resize" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="img"
        aria-label={`Confidence score number line. Threshold τ = ${threshold.toFixed(2)}`}
      >
        {/* Predicted-negative region */}
        <rect
          x={PAD_X}
          y={TRACK_Y - TRACK_H / 2}
          width={Math.max(0, negWidth)}
          height={TRACK_H}
          rx={5}
          fill="rgba(244,63,94,0.20)"
        />
        {/* Predicted-positive region */}
        <rect
          x={threshX}
          y={TRACK_Y - TRACK_H / 2}
          width={Math.max(0, posWidth)}
          height={TRACK_H}
          rx={5}
          fill="rgba(59,130,246,0.22)"
        />

        {/* Track baseline */}
        <line
          x1={PAD_X}
          y1={TRACK_Y}
          x2={PAD_X + TRACK_W}
          y2={TRACK_Y}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={1}
        />

        {/* Data-point symbols: + for ground truth positive, − for negative */}
        {PREDICTIONS.map((p, i) => {
          const cls = classified[i];
          const cx = toX(p.confidence);
          const color = SYMBOL_COLOR[cls];
          return (
            <g key={i}>
              <title>{`conf=${p.confidence} — ${cls} (actual ${p.actual === 1 ? "positive" : "negative"})`}</title>
              {/* horizontal bar (shared by + and −) */}
              <line
                x1={cx - ARM}
                y1={TRACK_Y}
                x2={cx + ARM}
                y2={TRACK_Y}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {/* vertical bar for + (actual positives only) */}
              {p.actual === 1 && (
                <line
                  x1={cx}
                  y1={TRACK_Y - ARM}
                  x2={cx}
                  y2={TRACK_Y + ARM}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              )}
            </g>
          );
        })}

        {/* Threshold divider line */}
        <line
          x1={threshX}
          y1={HANDLE_Y + 14}
          x2={threshX}
          y2={TRACK_Y + TRACK_H / 2 + 4}
          stroke="rgba(255,255,255,0.50)"
          strokeWidth={1.5}
        />

        {/* Threshold handle */}
        <circle
          cx={threshX}
          cy={HANDLE_Y}
          r={13}
          fill="#0f172a"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={2}
        />
        <text
          x={threshX}
          y={HANDLE_Y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.80)"
          fontSize={11}
          fontStyle="italic"
          fontFamily="serif"
        >
          τ
        </text>

        {/* Threshold value above handle */}
        <text
          x={threshX}
          y={HANDLE_Y - 18}
          textAnchor="middle"
          fill="rgba(255,255,255,0.55)"
          fontSize={11}
          fontFamily="monospace"
        >
          {threshold.toFixed(2)}
        </text>

        {/* Tick marks */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
          <g key={v}>
            <line
              x1={toX(v)}
              y1={TRACK_Y + TRACK_H / 2}
              x2={toX(v)}
              y2={TRACK_Y + TRACK_H / 2 + 6}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1}
            />
            <text
              x={toX(v)}
              y={TRACK_Y + TRACK_H / 2 + 19}
              textAnchor="middle"
              fill="rgba(255,255,255,0.32)"
              fontSize={11}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Region labels */}
        {negWidth > 60 && (
          <text
            x={negMid}
            y={TRACK_Y + TRACK_H / 2 + 37}
            textAnchor="middle"
            fill="rgba(251,113,133,0.65)"
            fontSize={11}
          >
            Predicted Negative
          </text>
        )}
        {posWidth > 60 && (
          <text
            x={posMid}
            y={TRACK_Y + TRACK_H / 2 + 37}
            textAnchor="middle"
            fill="rgba(96,165,250,0.65)"
            fontSize={11}
          >
            Predicted Positive
          </text>
        )}
      </svg>

      {/* Stats */}
      <div className="flex flex-wrap justify-center gap-5 text-sm">
        {(
          [
            { label: "TP", value: tp, color: "text-emerald-400" },
            { label: "FP", value: fp, color: "text-rose-400" },
            { label: "FN", value: fn, color: "text-amber-400" },
          ] as const
        ).map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center">
            <span className="text-xs text-foreground/50">{label}</span>
            <span className={`text-xl font-semibold tabular-nums ${color}`}>
              {value}
            </span>
          </div>
        ))}
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-xs text-foreground/50">Precision</span>
          <span className="text-xl font-semibold tabular-nums text-violet-400">
            {precision.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-foreground/50">Recall</span>
          <span className="text-xl font-semibold tabular-nums text-indigo-400">
            {recall.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-5 text-[11px] text-foreground/50">
        {(
          [
            { symbol: "+", color: "#34d399",                 label: "TP — correct positive" },
            { symbol: "+", color: "rgba(52,211,153,0.35)",   label: "FN — missed positive"  },
            { symbol: "−", color: "#fb7185",                 label: "TN — correct negative" },
            { symbol: "−", color: "rgba(251,113,133,0.35)",  label: "FP — wrong on negative"},
          ] as const
        ).map(({ symbol, color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              {/* horizontal bar */}
              <line x1="3" y1="8" x2="13" y2="8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              {/* vertical bar for + */}
              {symbol === "+" && (
                <line x1="8" y1="3" x2="8" y2="13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              )}
            </svg>
            {label}
          </span>
        ))}
      </div>

      <p className="text-center text-[11px] text-foreground/30">
        Click or drag to move the threshold τ
      </p>
    </div>
  );
}
