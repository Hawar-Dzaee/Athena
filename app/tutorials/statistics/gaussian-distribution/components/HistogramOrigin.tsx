"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 300;
const PAD = { top: 20, right: 30, bottom: 40, left: 50 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const X_MIN = -5;
const X_MAX = 5;

function boxMuller(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateSamples(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(boxMuller());
  }
  return out;
}

function xScale(x: number): number {
  return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}

function gaussianPdf(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

const SAMPLE_PRESETS = [50, 500, 5000] as const;
const BIN_COUNTS = [8, 20, 50] as const;

export function HistogramOrigin() {
  const [samples, setSamples] = useState<number[]>(() => generateSamples(50));
  const [numBins, setNumBins] = useState(20);
  const [showCurve, setShowCurve] = useState(false);
  const seedRef = useRef(0);

  const resample = useCallback((n: number) => {
    seedRef.current++;
    setSamples(generateSamples(n));
  }, []);

  const { bins, yMaxHist } = useMemo(() => {
    const binWidth = (X_MAX - X_MIN) / numBins;
    const counts = new Array(numBins).fill(0);
    for (const s of samples) {
      if (s >= X_MIN && s < X_MAX) {
        const idx = Math.min(
          Math.floor((s - X_MIN) / binWidth),
          numBins - 1
        );
        counts[idx]++;
      }
    }
    const densities = counts.map((c) => c / (samples.length * binWidth));
    const mx = Math.max(...densities, 0.01);
    return {
      bins: densities.map((d, i) => ({
        x0: X_MIN + i * binWidth,
        x1: X_MIN + (i + 1) * binWidth,
        density: d,
      })),
      yMaxHist: mx,
    };
  }, [samples, numBins]);

  const yMax = useMemo(() => {
    const pdfPeak = gaussianPdf(0);
    return Math.max(yMaxHist, showCurve ? pdfPeak : 0) * 1.15;
  }, [yMaxHist, showCurve]);

  function yScale(y: number): number {
    return PAD.top + PLOT_H - (y / yMax) * PLOT_H;
  }

  const curvePath = useMemo(() => {
    const steps = 200;
    const step = (X_MAX - X_MIN) / steps;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = X_MIN + i * step;
      const y = gaussianPdf(x);
      const sx = xScale(x);
      const sy = yScale(y);
      d += i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
    }
    return d;
  }, [yMax]);

  const xTicks = useMemo(() => {
    const t = [];
    for (let x = X_MIN; x <= X_MAX; x += 1) t.push(x);
    return t;
  }, []);

  const yTicks = useMemo(() => {
    const count = 4;
    const t = [];
    for (let i = 0; i <= count; i++) t.push((yMax / count) * i);
    return t;
  }, [yMax]);

  return (
    <div className="my-8 flex flex-col items-center gap-5">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[600px] overflow-visible"
        role="img"
        aria-label={`Histogram of ${samples.length} samples from a standard normal distribution with ${numBins} bins`}
      >
        {/* histogram bars */}
        {bins.map((b, i) => (
          <rect
            key={i}
            x={xScale(b.x0) + 0.5}
            y={yScale(b.density)}
            width={Math.max(xScale(b.x1) - xScale(b.x0) - 1, 1)}
            height={Math.max(yScale(0) - yScale(b.density), 0)}
            className="fill-sky-500/50 stroke-sky-400/70"
            strokeWidth={0.5}
          />
        ))}

        {/* theoretical PDF overlay */}
        {showCurve && (
          <path
            d={curvePath}
            fill="none"
            className="stroke-emerald-400"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}

        {/* axes */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={yScale(0)}
          y2={yScale(0)}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={yScale(0)}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        {/* x ticks */}
        {xTicks.map((x) => (
          <g key={x}>
            <line
              x1={xScale(x)}
              x2={xScale(x)}
              y1={yScale(0)}
              y2={yScale(0) + 6}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={xScale(x)}
              y={yScale(0) + 20}
              textAnchor="middle"
              className="fill-foreground/60 text-[11px]"
            >
              {x}
            </text>
          </g>
        ))}

        {/* y ticks */}
        {yTicks.map((y) => (
          <g key={y}>
            <line
              x1={PAD.left - 6}
              x2={PAD.left}
              y1={yScale(y)}
              y2={yScale(y)}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={yScale(y) + 4}
              textAnchor="end"
              className="fill-foreground/60 text-[11px]"
            >
              {y.toFixed(2)}
            </text>
          </g>
        ))}

        {/* axis labels */}
        <text
          x={PAD.left + PLOT_W / 2}
          y={HEIGHT - 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
        >
          x
        </text>
        <text
          x={12}
          y={PAD.top + PLOT_H / 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
          transform={`rotate(-90, 12, ${PAD.top + PLOT_H / 2})`}
        >
          density
        </text>
      </svg>

      {/* controls */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-foreground/60">Samples:</span>
          {SAMPLE_PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => resample(n)}
              className={`rounded-md px-3 py-1 font-mono transition-colors ${
                samples.length === n
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                  : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              }`}
              aria-label={`Draw ${n} samples`}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-foreground/60">Bins:</span>
          {BIN_COUNTS.map((b) => (
            <button
              key={b}
              onClick={() => setNumBins(b)}
              className={`rounded-md px-3 py-1 font-mono transition-colors ${
                numBins === b
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                  : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              }`}
              aria-label={`Use ${b} bins`}
            >
              {b}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showCurve}
            onChange={(e) => setShowCurve(e.target.checked)}
            className="accent-emerald-400"
          />
          <span className="text-foreground/60">Show PDF curve</span>
        </label>
      </div>
    </div>
  );
}
