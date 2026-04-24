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
const W = 500;
const H = 460;
const M = 44;
const DOMAIN: [number, number] = [-3.5, 3.5];

const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
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

function hingeStdLoss(pts: Point[], margin: number): number {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const n = pts.length;
  const mx = d3.mean(xs)!;
  const my = d3.mean(ys)!;
  const vx = xs.reduce((s, v) => s + (v - mx) ** 2, 0) / (n - 1);
  const vy = ys.reduce((s, v) => s + (v - my) ** 2, 0) / (n - 1);
  const sx = Math.sqrt(vx + 0.0001);
  const sy = Math.sqrt(vy + 0.0001);
  return (Math.max(0, margin - sx) + Math.max(0, margin - sy)) / 2;
}

function covarianceLoss(pts: Point[]): number {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const n = pts.length;
  const mx = d3.mean(xs)!;
  const my = d3.mean(ys)!;
  const cov = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / (n - 1);
  return cov ** 2;
}

type Preset = "ideal" | "collapsed" | "correlated" | "apart";

function makePairs(preset: Preset): Pair[] {
  const rng = mulberry32(42);
  const pairs: Pair[] = [];

  for (let i = 0; i < N_PAIRS; i++) {
    const color = COLORS[i];

    if (preset === "ideal") {
      const angle = (i / N_PAIRS) * Math.PI * 2;
      const r = 1.5 + (i % 3) * 0.5;
      const bx = Math.cos(angle) * r;
      const by = Math.sin(angle) * r;
      const j = 0.08;
      pairs.push({
        z1: { x: bx + (rng() - 0.5) * j, y: by + (rng() - 0.5) * j },
        z2: { x: bx + (rng() - 0.5) * j, y: by + (rng() - 0.5) * j },
        color,
      });
    } else if (preset === "collapsed") {
      pairs.push({
        z1: { x: (rng() - 0.5) * 0.2, y: (rng() - 0.5) * 0.2 },
        z2: { x: (rng() - 0.5) * 0.2, y: (rng() - 0.5) * 0.2 },
        color,
      });
    } else if (preset === "correlated") {
      const t = ((i / N_PAIRS) * 2 - 1) * 2.5;
      const j = 0.06;
      pairs.push({
        z1: { x: t + (rng() - 0.5) * j, y: t * 0.95 + (rng() - 0.5) * j },
        z2: { x: t + (rng() - 0.5) * j, y: t * 0.95 + (rng() - 0.5) * j },
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

export function VICRegLossDemo() {
  const [pairs, setPairs] = useState<Pair[]>(() => makePairs("ideal"));
  const [stdCoeff, setStdCoeff] = useState(1.0);
  const [covCoeff, setCovCoeff] = useState(1.0);
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

  const stats = useMemo(() => {
    const z1s = pairs.map((p) => p.z1);
    const z2s = pairs.map((p) => p.z2);

    const invLoss =
      pairs.reduce(
        (s, p) => s + (p.z1.x - p.z2.x) ** 2 + (p.z1.y - p.z2.y) ** 2,
        0,
      ) /
      (N_PAIRS * 2);

    const varLoss = hingeStdLoss(z1s, 1.0) + hingeStdLoss(z2s, 1.0);
    const cLoss = covarianceLoss(z1s) + covarianceLoss(z2s);

    const total = invLoss + stdCoeff * varLoss + covCoeff * cLoss;

    return { invLoss, varLoss, covLoss: cLoss, total };
  }, [pairs, stdCoeff, covCoeff]);

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
  const LOSS_BAR_MAX = 4;

  const lossRows = [
    {
      label: "Invariance",
      value: stats.invLoss,
      weighted: stats.invLoss,
      color: "#10b981",
      coeff: "1.0",
    },
    {
      label: "Variance",
      value: stats.varLoss,
      weighted: stdCoeff * stats.varLoss,
      color: "#8b5cf6",
      coeff: stdCoeff.toFixed(1),
    },
    {
      label: "Covariance",
      value: stats.covLoss,
      weighted: covCoeff * stats.covLoss,
      color: "#f59e0b",
      coeff: covCoeff.toFixed(1),
    },
  ];

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="VICRegLoss interactive demo"
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
            aria-label="Two-view scatter plot for VICRegLoss"
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

            {/* Pair connections */}
            {pairs.map((p, i) => (
              <line
                key={`conn-${i}`}
                x1={xScale(p.z1.x)} y1={yScale(p.z1.y)}
                x2={xScale(p.z2.x)} y2={yScale(p.z2.y)}
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
                x={-6} y={-6} width={120} height={52} rx={8}
                fill="var(--color-background)" fillOpacity={0.85}
                stroke="var(--color-border)" strokeWidth={0.5}
              />
              <circle cx={8} cy={10} r={5} fill="#888" stroke="white" strokeWidth={1} />
              <text x={20} y={14} fontSize="11" fill="var(--color-muted-foreground)">
                View 1 (z1)
              </text>
              <polygon
                points="8,26 13,32 8,38 3,32"
                fill="#888" stroke="white" strokeWidth={1}
              />
              <text x={20} y={36} fontSize="11" fill="var(--color-muted-foreground)">
                View 2 (z2)
              </text>
            </g>

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
                    <span className="font-mono opacity-60">x{coeff}</span>
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

          {/* Coefficients */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Coefficients
            </h3>
            <label className="mb-3 flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>std_coeff</span>
                <span className="font-mono">{stdCoeff.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0} max={5} step={0.1}
                value={stdCoeff}
                onChange={(e) => setStdCoeff(parseFloat(e.target.value))}
                className="w-full accent-violet-500"
                aria-label="Variance coefficient"
              />
            </label>
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>cov_coeff</span>
                <span className="font-mono">{covCoeff.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0} max={5} step={0.1}
                value={covCoeff}
                onChange={(e) => setCovCoeff(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
                aria-label="Covariance coefficient"
              />
            </label>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Ideal", "ideal"],
                ["Collapsed", "collapsed"],
                ["Correlated", "correlated"],
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
