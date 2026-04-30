"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

interface Point {
  x: number;
  y: number;
}

interface Pair {
  z1: Point;
  z2: Point;
  color: string;
}

const N_PAIRS = 8;
const NUM_SLICES = 4;
const W = 500;
const H = 460;
const M = 44;
const DOMAIN: [number, number] = [-3.5, 3.5];
const T_MIN = -3;
const T_MAX = 3;
const N_FREQ = 40;
const EP_BAR_MAX = 0.5;
const LOSS_BAR_MAX = 4;

const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

const SLICE_COLORS = ["#ef4444", "#3b82f6", "#a855f7", "#14b8a6"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMuller(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

function getProjectionDirs(): [number, number][] {
  const rng = mulberry32(7);
  const dirs: [number, number][] = [];
  for (let i = 0; i < NUM_SLICES; i++) {
    const x = boxMuller(rng);
    const y = boxMuller(rng);
    const norm = Math.sqrt(x * x + y * y);
    dirs.push([x / norm, y / norm]);
  }
  return dirs;
}

const DIRS = getProjectionDirs();

function computeEPSingle(values: number[]): number {
  const n = values.length;
  const tStep = (T_MAX - T_MIN) / (N_FREQ - 1);

  let prev = 0;
  let integral = 0;
  for (let k = 0; k < N_FREQ; k++) {
    const t = T_MIN + k * tStep;
    const gaussCF = Math.exp(-0.5 * t * t);
    let cosSum = 0;
    let sinSum = 0;
    for (const xi of values) {
      cosSum += Math.cos(t * xi);
      sinSum += Math.sin(t * xi);
    }
    const ecfR = cosSum / n;
    const ecfI = sinSum / n;
    const dr = ecfR - gaussCF;
    const err = gaussCF * (dr * dr + ecfI * ecfI);
    if (k > 0) {
      integral += (prev + err) * 0.5 * tStep;
    }
    prev = err;
  }
  return integral;
}

type Preset = "gaussian" | "collapsed" | "clustered" | "apart";

function makePairs(preset: Preset): Pair[] {
  const rng = mulberry32(42);
  const pairs: Pair[] = [];

  for (let i = 0; i < N_PAIRS; i++) {
    const color = COLORS[i];
    if (preset === "gaussian") {
      const x = boxMuller(rng) * 1.2;
      const y = boxMuller(rng) * 1.2;
      const j = 0.08;
      pairs.push({
        z1: { x: x + (rng() - 0.5) * j, y: y + (rng() - 0.5) * j },
        z2: { x: x + (rng() - 0.5) * j, y: y + (rng() - 0.5) * j },
        color,
      });
    } else if (preset === "collapsed") {
      pairs.push({
        z1: { x: (rng() - 0.5) * 0.2, y: (rng() - 0.5) * 0.2 },
        z2: { x: (rng() - 0.5) * 0.2, y: (rng() - 0.5) * 0.2 },
        color,
      });
    } else if (preset === "clustered") {
      const cx = i < N_PAIRS / 2 ? -1.8 : 1.8;
      const cy = i < N_PAIRS / 2 ? -1.0 : 1.0;
      const j = 0.15;
      pairs.push({
        z1: { x: cx + (rng() - 0.5) * j, y: cy + (rng() - 0.5) * j },
        z2: { x: cx + (rng() - 0.5) * j, y: cy + (rng() - 0.5) * j },
        color,
      });
    } else {
      const angle = (i / N_PAIRS) * Math.PI * 2;
      const r = 2.0;
      const offset = Math.PI * 0.5;
      pairs.push({
        z1: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
        z2: {
          x: Math.cos(angle + offset) * r,
          y: Math.sin(angle + offset) * r,
        },
        color,
      });
    }
  }
  return pairs;
}

function computeStats(
  pairs: Pair[],
  dirs: [number, number][],
  lambda: number,
) {
  const z1s = pairs.map((p) => p.z1);
  const z2s = pairs.map((p) => p.z2);

  const perSlice: number[] = [];
  for (const [dx, dy] of dirs) {
    const proj1 = z1s.map((p) => p.x * dx + p.y * dy);
    const proj2 = z2s.map((p) => p.x * dx + p.y * dy);
    const ep1 = computeEPSingle(proj1);
    const ep2 = computeEPSingle(proj2);
    perSlice.push((ep1 + ep2) / 2);
  }
  const bcsLoss = perSlice.reduce((s, v) => s + v, 0) / perSlice.length;

  const invLoss =
    pairs.reduce(
      (s, p) => s + (p.z1.x - p.z2.x) ** 2 + (p.z1.y - p.z2.y) ** 2,
      0,
    ) /
    (N_PAIRS * 2);

  const total = invLoss + lambda * bcsLoss;

  return { bcsLoss, invLoss, total, perSlice };
}

export function BCSDemo() {
  const [pairs, setPairs] = useState<Pair[]>(() => makePairs("gaussian"));
  const [lambda, setLambda] = useState(10.0);
  const [dragging, setDragging] = useState<{
    view: "z1" | "z2";
    idx: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const xScale = useMemo(
    () => d3.scaleLinear().domain(DOMAIN).range([M, W - M]),
    [],
  );
  const yScale = useMemo(
    () => d3.scaleLinear().domain(DOMAIN).range([H - M, M]),
    [],
  );

  const stats = useMemo(
    () => computeStats(pairs, DIRS, lambda),
    [pairs, lambda],
  );

  const svgToData = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return {
        x: Math.max(DOMAIN[0], Math.min(DOMAIN[1], xScale.invert(svgPt.x))),
        y: Math.max(DOMAIN[0], Math.min(DOMAIN[1], yScale.invert(svgPt.y))),
      };
    },
    [xScale, yScale],
  );

  const onDown = useCallback(
    (view: "z1" | "z2", idx: number) => (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragging({ view, idx });
    },
    [],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return;
      const p = svgToData(e);
      if (!p) return;
      setPairs((prev) =>
        prev.map((pair, i) => {
          if (i !== dragging.idx) return pair;
          return { ...pair, [dragging.view]: p };
        }),
      );
    },
    [dragging, svgToData],
  );

  const onUp = useCallback(() => setDragging(null), []);

  const gridLines = [-3, -2, -1, 0, 1, 2, 3];

  const lossRows = [
    {
      label: "Invariance",
      value: stats.invLoss,
      weighted: stats.invLoss,
      color: "#10b981",
      coeff: "1.0",
    },
    {
      label: "BCS",
      value: stats.bcsLoss,
      weighted: lambda * stats.bcsLoss,
      color: "#6366f1",
      coeff: lambda.toFixed(1),
    },
  ];

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="BCS loss interactive demo"
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Scatter */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            role="img"
            aria-label="Two-view scatter plot with projection slices for BCS"
          >
            <defs>
              <clipPath id="bcs-scatter-clip">
                <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} />
              </clipPath>
            </defs>

            {/* Grid */}
            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={xScale(v)}
                  y1={yScale(DOMAIN[0])}
                  x2={xScale(v)}
                  y2={yScale(DOMAIN[1])}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.15}
                />
                <line
                  x1={xScale(DOMAIN[0])}
                  y1={yScale(v)}
                  x2={xScale(DOMAIN[1])}
                  y2={yScale(v)}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.15}
                />
              </g>
            ))}

            {/* Projection lines */}
            <g clipPath="url(#bcs-scatter-clip)">
              {DIRS.map(([dx, dy], i) => (
                <line
                  key={`dir-${i}`}
                  x1={xScale(-5 * dx)}
                  y1={yScale(-5 * dy)}
                  x2={xScale(5 * dx)}
                  y2={yScale(5 * dy)}
                  stroke={SLICE_COLORS[i]}
                  strokeWidth={1.5}
                  opacity={0.25}
                  strokeDasharray="6 4"
                />
              ))}
            </g>

            {/* Pair connections */}
            {pairs.map((p, i) => (
              <line
                key={`conn-${i}`}
                x1={xScale(p.z1.x)}
                y1={yScale(p.z1.y)}
                x2={xScale(p.z2.x)}
                y2={yScale(p.z2.y)}
                stroke={p.color}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.35}
              />
            ))}

            {/* z1 circles */}
            {pairs.map((p, i) => (
              <circle
                key={`z1-${i}`}
                cx={xScale(p.z1.x)}
                cy={yScale(p.z1.y)}
                r={7}
                fill={p.color}
                stroke="white"
                strokeWidth={1.5}
                opacity={0.9}
                cursor="grab"
                onPointerDown={onDown("z1", i)}
                style={{ touchAction: "none" }}
              />
            ))}

            {/* z2 diamonds */}
            {pairs.map((p, i) => {
              const cx = xScale(p.z2.x);
              const cy = yScale(p.z2.y);
              const s = 6;
              return (
                <polygon
                  key={`z2-${i}`}
                  points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
                  fill={p.color}
                  stroke="white"
                  strokeWidth={1.5}
                  opacity={0.9}
                  cursor="grab"
                  onPointerDown={onDown("z2", i)}
                  style={{ touchAction: "none" }}
                />
              );
            })}

            {/* Legend */}
            <g transform={`translate(${M + 8}, ${M + 8})`}>
              <rect
                x={-6}
                y={-6}
                width={120}
                height={52}
                rx={8}
                fill="var(--color-background)"
                fillOpacity={0.85}
                stroke="var(--color-border)"
                strokeWidth={0.5}
              />
              <circle
                cx={8}
                cy={10}
                r={5}
                fill="#888"
                stroke="white"
                strokeWidth={1}
              />
              <text
                x={20}
                y={14}
                fontSize="11"
                fill="var(--color-muted-foreground)"
              >
                View 1 (z1)
              </text>
              <polygon
                points="8,26 13,32 8,38 3,32"
                fill="#888"
                stroke="white"
                strokeWidth={1}
              />
              <text
                x={20}
                y={36}
                fontSize="11"
                fill="var(--color-muted-foreground)"
              >
                View 2 (z2)
              </text>
            </g>

            <text
              x={W - M + 5}
              y={yScale(0) + 4}
              fontSize="11"
              fill="var(--color-muted-foreground)"
            >
              dim 0
            </text>
            <text
              x={xScale(0) + 5}
              y={M - 10}
              fontSize="11"
              fill="var(--color-muted-foreground)"
            >
              dim 1
            </text>
          </svg>
        </div>

        {/* Stats panel */}
        <div className="flex w-full flex-col gap-4 lg:w-72">
          {/* Per-slice EP */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Per-Slice Gaussianity
            </h3>
            {stats.perSlice.map((ep, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                  <span style={{ color: SLICE_COLORS[i] }}>
                    Slice {i + 1}
                  </span>
                  <span className="font-mono">{ep.toFixed(4)}</span>
                </div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min((ep / EP_BAR_MAX) * 100, 100)}%`,
                      backgroundColor: SLICE_COLORS[i],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Loss breakdown */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Loss Breakdown
            </h3>
            {lossRows.map(({ label, value, weighted, color, coeff }) => (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                  <span>
                    {label}{" "}
                    <span className="font-mono opacity-60">
                      {"×"}
                      {coeff}
                    </span>
                  </span>
                  <span className="font-mono">{weighted.toFixed(4)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min((value / LOSS_BAR_MAX) * 100, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="mt-0.5 text-right font-mono text-[10px] text-[var(--color-muted-foreground)]">
                  raw: {value.toFixed(4)}
                </div>
              </div>
            ))}

            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                Total Loss
              </span>
              <span
                className="font-mono text-lg font-bold transition-colors duration-200"
                style={{
                  color: stats.total > 1 ? "#ef4444" : "#10b981",
                }}
              >
                {stats.total.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Lambda slider */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>{"λ (lmbd)"}</span>
                <span className="font-mono">{lambda.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={lambda}
                onChange={(e) => setLambda(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
                aria-label="BCS coefficient lambda"
              />
            </label>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Gaussian", "gaussian"],
                ["Collapsed", "collapsed"],
                ["Clustered", "clustered"],
                ["Views apart", "apart"],
              ] as const
            ).map(([label, key]) => (
              <button
                key={key}
                onClick={() => setPairs(makePairs(key))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
