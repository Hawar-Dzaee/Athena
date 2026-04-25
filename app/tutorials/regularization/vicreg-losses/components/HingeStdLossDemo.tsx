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


function gaussianSample(rng: () => number): number {
  let u: number, v: number, s: number;
  do {
    u = rng() * 2 - 1;
    v = rng() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt((-2 * Math.log(s)) / s);
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
  const [n, setN] = useState(16);
  const [d, setD] = useState(16);
  const [spread, setSpread] = useState(1.0);
  const [seed, setSeed] = useState(42);

  const { data, absMax, stds, maxStd } = useMemo(() => {
    const rng = mulberry32(seed);
    const flat = new Float32Array(n * d);
    let mx = 0;
    for (let ri = 0; ri < n; ri++) {
      for (let ci = 0; ci < d; ci++) {
        const val = gaussianSample(rng) * spread;
        flat[ri * d + ci] = val;
        const a = Math.abs(val);
        if (a > mx) mx = a;
      }
    }
    const colStds = new Float32Array(d);
    let ms = 0;
    for (let ci = 0; ci < d; ci++) {
      let sum = 0;
      for (let ri = 0; ri < n; ri++) sum += flat[ri * d + ci];
      const mean = sum / n;
      let varSum = 0;
      for (let ri = 0; ri < n; ri++) {
        const diff = flat[ri * d + ci] - mean;
        varSum += diff * diff;
      }
      const std = Math.sqrt(varSum / (n - 1) + 0.0001);
      colStds[ci] = std;
      if (std > ms) ms = std;
    }
    return { data: flat, absMax: Math.max(mx, 0.01), stds: colStds, maxStd: Math.max(ms, 0.01) };
  }, [n, d, spread, seed]);

  const colorScale = useMemo(() => {
    const interp = d3.interpolateRgbBasis(["#3b82f6", "#1e1e2e", "#ef4444"]);
    return (v: number) => interp((v / absMax + 1) / 2);
  }, [absMax]);

  const stdColorScale = useMemo(() => {
    const interp = d3.interpolateRgbBasis(["#312e81", "#8b5cf6", "#10b981"]);
    return (v: number) => interp(Math.min(v / maxStd, 1));
  }, [maxStd]);

  const cellSize = Math.max(12, Math.min(36, Math.floor(1200 / Math.max(n, d))));
  const lm = 48;
  const tm = 36;
  const rm = 70;
  const gridW = d * cellSize;
  const gridH = n * cellSize;
  const valBarX = lm + gridW + 16;
  const valBarW = 10;
  const svgW = valBarX + valBarW + 40;
  const svgH = tm + gridH + 16;

  const stdTm = 14;
  const stdBm = 22;
  const stdRowH = cellSize;
  const stdBarH = 80;
  const stdSvgH = stdTm + Math.max(stdRowH, stdBarH) + stdBm;
  const stdValBarX = valBarX;
  const stdSvgW = svgW;

  const nTicks = useMemo(() => {
    const ticks: number[] = [0];
    const step = Math.max(1, Math.floor(n / 4));
    for (let i = step; i < n; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1);
    return ticks;
  }, [n]);

  const dTicks = useMemo(() => {
    const ticks: number[] = [0];
    const step = Math.max(1, Math.floor(d / 4));
    for (let i = step; i < d; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== d - 1) ticks.push(d - 1);
    return ticks;
  }, [d]);

  const cells = useMemo(() => {
    const rects: React.ReactNode[] = [];
    for (let ri = 0; ri < n; ri++) {
      for (let ci = 0; ci < d; ci++) {
        rects.push(
          <rect
            key={ri * d + ci}
            x={lm + ci * cellSize}
            y={tm + ri * cellSize}
            width={cellSize}
            height={cellSize}
            fill={colorScale(data[ri * d + ci])}
          />,
        );
      }
    }
    return rects;
  }, [data, colorScale, n, d, cellSize]);

  const legendStops = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      offset: `${(i / 6) * 100}%`,
      color: colorScale(-absMax + (i / 6) * 2 * absMax),
    })),
  [colorScale, absMax]);

  const stdLegendStops = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      offset: `${(i / 6) * 100}%`,
      color: stdColorScale((i / 6) * maxStd),
    })),
  [stdColorScale, maxStd]);

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="Input data heatmap (N × D)"
    >
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span className="font-semibold uppercase tracking-wider">Batch (N)</span>
            <span className="ml-3 font-mono">{n}</span>
          </div>
          <input
            type="range" min={2} max={16} step={1}
            value={n}
            onChange={(e) => setN(parseInt(e.target.value))}
            className="w-36 accent-violet-500"
            aria-label="Batch size"
          />
        </label>
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span className="font-semibold uppercase tracking-wider">Dims (D)</span>
            <span className="ml-3 font-mono">{d}</span>
          </div>
          <input
            type="range" min={1} max={16} step={1}
            value={d}
            onChange={(e) => setD(parseInt(e.target.value))}
            className="w-36 accent-violet-500"
            aria-label="Projection dimensions"
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
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW}
        height={svgH}
        role="img"
        aria-label="Heatmap of input data values"
      >
        <defs>
          <linearGradient id="input-hm-grad" x1="0" x2="0" y1="1" y2="0">
            {legendStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>

        <text
          x={14}
          y={tm + gridH / 2}
          fontSize="13"
          fontWeight="600"
          fill="#d4d4d8"
          textAnchor="middle"
          transform={`rotate(-90, 14, ${tm + gridH / 2})`}
        >
          N (samples)
        </text>

        <text
          x={lm + gridW / 2}
          y={14}
          fontSize="13"
          fontWeight="600"
          fill="#d4d4d8"
          textAnchor="middle"
        >
          D (dimensions)
        </text>

        {dTicks.map((ci) => (
          <text
            key={ci}
            x={lm + ci * cellSize + cellSize / 2}
            y={tm - 6}
            fontSize="11"
            fill="#a1a1aa"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {ci}
          </text>
        ))}

        {nTicks.map((ri) => (
          <text
            key={ri}
            x={lm - 6}
            y={tm + ri * cellSize + cellSize / 2 + 4}
            fontSize="11"
            fill="#a1a1aa"
            textAnchor="end"
            fontFamily="monospace"
          >
            {ri}
          </text>
        ))}

        {cells}

        {/* value color bar — vertical, right of grid */}
        <rect
          x={valBarX}
          y={tm}
          width={valBarW}
          height={gridH}
          rx={4}
          fill="url(#input-hm-grad)"
        />
        <text
          x={valBarX + valBarW / 2}
          y={tm - 6}
          fontSize="11"
          fill="#a1a1aa"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {absMax.toFixed(1)}
        </text>
        <text
          x={valBarX + valBarW / 2}
          y={tm + gridH + 14}
          fontSize="11"
          fill="#a1a1aa"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {(-absMax).toFixed(1)}
        </text>
        <text
          x={valBarX + valBarW / 2}
          y={tm + gridH / 2 + 4}
          fontSize="11"
          fontWeight="600"
          fill="#d4d4d8"
          textAnchor="middle"
          transform={`rotate(-90, ${valBarX + valBarW / 2}, ${tm + gridH / 2})`}
        >
          value
        </text>
      </svg>

      {/* std heatmap — 1 row × D columns */}
      <svg
        viewBox={`0 0 ${stdSvgW} ${stdSvgH}`}
        width={stdSvgW}
        height={stdSvgH}
        className="mt-2"
        role="img"
        aria-label="Per-dimension standard deviation heatmap"
      >
        <defs>
          <linearGradient id="std-bar-grad" x1="0" x2="0" y1="1" y2="0">
            {stdLegendStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>

        <text
          x={lm - 6}
          y={stdTm + stdRowH / 2 + 4}
          fontSize="11"
          fontWeight="600"
          fill="#d4d4d8"
          textAnchor="end"
        >
          std
        </text>

        {dTicks.map((ci) => (
          <text
            key={ci}
            x={lm + ci * cellSize + cellSize / 2}
            y={stdTm + stdRowH + 14}
            fontSize="11"
            fill="#a1a1aa"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {ci}
          </text>
        ))}

        {Array.from(stds).map((s, ci) => (
          <rect
            key={ci}
            x={lm + ci * cellSize}
            y={stdTm}
            width={cellSize}
            height={stdRowH}
            fill={stdColorScale(s)}
          />
        ))}

        {/* std color bar — vertical, right side */}
        <rect
          x={stdValBarX}
          y={stdTm}
          width={valBarW}
          height={stdBarH}
          rx={4}
          fill="url(#std-bar-grad)"
        />
        <text
          x={stdValBarX + valBarW + 4}
          y={stdTm + 4}
          fontSize="11"
          fill="#a1a1aa"
          fontFamily="monospace"
          dominantBaseline="hanging"
        >
          {maxStd.toFixed(2)}
        </text>
        <text
          x={stdValBarX + valBarW + 4}
          y={stdTm + stdBarH}
          fontSize="11"
          fill="#a1a1aa"
          fontFamily="monospace"
          dominantBaseline="auto"
        >
          0
        </text>
      </svg>
    </figure>
  );
}
