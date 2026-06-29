"use client";

import { useMemo, useState } from "react";

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

interface Prediction {
  confidence: number;
  label: 0 | 1;
}

function generatePredictions(quality: "good" | "medium" | "poor"): Prediction[] {
  const rng = makeRng(42);
  const skill = quality === "good" ? 0.85 : quality === "medium" ? 0.60 : 0.38;
  const preds: Prediction[] = [];
  for (let i = 0; i < 100; i++) {
    const conf = rng();
    const prob = skill * conf + (1 - skill) * 0.5;
    preds.push({ confidence: conf, label: rng() < prob ? 1 : 0 });
  }
  return preds.sort((a, b) => b.confidence - a.confidence);
}

interface CurvePoint {
  threshold: number;
  precision: number;
  recall: number;
}

function buildPRCurve(preds: Prediction[]): CurvePoint[] {
  const totalPos = preds.filter((p) => p.label === 1).length;
  if (totalPos === 0) return [];
  const pts: CurvePoint[] = [{ threshold: Infinity, precision: 1, recall: 0 }];
  let tp = 0,
    fp = 0;
  for (const p of preds) {
    if (p.label === 1) tp++;
    else fp++;
    pts.push({
      threshold: p.confidence,
      precision: tp / (tp + fp),
      recall: tp / totalPos,
    });
  }
  return pts;
}

function computeAP(curve: CurvePoint[]): number {
  const sorted = [...curve].sort((a, b) => a.recall - b.recall);
  let ap = 0;
  for (let i = 1; i < sorted.length; i++) {
    ap += (sorted[i].recall - sorted[i - 1].recall) * sorted[i].precision;
  }
  return ap;
}

const W = 520,
  H = 380;
const PAD = { top: 20, right: 20, bottom: 48, left: 52 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const sx = (r: number) => PAD.left + r * PW;
const sy = (p: number) => PAD.top + (1 - p) * PH;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

export function PRCurveViz() {
  const [quality, setQuality] = useState<"good" | "medium" | "poor">("good");
  const [threshold, setThreshold] = useState(0.5);

  const preds = useMemo(() => generatePredictions(quality), [quality]);
  const curve = useMemo(() => buildPRCurve(preds), [preds]);
  const ap = useMemo(() => computeAP(curve), [curve]);

  const stats = useMemo(() => {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const p of preds) {
      const pos = p.confidence >= threshold;
      if (pos && p.label === 1) tp++;
      else if (pos && p.label === 0) fp++;
      else if (!pos && p.label === 1) fn++;
    }
    return { tp, fp, fn };
  }, [preds, threshold]);

  const opPoint = useMemo(() => {
    const above = curve.filter((p) => p.threshold >= threshold);
    return above.length > 0 ? above[above.length - 1] : curve[curve.length - 1];
  }, [curve, threshold]);

  const sorted = useMemo(
    () => [...curve].sort((a, b) => a.recall - b.recall),
    [curve],
  );

  const curvePath = sorted
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.recall)},${sy(p.precision)}`)
    .join(" ");

  const lastRecall = sorted.length > 0 ? sorted[sorted.length - 1].recall : 0;
  const areaPath =
    sorted.length > 0
      ? `M${sx(0)},${sy(0)} L${sorted.map((p) => `${sx(p.recall)},${sy(p.precision)}`).join(" L")} L${sx(lastRecall)},${sy(0)} Z`
      : "";

  const prec = opPoint?.precision ?? 0;
  const rec = opPoint?.recall ?? 0;

  return (
    <div className="my-8 flex flex-col items-center gap-5">
      {/* Classifier presets */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-foreground/50">Classifier:</span>
        {(["good", "medium", "poor"] as const).map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuality(q);
              setThreshold(0.5);
            }}
            className={`rounded-md border px-3 py-1 capitalize transition-colors ${
              quality === q
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground/60 hover:bg-foreground/5"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Threshold slider */}
      <div className="flex w-full max-w-[520px] flex-col gap-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-foreground/50">Confidence threshold τ</span>
          <span className="font-mono text-accent">{threshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full accent-violet-400"
          aria-label="Confidence threshold"
        />
        <div className="flex justify-between text-[11px] text-foreground/30">
          <span>0 → predict everything positive</span>
          <span>predict everything negative → 1</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap justify-center gap-5 text-sm">
        {(
          [
            { label: "TP", value: stats.tp, color: "text-emerald-400" },
            { label: "FP", value: stats.fp, color: "text-rose-400" },
            { label: "FN", value: stats.fn, color: "text-amber-400" },
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
            {prec.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-foreground/50">Recall</span>
          <span className="text-xl font-semibold tabular-nums text-indigo-400">
            {rec.toFixed(3)}
          </span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-xs text-foreground/50">AP</span>
          <span className="text-xl font-semibold tabular-nums text-accent">
            {ap.toFixed(3)}
          </span>
        </div>
      </div>

      {/* PR Curve SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[520px] select-none"
        role="img"
        aria-label={`Precision-Recall curve. AP = ${ap.toFixed(3)}. Operating point: Recall=${rec.toFixed(3)}, Precision=${prec.toFixed(3)}`}
      >
        {/* Grid */}
        {TICKS.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={PAD.left + PW}
              y1={sy(v)}
              y2={sy(v)}
              className="stroke-foreground/[0.06]"
              strokeWidth={1}
            />
            <line
              x1={sx(v)}
              x2={sx(v)}
              y1={PAD.top}
              y2={PAD.top + PH}
              className="stroke-foreground/[0.06]"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* AP shaded area */}
        <path d={areaPath} className="fill-violet-500/15" />

        {/* Dashed guides to axes */}
        {opPoint && (
          <>
            <line
              x1={sx(rec)}
              x2={sx(rec)}
              y1={sy(prec)}
              y2={PAD.top + PH}
              className="stroke-indigo-400/40"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
            <line
              x1={PAD.left}
              x2={sx(rec)}
              y1={sy(prec)}
              y2={sy(prec)}
              className="stroke-violet-400/40"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          </>
        )}

        {/* PR curve */}
        <path
          d={curvePath}
          fill="none"
          className="stroke-accent"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* Operating point */}
        {opPoint && (
          <circle
            cx={sx(rec)}
            cy={sy(prec)}
            r={7}
            className="fill-background stroke-accent"
            strokeWidth={2.5}
          />
        )}

        {/* Axes */}
        <line
          x1={PAD.left}
          x2={PAD.left + PW}
          y1={PAD.top + PH}
          y2={PAD.top + PH}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={PAD.top + PH}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        {/* Tick marks + labels */}
        {TICKS.map((v) => (
          <g key={`t${v}`}>
            <line
              x1={sx(v)}
              x2={sx(v)}
              y1={PAD.top + PH}
              y2={PAD.top + PH + 5}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={sx(v)}
              y={PAD.top + PH + 20}
              textAnchor="middle"
              className="fill-foreground/60 text-[11px]"
            >
              {v.toFixed(1)}
            </text>
            <line
              x1={PAD.left - 5}
              x2={PAD.left}
              y1={sy(v)}
              y2={sy(v)}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={sy(v) + 4}
              textAnchor="end"
              className="fill-foreground/60 text-[11px]"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={PAD.left + PW / 2}
          y={H - 4}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
        >
          Recall
        </text>
        <text
          x={14}
          y={PAD.top + PH / 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
          transform={`rotate(-90,14,${PAD.top + PH / 2})`}
        >
          Precision
        </text>

        {/* AP label */}
        <text
          x={sx(0.5)}
          y={sy(0.28)}
          textAnchor="middle"
          className="fill-violet-400/40 text-sm font-medium"
        >
          AP = {ap.toFixed(3)}
        </text>
      </svg>

      {/* Prediction strip */}
      <div className="w-full max-w-[520px]">
        <p className="mb-2 text-center text-[11px] text-foreground/40">
          100 predictions sorted by confidence ← high to low →
          <span className="text-emerald-400"> TP</span>
          <span className="text-foreground/30">,</span>
          <span className="text-rose-400"> FP</span>
          <span className="text-foreground/30">,</span>
          <span className="text-amber-400"> FN</span>
          <span className="text-foreground/30">,</span>
          <span className="text-foreground/20"> TN</span>
        </p>
        <div
          className="flex flex-wrap gap-[3px]"
          role="img"
          aria-label="Prediction strip"
        >
          {preds.map((p, i) => {
            const predicted = p.confidence >= threshold;
            let cls: string;
            if (predicted && p.label === 1) cls = "bg-emerald-400";
            else if (predicted && p.label === 0) cls = "bg-rose-400";
            else if (!predicted && p.label === 1) cls = "bg-amber-400/50";
            else cls = "bg-foreground/10";
            return (
              <div
                key={i}
                className={`h-[11px] w-[11px] rounded-[2px] transition-colors duration-75 ${cls}`}
                title={`conf=${p.confidence.toFixed(2)} label=${p.label}`}
              />
            );
          })}
        </div>
      </div>

      <p className="text-center text-[11px] text-foreground/30">
        Drag the threshold slider to trace the curve — the dot moves with you
      </p>
    </div>
  );
}
