"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

interface Point {
  x: number;
  y: number;
}

const N = 10;
const W = 460;
const H = 400;
const M = 44;
const DOMAIN: [number, number] = [-3.5, 3.5];

const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
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

function makeCorrelated(seed: number): Point[] {
  const rng = mulberry32(seed);
  return Array.from({ length: N }, () => {
    const t = (rng() - 0.5) * 5;
    return { x: t + (rng() - 0.5) * 0.4, y: t + (rng() - 0.5) * 0.4 };
  });
}

function makeDecorrelated(seed: number): Point[] {
  const rng = mulberry32(seed);
  return Array.from({ length: N }, () => ({
    x: (rng() - 0.5) * 4,
    y: (rng() - 0.5) * 4,
  }));
}

function makeAntiCorrelated(seed: number): Point[] {
  const rng = mulberry32(seed);
  return Array.from({ length: N }, () => {
    const t = (rng() - 0.5) * 5;
    return { x: t + (rng() - 0.5) * 0.4, y: -t + (rng() - 0.5) * 0.4 };
  });
}

function computeCovStats(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const mx = d3.mean(xs)!;
  const my = d3.mean(ys)!;

  const varX = xs.reduce((s, v) => s + (v - mx) ** 2, 0) / (N - 1);
  const varY = ys.reduce((s, v) => s + (v - my) ** 2, 0) / (N - 1);
  const covXY = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / (N - 1);

  const offDiagSquaredMean = (covXY ** 2 + covXY ** 2) / 2;

  return { varX, varY, covXY, loss: offDiagSquaredMean };
}

export function CovarianceLossDemo() {
  const [points, setPoints] = useState<Point[]>(() => makeCorrelated(50));
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

  const stats = useMemo(() => computeCovStats(points), [points]);

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

  const covColor = (val: number) => {
    const intensity = Math.min(Math.abs(val) / 2, 1);
    return `rgba(239, 68, 68, ${intensity * 0.6 + 0.05})`;
  };

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="CovarianceLoss interactive demo"
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
            aria-label="Draggable scatter plot for CovarianceLoss"
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

            {points.map((p, i) => (
              <circle
                key={i}
                cx={xScale(p.x)}
                cy={yScale(p.y)}
                r={8}
                fill={COLORS[i]}
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
          {/* Covariance matrix */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Covariance Matrix
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "var(d0)", value: stats.varX, diag: true },
                { label: "cov(0,1)", value: stats.covXY, diag: false },
                { label: "cov(1,0)", value: stats.covXY, diag: false },
                { label: "var(d1)", value: stats.varY, diag: true },
              ].map(({ label, value, diag }, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center rounded-lg px-2 py-2.5 transition-colors duration-200"
                  style={{
                    backgroundColor: diag
                      ? "rgba(139, 92, 246, 0.12)"
                      : covColor(value),
                    border: diag
                      ? "1px solid rgba(139, 92, 246, 0.25)"
                      : `1px solid rgba(239, 68, 68, ${Math.min(Math.abs(value) / 2, 0.5) + 0.1})`,
                  }}
                >
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">
                    {label}
                  </span>
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{
                      color: diag ? "#a78bfa" : value === 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--color-muted-foreground)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: "rgba(139, 92, 246, 0.3)" }}
              />
              diagonal (kept)
              <span
                className="ml-2 inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: "rgba(239, 68, 68, 0.3)" }}
              />
              off-diagonal (penalized)
            </div>
          </div>

          {/* Loss */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              CovarianceLoss
            </h3>
            <div
              className="font-mono text-2xl font-bold transition-colors duration-200"
              style={{ color: stats.loss > 0.05 ? "#ef4444" : "#10b981" }}
            >
              {stats.loss.toFixed(4)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
              off_diagonal(cov).pow(2).mean()
            </p>
          </div>

          {/* Presets */}
          <div className="flex gap-2">
            <button
              onClick={() => setPoints(makeCorrelated(50))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Correlated
            </button>
            <button
              onClick={() => setPoints(makeDecorrelated(42))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Decorrelated
            </button>
            <button
              onClick={() => setPoints(makeAntiCorrelated(60))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Anti-corr
            </button>
          </div>
        </div>
      </div>
    </figure>
  );
}
