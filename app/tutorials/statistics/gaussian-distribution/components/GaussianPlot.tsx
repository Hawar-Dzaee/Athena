"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const WIDTH = 600;
const HEIGHT = 320;
const PAD = { top: 20, right: 30, bottom: 40, left: 50 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const X_MIN = -8;
const X_MAX = 8;
const NUM_POINTS = 400;

function gaussianPdf(x: number, mu: number, sigma: number): number {
  const coeff = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const exponent = -((x - mu) ** 2) / (2 * sigma ** 2);
  return coeff * Math.exp(exponent);
}

function xScale(x: number): number {
  return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}

function yScale(y: number, yMax: number): number {
  return PAD.top + PLOT_H - (y / yMax) * PLOT_H;
}

function buildPath(
  mu: number,
  sigma: number,
  yMax: number
): string {
  const step = (X_MAX - X_MIN) / NUM_POINTS;
  let d = "";
  for (let i = 0; i <= NUM_POINTS; i++) {
    const x = X_MIN + i * step;
    const y = gaussianPdf(x, mu, sigma);
    const sx = xScale(x);
    const sy = yScale(y, yMax);
    d += i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
  }
  return d;
}

function buildBandPath(
  mu: number,
  sigma: number,
  nSigma: number,
  yMax: number
): string {
  const lo = Math.max(mu - nSigma * sigma, X_MIN);
  const hi = Math.min(mu + nSigma * sigma, X_MAX);
  const steps = 200;
  const step = (hi - lo) / steps;

  let d = `M${xScale(lo)},${yScale(0, yMax)}`;
  for (let i = 0; i <= steps; i++) {
    const x = lo + i * step;
    d += `L${xScale(x)},${yScale(gaussianPdf(x, mu, sigma), yMax)}`;
  }
  d += `L${xScale(hi)},${yScale(0, yMax)}Z`;
  return d;
}

const BANDS = [
  { n: 3, fill: "fill-blue-500/15",    label: "±3σ (99.73%)", color: "bg-blue-500/30" },
  { n: 2, fill: "fill-violet-500/20",  label: "±2σ (95.45%)", color: "bg-violet-500/40" },
  { n: 1, fill: "fill-emerald-500/25", label: "±1σ (68.27%)", color: "bg-emerald-500/50" },
] as const;

function XAxisTicks({ yMax }: { yMax: number }) {
  const ticks = [];
  for (let x = X_MIN; x <= X_MAX; x += 2) {
    ticks.push(x);
  }
  const baseline = yScale(0, yMax);
  return (
    <>
      {ticks.map((x) => (
        <g key={x}>
          <line
            x1={xScale(x)}
            x2={xScale(x)}
            y1={baseline}
            y2={baseline + 6}
            className="stroke-foreground/40"
            strokeWidth={1}
          />
          <text
            x={xScale(x)}
            y={baseline + 20}
            textAnchor="middle"
            className="fill-foreground/60 text-[11px]"
          >
            {x}
          </text>
        </g>
      ))}
    </>
  );
}

function YAxisTicks({ yMax }: { yMax: number }) {
  const count = 5;
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    ticks.push((yMax / count) * i);
  }
  return (
    <>
      {ticks.map((y) => (
        <g key={y}>
          <line
            x1={PAD.left - 6}
            x2={PAD.left}
            y1={yScale(y, yMax)}
            y2={yScale(y, yMax)}
            className="stroke-foreground/40"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 10}
            y={yScale(y, yMax) + 4}
            textAnchor="end"
            className="fill-foreground/60 text-[11px]"
          >
            {y.toFixed(2)}
          </text>
        </g>
      ))}
    </>
  );
}

export function GaussianPlot() {
  const [mu, setMu] = useState(0);
  const [sigma, setSigma] = useState(1);

  const yMax = useMemo(() => {
    const peak = gaussianPdf(mu, mu, sigma);
    return Math.max(peak * 1.15, 0.1);
  }, [mu, sigma]);

  const curvePath = useMemo(() => buildPath(mu, sigma, yMax), [mu, sigma, yMax]);
  const bandPaths = useMemo(
    () => BANDS.map((b) => buildBandPath(mu, sigma, b.n, yMax)),
    [mu, sigma, yMax]
  );

  const handleMu = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMu(parseFloat(e.target.value));
  }, []);

  const handleSigma = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSigma(parseFloat(e.target.value));
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <div className="my-8 flex flex-col items-center gap-6">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[600px] overflow-visible"
        role="img"
        aria-label={`Gaussian distribution plot with μ=${mu.toFixed(1)} and σ=${sigma.toFixed(1)}`}
      >
        {/* grid lines */}
        {Array.from({ length: 9 }, (_, i) => X_MIN + i * 2).map((x) => (
          <line
            key={`gx-${x}`}
            x1={xScale(x)}
            x2={xScale(x)}
            y1={PAD.top}
            y2={yScale(0, yMax)}
            className="stroke-foreground/[0.06]"
            strokeWidth={1}
          />
        ))}

        {/* σ bands — rendered outermost first so inner bands layer on top */}
        {BANDS.map((b, i) => (
          <path key={b.n} d={bandPaths[i]} className={b.fill} />
        ))}

        {/* curve */}
        <path
          d={curvePath}
          fill="none"
          className="stroke-emerald-400"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* mean line */}
        <line
          x1={xScale(mu)}
          x2={xScale(mu)}
          y1={yScale(gaussianPdf(mu, mu, sigma), yMax)}
          y2={yScale(0, yMax)}
          className="stroke-amber-400"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />

        {/* axes */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={yScale(0, yMax)}
          y2={yScale(0, yMax)}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={yScale(0, yMax)}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        <XAxisTicks yMax={yMax} />
        <YAxisTicks yMax={yMax} />

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
          f(x)
        </text>
      </svg>

      {/* controls */}
      <div className="flex flex-wrap justify-center gap-8">
        <label className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-foreground/70">
            μ = {mu.toFixed(1)}
          </span>
          <input
            type="range"
            min={-5}
            max={5}
            step={0.1}
            value={mu}
            onChange={handleMu}
            className="w-48 accent-amber-400"
            aria-label="Mean (μ)"
          />
        </label>
        <label className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-foreground/70">
            σ = {sigma.toFixed(1)}
          </span>
          <input
            type="range"
            min={0.3}
            max={4}
            step={0.1}
            value={sigma}
            onChange={handleSigma}
            className="w-48 accent-emerald-400"
            aria-label="Standard deviation (σ)"
          />
        </label>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-4 text-sm text-foreground/60">
        {[...BANDS].reverse().map((b) => (
          <span key={b.n} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${b.color}`} />
            {b.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-amber-400" style={{ borderTop: "2px dashed" }} />
          mean
        </span>
      </div>
    </div>
  );
}
