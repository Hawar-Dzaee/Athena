"use client";

import { useMemo } from "react";

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

interface CurvePoint {
  recall: number;
  precision: number;
}

function generatePredictions(skill: number, seed: number): Prediction[] {
  const rng = makeRng(seed);
  const preds: Prediction[] = [];
  for (let i = 0; i < 80; i++) {
    const conf = rng();
    const prob = skill * conf + (1 - skill) * 0.5;
    preds.push({ confidence: conf, label: rng() < prob ? 1 : 0 });
  }
  return preds.sort((a, b) => b.confidence - a.confidence);
}

function buildCurve(preds: Prediction[]): CurvePoint[] {
  const totalPos = preds.filter((p) => p.label === 1).length;
  if (totalPos === 0) return [];
  const pts: CurvePoint[] = [{ recall: 0, precision: 1 }];
  let tp = 0,
    fp = 0;
  for (const p of preds) {
    if (p.label === 1) tp++;
    else fp++;
    pts.push({ recall: tp / totalPos, precision: tp / (tp + fp) });
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

const CLASSES = [
  { name: "person", skill: 0.88, seed: 11, color: "#818cf8" },
  { name: "car", skill: 0.76, seed: 23, color: "#34d399" },
  { name: "dog", skill: 0.62, seed: 37, color: "#f59e0b" },
  { name: "cat", skill: 0.51, seed: 41, color: "#f472b6" },
  { name: "bird", skill: 0.38, seed: 53, color: "#60a5fa" },
];

const W = 520,
  H = 360;
const PAD = { top: 20, right: 20, bottom: 48, left: 52 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const sx = (r: number) => PAD.left + r * PW;
const sy = (p: number) => PAD.top + (1 - p) * PH;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

export function MAPExplorer() {
  const classData = useMemo(
    () =>
      CLASSES.map((cls) => {
        const preds = generatePredictions(cls.skill, cls.seed);
        const curve = buildCurve(preds);
        const ap = computeAP(curve);
        const sorted = [...curve].sort((a, b) => a.recall - b.recall);
        return { ...cls, ap, sorted };
      }),
    [],
  );

  const mAP = classData.reduce((s, d) => s + d.ap, 0) / classData.length;

  return (
    <div className="my-8 flex flex-col items-center gap-6">
      {/* All PR curves overlaid */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[520px] select-none"
        role="img"
        aria-label={`Multi-class PR curves. mAP = ${(mAP * 100).toFixed(1)}%`}
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

        {/* One PR curve per class */}
        {classData.map(({ name, color, sorted }) => {
          const path = sorted
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${sx(p.recall)},${sy(p.precision)}`,
            )
            .join(" ");
          return (
            <path
              key={name}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              opacity={0.85}
            />
          );
        })}

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
      </svg>

      {/* Legend: AP per class + mAP */}
      <div className="flex w-full max-w-[520px] flex-col gap-2">
        {classData.map(({ name, color, ap }) => (
          <div key={name} className="flex items-center gap-3">
            <div
              className="h-0.5 w-8 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="w-14 text-sm capitalize text-foreground/70">
              {name}
            </span>
            <div
              className="flex-1 overflow-hidden rounded-full bg-foreground/10"
              style={{ height: "6px" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${ap * 100}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="w-12 text-right font-mono text-sm tabular-nums"
              style={{ color }}
            >
              {(ap * 100).toFixed(1)}%
            </span>
          </div>
        ))}

        {/* mAP row */}
        <div className="mt-1 flex items-center gap-3 border-t border-border pt-2">
          <div className="h-0.5 w-8 shrink-0 rounded-full bg-foreground/50" />
          <span className="w-14 text-sm font-semibold text-foreground/80">
            mAP
          </span>
          <div
            className="flex-1 overflow-hidden rounded-full bg-foreground/10"
            style={{ height: "6px" }}
          >
            <div
              className="h-full rounded-full bg-foreground/50 transition-all"
              style={{ width: `${mAP * 100}%` }}
            />
          </div>
          <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums text-foreground/80">
            {(mAP * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* mAP formula breakdown */}
      <p className="text-center text-[11px] text-foreground/30">
        mAP = (
        {classData.map((d, i) => (
          <span key={d.name}>
            <span style={{ color: d.color }}>{(d.ap * 100).toFixed(1)}%</span>
            {i < classData.length - 1 && (
              <span className="text-foreground/20"> + </span>
            )}
          </span>
        ))}
        ) ÷ {classData.length} ={" "}
        <span className="text-foreground/50">{(mAP * 100).toFixed(1)}%</span>
      </p>
    </div>
  );
}
