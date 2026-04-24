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

function makePoints(seed: number, spread: number): Point[] {
  const rng = mulberry32(seed);
  return Array.from({ length: N }, () => ({
    x: (rng() - 0.5) * spread,
    y: (rng() - 0.5) * spread,
  }));
}

function computeHingeStats(points: Point[], stdMargin: number) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const meanX = d3.mean(xs)!;
  const meanY = d3.mean(ys)!;

  const varX = xs.reduce((s, v) => s + (v - meanX) ** 2, 0) / (N - 1);
  const varY = ys.reduce((s, v) => s + (v - meanY) ** 2, 0) / (N - 1);

  const stdX = Math.sqrt(varX + 0.0001);
  const stdY = Math.sqrt(varY + 0.0001);

  const hingeX = Math.max(0, stdMargin - stdX);
  const hingeY = Math.max(0, stdMargin - stdY);
  const loss = (hingeX + hingeY) / 2;

  return { meanX, meanY, stdX, stdY, hingeX, hingeY, loss };
}

export function HingeStdLossDemo() {
  const [points, setPoints] = useState<Point[]>(() => makePoints(42, 4));
  const [stdMargin, setStdMargin] = useState(1.0);
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

          <div className="flex gap-2">
            <button
              onClick={() => setPoints(makePoints(42, 4))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Well-spread
            </button>
            <button
              onClick={() => setPoints(makePoints(99, 0.15))}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Collapsed
            </button>
            <button
              onClick={() => {
                const rng = mulberry32(77);
                setPoints(
                  Array.from({ length: N }, () => ({
                    x: (rng() - 0.5) * 0.1,
                    y: (rng() - 0.5) * 4,
                  })),
                );
              }}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              Dim 0 only
            </button>
          </div>
        </div>
      </div>
    </figure>
  );
}
