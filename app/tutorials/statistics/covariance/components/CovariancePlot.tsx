"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 500;
const PAD = { top: 24, right: 24, bottom: 44, left: 52 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const X_MIN = -5;
const X_MAX = 5;
const Y_MIN = -5;
const Y_MAX = 5;

interface Point {
  x: number;
  y: number;
}

function toSvgX(x: number) {
  return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}
function toSvgY(y: number) {
  return PAD.top + PLOT_H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}
function toDataX(sx: number) {
  return X_MIN + ((sx - PAD.left) / PLOT_W) * (X_MAX - X_MIN);
}
function toDataY(sy: number) {
  return Y_MIN + ((PAD.top + PLOT_H - sy) / PLOT_H) * (Y_MAX - Y_MIN);
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function mean(vals: number[]) {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function sampleCov(pts: Point[]) {
  if (pts.length < 2) return 0;
  const mx = mean(pts.map((p) => p.x));
  const my = mean(pts.map((p) => p.y));
  return (
    pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / (pts.length - 1)
  );
}

function pointContributions(pts: Point[]) {
  if (pts.length < 2) return pts.map(() => 0);
  const mx = mean(pts.map((p) => p.x));
  const my = mean(pts.map((p) => p.y));
  return pts.map((p) => (p.x - mx) * (p.y - my));
}

const PRESETS: Record<string, Point[]> = {
  positive: [
    { x: -3.2, y: -2.8 },
    { x: -2.0, y: -1.3 },
    { x: -0.8, y: -0.2 },
    { x: 0.3, y: 0.8 },
    { x: 1.5, y: 1.7 },
    { x: 2.4, y: 2.6 },
    { x: 3.5, y: 3.1 },
    { x: -1.2, y: -1.8 },
  ],
  negative: [
    { x: -3.0, y: 3.2 },
    { x: -2.0, y: 2.0 },
    { x: -0.8, y: 0.5 },
    { x: 0.5, y: -0.3 },
    { x: 1.2, y: -1.5 },
    { x: 2.5, y: -2.8 },
    { x: 3.2, y: -3.5 },
    { x: 1.8, y: -1.8 },
  ],
  zero: [
    { x: -2, y: 2 },
    { x: 2, y: 2 },
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: 0, y: 3.5 },
    { x: 0, y: -3.5 },
    { x: 3.5, y: 0 },
    { x: -3.5, y: 0 },
  ],
};

function randomPreset(): Point[] {
  const n = 8 + Math.floor(Math.random() * 5);
  return Array.from({ length: n }, () => ({
    x: (Math.random() - 0.5) * 8,
    y: (Math.random() - 0.5) * 8,
  }));
}

export function CovariancePlot() {
  const [points, setPoints] = useState<Point[]>(PRESETS.positive);
  const [showRects, setShowRects] = useState(true);
  const [showQuadrants, setShowQuadrants] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const mx = useMemo(
    () => (points.length > 0 ? mean(points.map((p) => p.x)) : 0),
    [points],
  );
  const my = useMemo(
    () => (points.length > 0 ? mean(points.map((p) => p.y)) : 0),
    [points],
  );
  const cov = useMemo(() => sampleCov(points), [points]);
  const contribs = useMemo(() => pointContributions(points), [points]);

  const svgCoords = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    return {
      x: clamp(toDataX(svgX), X_MIN + 0.05, X_MAX - 0.05),
      y: clamp(toDataY(svgY), Y_MIN + 0.05, Y_MAX - 0.05),
    };
  }, []);

  const onCirclePointerDown = useCallback(
    (idx: number) => (e: React.PointerEvent) => {
      e.stopPropagation();
      setDragIdx(idx);
    },
    [],
  );

  const onSvgPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragIdx === null) return;
      const { x, y } = svgCoords(e);
      setPoints((prev) => prev.map((p, i) => (i === dragIdx ? { x, y } : p)));
    },
    [dragIdx, svgCoords],
  );

  const onSvgPointerUp = useCallback(() => {
    setDragIdx(null);
  }, []);

  const onBgPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (dragIdx !== null) return;
      const { x, y } = svgCoords(e);
      const sx = toSvgX(x);
      const sy = toSvgY(y);
      if (
        sx < PAD.left ||
        sx > PAD.left + PLOT_W ||
        sy < PAD.top ||
        sy > PAD.top + PLOT_H
      )
        return;
      setPoints((prev) => [...prev, { x, y }]);
    },
    [dragIdx, svgCoords],
  );

  const onCircleDoubleClick = useCallback(
    (idx: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (points.length <= 2) return;
      setPoints((prev) => prev.filter((_, i) => i !== idx));
    },
    [points.length],
  );

  const xTicks = useMemo(() => {
    const t: number[] = [];
    for (let x = X_MIN; x <= X_MAX; x += 1) t.push(x);
    return t;
  }, []);
  const yTicks = useMemo(() => {
    const t: number[] = [];
    for (let y = Y_MIN; y <= Y_MAX; y += 1) t.push(y);
    return t;
  }, []);

  const covColor =
    cov > 0.1
      ? "text-emerald-400"
      : cov < -0.1
        ? "text-rose-400"
        : "text-foreground/60";
  const covLabel =
    cov > 0.1 ? "Positive" : cov < -0.1 ? "Negative" : "Near zero";

  const maxAbsContrib = Math.max(...contribs.map(Math.abs), 0.01);
  const sortedContribs = contribs
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c - a.c);

  return (
    <div className="my-8 flex flex-col items-center gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="mr-1 text-sm text-foreground/50">Presets:</span>
        {(["positive", "negative", "zero"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setPoints(PRESETS[key])}
            className="rounded-md border border-border px-3 py-1 text-sm capitalize text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            {key}
          </button>
        ))}
        <button
          onClick={() => setPoints(randomPreset())}
          className="rounded-md border border-border px-3 py-1 text-sm text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          Random
        </button>
        <span className="mx-2 h-4 w-px bg-border" />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground/60">
          <input
            type="checkbox"
            checked={showRects}
            onChange={() => setShowRects(!showRects)}
            className="accent-violet-400"
          />
          Rectangles
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground/60">
          <input
            type="checkbox"
            checked={showQuadrants}
            onChange={() => setShowQuadrants(!showQuadrants)}
            className="accent-violet-400"
          />
          Quadrants
        </label>
      </div>

      {/* SVG scatter plot */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[600px] cursor-crosshair select-none overflow-visible touch-none"
        onPointerDown={onBgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerLeave={onSvgPointerUp}
        role="img"
        aria-label={`Covariance scatter plot. Cov(X,Y) = ${cov.toFixed(2)}, n = ${points.length}`}
      >
        {/* Grid lines */}
        {xTicks.map((x) => (
          <line
            key={`gx${x}`}
            x1={toSvgX(x)}
            x2={toSvgX(x)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            className="stroke-foreground/[0.06]"
            strokeWidth={1}
          />
        ))}
        {yTicks.map((y) => (
          <line
            key={`gy${y}`}
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={toSvgY(y)}
            y2={toSvgY(y)}
            className="stroke-foreground/[0.06]"
            strokeWidth={1}
          />
        ))}

        {/* Quadrant shading */}
        {showQuadrants && points.length >= 2 && (
          <>
            {/* Positive quadrants: top-right & bottom-left */}
            <rect
              x={toSvgX(mx)}
              y={PAD.top}
              width={toSvgX(X_MAX) - toSvgX(mx)}
              height={toSvgY(my) - PAD.top}
              className="fill-emerald-500/[0.06]"
            />
            <rect
              x={PAD.left}
              y={toSvgY(my)}
              width={toSvgX(mx) - PAD.left}
              height={PAD.top + PLOT_H - toSvgY(my)}
              className="fill-emerald-500/[0.06]"
            />
            {/* Negative quadrants: top-left & bottom-right */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={toSvgX(mx) - PAD.left}
              height={toSvgY(my) - PAD.top}
              className="fill-rose-500/[0.06]"
            />
            <rect
              x={toSvgX(mx)}
              y={toSvgY(my)}
              width={toSvgX(X_MAX) - toSvgX(mx)}
              height={PAD.top + PLOT_H - toSvgY(my)}
              className="fill-rose-500/[0.06]"
            />
            {/* Quadrant signs */}
            <text
              x={toSvgX(mx) + 10}
              y={PAD.top + 18}
              className="fill-emerald-500/40 text-sm font-bold"
            >
              +
            </text>
            <text
              x={toSvgX(mx) - 20}
              y={PAD.top + PLOT_H - 8}
              className="fill-emerald-500/40 text-sm font-bold"
            >
              +
            </text>
            <text
              x={toSvgX(mx) - 18}
              y={PAD.top + 18}
              className="fill-rose-500/40 text-sm font-bold"
            >
              −
            </text>
            <text
              x={toSvgX(mx) + 10}
              y={PAD.top + PLOT_H - 8}
              className="fill-rose-500/40 text-sm font-bold"
            >
              −
            </text>
          </>
        )}

        {/* Mean crosshairs */}
        {points.length >= 2 && (
          <>
            <line
              x1={toSvgX(mx)}
              x2={toSvgX(mx)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              className="stroke-amber-400/60"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={toSvgY(my)}
              y2={toSvgY(my)}
              className="stroke-amber-400/60"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          </>
        )}

        {/* Deviation rectangles */}
        {showRects &&
          points.length >= 2 &&
          points.map((p, i) => {
            const isPos = contribs[i] >= 0;
            const rx = Math.min(toSvgX(mx), toSvgX(p.x));
            const ry = Math.min(toSvgY(my), toSvgY(p.y));
            const rw = Math.abs(toSvgX(p.x) - toSvgX(mx));
            const rh = Math.abs(toSvgY(p.y) - toSvgY(my));
            if (rw < 1 && rh < 1) return null;
            return (
              <rect
                key={`r${i}`}
                x={rx}
                y={ry}
                width={rw}
                height={rh}
                className={
                  isPos
                    ? "fill-emerald-400/15 stroke-emerald-400/40"
                    : "fill-rose-400/15 stroke-rose-400/40"
                }
                strokeWidth={0.75}
              />
            );
          })}

        {/* Data points */}
        {points.map((p, i) => {
          const isPos = contribs[i] >= 0;
          return (
            <circle
              key={`p${i}`}
              cx={toSvgX(p.x)}
              cy={toSvgY(p.y)}
              r={7}
              className={`cursor-grab active:cursor-grabbing ${
                isPos
                  ? "fill-emerald-400 stroke-emerald-200"
                  : "fill-rose-400 stroke-rose-200"
              }`}
              strokeWidth={1.5}
              onPointerDown={onCirclePointerDown(i)}
              onDoubleClick={onCircleDoubleClick(i)}
            />
          );
        })}

        {/* Mean dot */}
        {points.length >= 2 && (
          <circle
            cx={toSvgX(mx)}
            cy={toSvgY(my)}
            r={5}
            className="fill-amber-400 stroke-amber-200"
            strokeWidth={2}
          />
        )}

        {/* Axes */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        {/* X-axis ticks */}
        {xTicks
          .filter((x) => x % 2 === 0)
          .map((x) => (
            <g key={`xt${x}`}>
              <line
                x1={toSvgX(x)}
                x2={toSvgX(x)}
                y1={PAD.top + PLOT_H}
                y2={PAD.top + PLOT_H + 6}
                className="stroke-foreground/40"
                strokeWidth={1}
              />
              <text
                x={toSvgX(x)}
                y={PAD.top + PLOT_H + 22}
                textAnchor="middle"
                className="fill-foreground/60 text-[11px]"
              >
                {x}
              </text>
            </g>
          ))}

        {/* Y-axis ticks */}
        {yTicks
          .filter((y) => y % 2 === 0)
          .map((y) => (
            <g key={`yt${y}`}>
              <line
                x1={PAD.left - 6}
                x2={PAD.left}
                y1={toSvgY(y)}
                y2={toSvgY(y)}
                className="stroke-foreground/40"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={toSvgY(y) + 4}
                textAnchor="end"
                className="fill-foreground/60 text-[11px]"
              >
                {y}
              </text>
            </g>
          ))}

        {/* Axis labels */}
        <text
          x={PAD.left + PLOT_W / 2}
          y={HEIGHT - 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
        >
          X
        </text>
        <text
          x={14}
          y={PAD.top + PLOT_H / 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
          transform={`rotate(-90, 14, ${PAD.top + PLOT_H / 2})`}
        >
          Y
        </text>
      </svg>

      {/* Stats display */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex flex-col items-center">
          <span className="text-foreground/50">Cov(X, Y)</span>
          <span className={`text-2xl font-semibold tabular-nums ${covColor}`}>
            {cov.toFixed(3)}
          </span>
          <span className={`text-xs ${covColor}`}>{covLabel}</span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-foreground/50">x&#772;</span>
          <span className="text-lg font-medium tabular-nums text-amber-400">
            {mx.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-foreground/50">y&#772;</span>
          <span className="text-lg font-medium tabular-nums text-amber-400">
            {my.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-foreground/50">n</span>
          <span className="text-lg font-medium tabular-nums text-foreground/70">
            {points.length}
          </span>
        </div>
      </div>

      {/* Contribution bars */}
      {points.length >= 2 && (
        <div className="w-full max-w-[600px]">
          <p className="mb-2 text-center text-xs text-foreground/40">
            Per-point contributions: (x&#7522; &minus; x&#772;)(y&#7522; &minus;
            y&#772;)
          </p>
          <div className="flex flex-col gap-1">
            {sortedContribs.map(({ c, i }) => {
              const pct = (Math.abs(c) / maxAbsContrib) * 50;
              const isPos = c >= 0;
              return (
                <div key={i} className="flex h-5 items-center gap-2">
                  <span className="w-8 text-right text-[10px] tabular-nums text-foreground/40">
                    P{i + 1}
                  </span>
                  <div className="relative flex h-3.5 flex-1 items-center">
                    <div className="absolute bottom-0 left-1/2 top-0 w-px bg-foreground/10" />
                    <div
                      className={`absolute h-full rounded-sm ${
                        isPos ? "bg-emerald-400/50" : "bg-rose-400/50"
                      }`}
                      style={{
                        left: isPos ? "50%" : `${50 - pct}%`,
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                  <span
                    className={`w-16 text-[10px] tabular-nums ${
                      isPos ? "text-emerald-400/70" : "text-rose-400/70"
                    }`}
                  >
                    {c >= 0 ? "+" : ""}
                    {c.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-foreground/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
          Positive contribution
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-rose-400" />
          Negative contribution
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
          Mean (x&#772;, y&#772;)
        </span>
      </div>
      <p className="text-center text-xs text-foreground/30">
        Click to add a point &middot; drag to move &middot; double-click to
        remove
      </p>
    </div>
  );
}
