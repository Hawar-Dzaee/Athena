"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

interface Point {
  x: number;
  y: number;
}

const W = 460;
const H = 400;
const M = 44;
const DOMAIN: [number, number] = [-3.5, 3.5];
const BATCH_MIN = 2;
const BATCH_MAX = 16;

const COLORS = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#42d4f4",
  "#f032e6", "#fabed4", "#469990", "#dcbeff", "#9a6324",
  "#fffac8", "#800000", "#aaffc3", "#000075", "#a9a9a9", "#ffe119",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePoints(seed: number, spread: number, n: number): Point[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => ({
    x: (rng() - 0.5) * spread,
    y: (rng() - 0.5) * spread,
  }));
}

function computeHingeStats(points: Point[], stdMargin: number) {
  const n = points.length;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const meanX = d3.mean(xs)!;
  const meanY = d3.mean(ys)!;

  const varX = xs.reduce((s, v) => s + (v - meanX) ** 2, 0) / (n - 1);
  const varY = ys.reduce((s, v) => s + (v - meanY) ** 2, 0) / (n - 1);

  const stdX = Math.sqrt(varX + 0.0001);
  const stdY = Math.sqrt(varY + 0.0001);

  const hingeX = Math.max(0, stdMargin - stdX);
  const hingeY = Math.max(0, stdMargin - stdY);
  const loss = (hingeX + hingeY) / 2;

  return { meanX, meanY, stdX, stdY, hingeX, hingeY, loss };
}

const SAMPLE_SIZES = Array.from({ length: 63 }, (_, i) => i + 2);
const DIM_SIZES = Array.from({ length: 64 }, (_, i) => i + 1);
const N_TICKS = [2, 16, 32, 64];
const D_TICKS = [1, 16, 32, 64];
const HM_CELL = 8;
const HM_LM = 36;
const HM_TM = 26;
const HM_BM = 30;
const HM_RM = 6;
const HM_W = HM_LM + DIM_SIZES.length * HM_CELL + HM_RM;
const HM_H = HM_TM + SAMPLE_SIZES.length * HM_CELL + HM_BM;

function gaussianSample(rng: () => number): number {
  let u: number, v: number, s: number;
  do {
    u = rng() * 2 - 1;
    v = rng() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt((-2 * Math.log(s)) / s);
}

function computeHingeStdLossND(
  n: number,
  d: number,
  spread: number,
  margin: number,
  seed: number,
): number {
  const rng = mulberry32(seed);
  const k = n - 1;
  let totalHinge = 0;
  for (let j = 0; j < d; j++) {
    let chi2: number;
    if (k <= 6) {
      chi2 = 0;
      for (let i = 0; i < k; i++) {
        const z = gaussianSample(rng);
        chi2 += z * z;
      }
    } else {
      const z = gaussianSample(rng);
      const a = 1 - 2 / (9 * k);
      const b = Math.sqrt(2 / (9 * k));
      const cube = a + b * z;
      chi2 = k * Math.max(0, cube * cube * cube);
    }
    const std = Math.sqrt((chi2 * spread * spread) / k + 0.0001);
    totalHinge += Math.max(0, margin - std);
  }
  return totalHinge / d;
}

export function HingeStdLossDemo() {
  const [batchSize, setBatchSize] = useState(10);
  const [points, setPoints] = useState<Point[]>(() => makePoints(42, 4, 10));
  const [stdMargin, setStdMargin] = useState(1.0);
  const [showData, setShowData] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
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
    () => computeHingeStats(points, stdMargin),
    [points, stdMargin],
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
    (i: number) => (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragging(i);
    },
    [],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragging === null) return;
      const p = svgToData(e);
      if (!p) return;
      setPoints((prev) => prev.map((pt, i) => (i === dragging ? p : pt)));
    },
    [dragging, svgToData],
  );

  const onUp = useCallback(() => setDragging(null), []);

  const gridLines = [-3, -2, -1, 0, 1, 2, 3];
  const STD_BAR_MAX = 3;

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="HingeStdLoss interactive demo"
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
            aria-label="Draggable scatter plot for HingeStdLoss"
          >
            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={xScale(v)} y1={yScale(DOMAIN[0])}
                  x2={xScale(v)} y2={yScale(DOMAIN[1])}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.15}
                />
                <line
                  x1={xScale(DOMAIN[0])} y1={yScale(v)}
                  x2={xScale(DOMAIN[1])} y2={yScale(v)}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.15}
                />
              </g>
            ))}

            <line
              x1={xScale(stats.meanX)} y1={yScale(DOMAIN[0])}
              x2={xScale(stats.meanX)} y2={yScale(DOMAIN[1])}
              stroke="#f59e0b" strokeWidth={1}
              strokeDasharray="4 4" opacity={0.3}
            />
            <line
              x1={xScale(DOMAIN[0])} y1={yScale(stats.meanY)}
              x2={xScale(DOMAIN[1])} y2={yScale(stats.meanY)}
              stroke="#f59e0b" strokeWidth={1}
              strokeDasharray="4 4" opacity={0.3}
            />

            {points.map((p, i) => (
              <circle
                key={i}
                cx={xScale(p.x)}
                cy={yScale(p.y)}
                r={8}
                fill={COLORS[i % COLORS.length]}
                stroke="white"
                strokeWidth={1.5}
                opacity={0.9}
                cursor="grab"
                onPointerDown={onDown(i)}
                style={{ touchAction: "none" }}
              />
            ))}

            <text
              x={W - M + 5} y={yScale(0) + 4}
              fontSize="11" fill="var(--color-muted-foreground)"
            >
              dim 0
            </text>
            <text
              x={xScale(0) + 5} y={M - 10}
              fontSize="11" fill="var(--color-muted-foreground)"
            >
              dim 1
            </text>
          </svg>
        </div>

        {/* Stats panel */}
        <div className="flex w-full flex-col gap-4 lg:w-72">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Standard Deviation
            </h3>
            {[
              { label: "dim 0", std: stats.stdX, hinge: stats.hingeX },
              { label: "dim 1", std: stats.stdY, hinge: stats.hingeY },
            ].map(({ label, std, hinge }) => (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                  <span>{label}</span>
                  <span className="font-mono">{std.toFixed(3)}</span>
                </div>
                <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="absolute top-0 z-10 h-full w-0.5 bg-white/60"
                    style={{ left: `${(stdMargin / STD_BAR_MAX) * 100}%` }}
                  />
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min((std / STD_BAR_MAX) * 100, 100)}%`,
                      backgroundColor: hinge > 0.001 ? "#ef4444" : "#8b5cf6",
                    }}
                  />
                </div>
                {hinge > 0.001 && (
                  <div className="mt-0.5 text-right font-mono text-[10px] text-red-400">
                    penalty: {hinge.toFixed(3)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              HingeStdLoss
            </h3>
            <div
              className="font-mono text-2xl font-bold transition-colors duration-200"
              style={{ color: stats.loss > 0.01 ? "#ef4444" : "#10b981" }}
            >
              {stats.loss.toFixed(4)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
              mean(relu(γ − std))
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span className="font-semibold uppercase tracking-wider">
                  Margin (γ)
                </span>
                <span className="font-mono">{stdMargin.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0.1} max={2.5} step={0.1}
                value={stdMargin}
                onChange={(e) => setStdMargin(parseFloat(e.target.value))}
                className="w-full accent-violet-500"
                aria-label="Hinge margin"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span className="font-semibold uppercase tracking-wider">
                  Batch size (N)
                </span>
                <span className="font-mono">{batchSize}</span>
              </div>
              <input
                type="range" min={BATCH_MIN} max={BATCH_MAX} step={1}
                value={batchSize}
                onChange={(e) => {
                  const n = parseInt(e.target.value);
                  setBatchSize(n);
                  setPoints(makePoints(42, 4, n));
                }}
                className="w-full accent-violet-500"
                aria-label="Batch size"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPoints(makePoints(42, 4, batchSize))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Well-spread
            </button>
            <button
              onClick={() => setPoints(makePoints(99, 0.15, batchSize))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Collapsed
            </button>
            <button
              onClick={() => {
                const rng = mulberry32(77);
                setPoints(
                  Array.from({ length: batchSize }, () => ({
                    x: (rng() - 0.5) * 0.1,
                    y: (rng() - 0.5) * 4,
                  })),
                );
              }}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Collapse dim 0
            </button>
            <button
              onClick={() => {
                const rng = mulberry32(77);
                setPoints(
                  Array.from({ length: batchSize }, () => ({
                    x: (rng() - 0.5) * 4,
                    y: (rng() - 0.5) * 0.1,
                  })),
                );
              }}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Collapse dim 1
            </button>
          </div>

          <button
            onClick={() => setShowData((v) => !v)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
          >
            {showData ? "Hide" : "Show"} data ({batchSize}, 2)
          </button>

          {showData && (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
              <table className="w-full text-xs" role="table" aria-label="Batch data matrix">
                <thead>
                  <tr className="text-[var(--color-muted-foreground)]">
                    <th className="pb-1 pr-2 text-left font-semibold">#</th>
                    <th className="pb-1 pr-2 text-right font-semibold">dim 0</th>
                    <th className="pb-1 text-right font-semibold">dim 1</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={i}>
                      <td className="pr-2 py-0.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full mr-1"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-[var(--color-muted-foreground)]">{i}</span>
                      </td>
                      <td className="pr-2 py-0.5 text-right font-mono">{p.x.toFixed(3)}</td>
                      <td className="py-0.5 text-right font-mono">{p.y.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

export function HingeStdHeatmap() {
  const [margin, setMargin] = useState(1.0);
  const [spread, setSpread] = useState(1.0);
  const [seed, setSeed] = useState(42);

  const { grid, maxLoss } = useMemo(() => {
    const rows = SAMPLE_SIZES.length;
    const cols = DIM_SIZES.length;
    const flat = new Float32Array(rows * cols);
    let max = 0;
    for (let ri = 0; ri < rows; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        const s = seed * 997 + ri * 131 + ci * 17;
        const v = computeHingeStdLossND(SAMPLE_SIZES[ri], DIM_SIZES[ci], spread, margin, s);
        flat[ri * cols + ci] = v;
        if (v > max) max = v;
      }
    }
    return { grid: flat, maxLoss: Math.max(max, 0.01) };
  }, [margin, spread, seed]);

  const colorScale = useMemo(() => {
    const interp = d3.interpolateRgbBasis(["#10b981", "#eab308", "#ef4444"]);
    return (v: number) => interp(Math.min(v / maxLoss, 1));
  }, [maxLoss]);

  const legendStops = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      offset: `${(i / 6) * 100}%`,
      color: colorScale((i / 6) * maxLoss),
    })),
  [colorScale, maxLoss]);

  const gridW = DIM_SIZES.length * HM_CELL;
  const gridH = SAMPLE_SIZES.length * HM_CELL;

  const cells = useMemo(() => {
    const rects: React.ReactNode[] = [];
    const rows = SAMPLE_SIZES.length;
    const cols = DIM_SIZES.length;
    for (let ri = 0; ri < rows; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        rects.push(
          <rect
            key={ri * cols + ci}
            x={HM_LM + ci * HM_CELL}
            y={HM_TM + ri * HM_CELL}
            width={HM_CELL}
            height={HM_CELL}
            fill={colorScale(grid[ri * cols + ci])}
          />,
        );
      }
    }
    return rects;
  }, [grid, colorScale]);

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="HingeStdLoss heatmap across batch sizes and projection dimensions"
    >
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span className="font-semibold uppercase tracking-wider">Margin (γ)</span>
            <span className="ml-3 font-mono">{margin.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.1} max={2.5} step={0.1}
            value={margin}
            onChange={(e) => setMargin(parseFloat(e.target.value))}
            className="w-36 accent-violet-500"
            aria-label="Hinge margin"
          />
        </label>
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span className="font-semibold uppercase tracking-wider">Spread (σ)</span>
            <span className="ml-3 font-mono">{spread.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.1} max={3.0} step={0.1}
            value={spread}
            onChange={(e) => setSpread(parseFloat(e.target.value))}
            className="w-36 accent-violet-500"
            aria-label="Data spread"
          />
        </label>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
        >
          Re-roll
        </button>
      </div>

      <svg
        viewBox={`0 0 ${HM_W} ${HM_H}`}
        width={HM_W}
        height={HM_H}
        role="img"
        aria-label="Heatmap of HingeStdLoss values"
      >
        <defs>
          <linearGradient id="hinge-hm-grad" x1="0" x2="1" y1="0" y2="0">
            {legendStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>

        {/* Y-axis label */}
        <text
          x={8}
          y={HM_TM + gridH / 2}
          fontSize="9"
          fill="var(--color-muted-foreground)"
          textAnchor="middle"
          transform={`rotate(-90, 8, ${HM_TM + gridH / 2})`}
        >
          N (batch)
        </text>

        {/* X-axis label */}
        <text
          x={HM_LM + gridW / 2}
          y={10}
          fontSize="9"
          fill="var(--color-muted-foreground)"
          textAnchor="middle"
        >
          D (projection)
        </text>

        {/* Column tick labels */}
        {D_TICKS.map((d) => {
          const ci = d - 1;
          return (
            <text
              key={d}
              x={HM_LM + ci * HM_CELL + HM_CELL / 2}
              y={HM_TM - 4}
              fontSize="8"
              fill="var(--color-muted-foreground)"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {d}
            </text>
          );
        })}

        {/* Row tick labels */}
        {N_TICKS.map((n) => {
          const ri = n - 2;
          return (
            <text
              key={n}
              x={HM_LM - 4}
              y={HM_TM + ri * HM_CELL + HM_CELL / 2 + 3}
              fontSize="8"
              fill="var(--color-muted-foreground)"
              textAnchor="end"
              fontFamily="monospace"
            >
              {n}
            </text>
          );
        })}

        {cells}

        {/* Legend bar */}
        <rect
          x={HM_LM}
          y={HM_TM + gridH + 8}
          width={gridW}
          height={6}
          rx={3}
          fill="url(#hinge-hm-grad)"
        />
        <text
          x={HM_LM}
          y={HM_TM + gridH + 24}
          fontSize="8"
          fill="var(--color-muted-foreground)"
          fontFamily="monospace"
        >
          0
        </text>
        <text
          x={HM_LM + gridW}
          y={HM_TM + gridH + 24}
          fontSize="8"
          fill="var(--color-muted-foreground)"
          fontFamily="monospace"
          textAnchor="end"
        >
          {maxLoss.toFixed(2)}
        </text>
      </svg>
    </figure>
  );
}
