"use client";

import { useCallback, useMemo, useState } from "react";

const SIZE = 500;
const PAD = 50;
const PLOT = SIZE - 2 * PAD;
const RANGE = 5;

function boxMullerPair(): [number, number] {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const r = Math.sqrt(-2 * Math.log(u));
  const theta = 2 * Math.PI * v;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

function generate(
  n: number,
  sx: number,
  sy: number
): [number, number][] {
  return Array.from({ length: n }, () => {
    const [a, b] = boxMullerPair();
    return [a * sx, b * sy] as [number, number];
  });
}

function px(x: number) {
  return PAD + ((x + RANGE) / (2 * RANGE)) * PLOT;
}
function py(y: number) {
  return PAD + PLOT - ((y + RANGE) / (2 * RANGE)) * PLOT;
}
function pr(r: number) {
  return (r / (2 * RANGE)) * PLOT;
}

const CONTOURS = [
  { n: 3, fill: "fill-blue-500/10", stroke: "stroke-blue-400/30", label: "3σ", dot: "bg-blue-500/40" },
  { n: 2, fill: "fill-violet-500/15", stroke: "stroke-violet-400/40", label: "2σ", dot: "bg-violet-500/50" },
  { n: 1, fill: "fill-emerald-500/20", stroke: "stroke-emerald-400/50", label: "1σ", dot: "bg-emerald-500/60" },
] as const;

const SAMPLE_COUNTS = [100, 500, 2000] as const;
const TICKS = [-4, -2, 0, 2, 4];
const CX = px(0);
const CY = py(0);

export function IsotropicGaussian() {
  const [isotropic, setIsotropic] = useState(true);
  const [sigma, setSigma] = useState(1.0);
  const [sigmaX, setSigmaX] = useState(1.0);
  const [sigmaY, setSigmaY] = useState(2.0);
  const [numSamples, setNumSamples] = useState<number>(500);
  const [seed, setSeed] = useState(0);

  const effSX = isotropic ? sigma : sigmaX;
  const effSY = isotropic ? sigma : sigmaY;

  const samples = useMemo(() => {
    void seed;
    return generate(numSamples, effSX, effSY);
  }, [numSamples, effSX, effSY, seed]);

  const resample = useCallback(() => setSeed((s) => s + 1), []);

  const handleCount = useCallback((n: number) => {
    setNumSamples(n);
    setSeed((s) => s + 1);
  }, []);

  const handleSigma = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSigma(parseFloat(e.target.value)),
    []
  );
  const handleSigmaX = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSigmaX(parseFloat(e.target.value)),
    []
  );
  const handleSigmaY = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSigmaY(parseFloat(e.target.value)),
    []
  );

  return (
    <div className="my-8 flex flex-col items-center gap-6">
      {/* contour + scatter plot */}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[500px]"
        role="img"
        aria-label={`${isotropic ? "Isotropic" : "Anisotropic"} Gaussian contour plot with σx=${effSX.toFixed(1)}, σy=${effSY.toFixed(1)}`}
      >
        <defs>
          <clipPath id="iso-clip">
            <rect x={PAD} y={PAD} width={PLOT} height={PLOT} />
          </clipPath>
        </defs>

        {/* grid */}
        {Array.from({ length: 11 }, (_, i) => -5 + i).map((v) => (
          <g key={v} className="stroke-foreground/[0.06]">
            <line
              x1={px(v)}
              x2={px(v)}
              y1={PAD}
              y2={PAD + PLOT}
              strokeWidth={1}
            />
            <line
              x1={PAD}
              x2={PAD + PLOT}
              y1={py(v)}
              y2={py(v)}
              strokeWidth={1}
            />
          </g>
        ))}

        <g clipPath="url(#iso-clip)">
          {/* contour ellipses — outermost first so inner ones layer on top */}
          {CONTOURS.map((c) => (
            <ellipse
              key={c.n}
              cx={CX}
              cy={CY}
              rx={pr(c.n * effSX)}
              ry={pr(c.n * effSY)}
              className={`${c.fill} ${c.stroke}`}
              strokeWidth={1.5}
            />
          ))}

          {/* sample points */}
          {samples.map(([x, y], i) => (
            <circle
              key={i}
              cx={px(x)}
              cy={py(y)}
              r={1.5}
              className="fill-sky-400/60"
            />
          ))}
        </g>

        {/* axes */}
        <line
          x1={PAD}
          x2={PAD + PLOT}
          y1={CY}
          y2={CY}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        <line
          x1={CX}
          x2={CX}
          y1={PAD}
          y2={PAD + PLOT}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        {/* ticks + labels */}
        {TICKS.map((v) => (
          <g key={v}>
            <line
              x1={px(v)}
              x2={px(v)}
              y1={CY}
              y2={CY + 6}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={px(v)}
              y={CY + 18}
              textAnchor="middle"
              className="fill-foreground/60 text-[11px]"
            >
              {v}
            </text>
            {v !== 0 && (
              <>
                <line
                  x1={CX - 6}
                  x2={CX}
                  y1={py(v)}
                  y2={py(v)}
                  className="stroke-foreground/40"
                  strokeWidth={1}
                />
                <text
                  x={CX - 10}
                  y={py(v) + 4}
                  textAnchor="end"
                  className="fill-foreground/60 text-[11px]"
                >
                  {v}
                </text>
              </>
            )}
          </g>
        ))}

        {/* axis labels */}
        <text
          x={PAD + PLOT / 2}
          y={SIZE - 6}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
        >
          x₁
        </text>
        <text
          x={12}
          y={PAD + PLOT / 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
          transform={`rotate(-90, 12, ${PAD + PLOT / 2})`}
        >
          x₂
        </text>
      </svg>

      {/* live covariance matrix */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-foreground/70">Σ</span>
        <span className="text-foreground/40">=</span>
        {isotropic && (
          <>
            <span className="text-emerald-400">{sigma.toFixed(1)}²</span>
            <span className="text-foreground/40">·</span>
            <span className="font-semibold text-foreground/70">I</span>
            <span className="text-foreground/40">=</span>
          </>
        )}
        <div className="flex items-stretch">
          <div className="w-1.5 rounded-l-sm border-y-2 border-l-2 border-foreground/20" />
          <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 px-2 py-1.5">
            <span className="text-right text-emerald-400">
              {(effSX ** 2).toFixed(2)}
            </span>
            <span className="text-right text-foreground/20">0</span>
            <span className="text-right text-foreground/20">0</span>
            <span
              className={`text-right ${isotropic ? "text-emerald-400" : "text-violet-400"}`}
            >
              {(effSY ** 2).toFixed(2)}
            </span>
          </div>
          <div className="w-1.5 rounded-r-sm border-y-2 border-r-2 border-foreground/20" />
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        {/* isotropic / anisotropic toggle */}
        <div className="flex items-center gap-2">
          {(["Isotropic", "Anisotropic"] as const).map((label) => (
            <button
              key={label}
              onClick={() => setIsotropic(label === "Isotropic")}
              className={`rounded-md px-3 py-1 transition-colors ${
                (label === "Isotropic") === isotropic
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* sigma sliders */}
        {isotropic ? (
          <label className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-foreground/70">
              σ = {sigma.toFixed(1)}
            </span>
            <input
              type="range"
              min={0.3}
              max={2.5}
              step={0.1}
              value={sigma}
              onChange={handleSigma}
              className="w-48 accent-emerald-400"
              aria-label="Standard deviation σ"
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-foreground/70">
                σ<sub>x</sub> = {sigmaX.toFixed(1)}
              </span>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.1}
                value={sigmaX}
                onChange={handleSigmaX}
                className="w-36 accent-emerald-400"
                aria-label="Standard deviation σx"
              />
            </label>
            <label className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-foreground/70">
                σ<sub>y</sub> = {sigmaY.toFixed(1)}
              </span>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.1}
                value={sigmaY}
                onChange={handleSigmaY}
                className="w-36 accent-violet-400"
                aria-label="Standard deviation σy"
              />
            </label>
          </>
        )}

        {/* sample count */}
        <div className="flex items-center gap-2">
          <span className="text-foreground/60">Samples:</span>
          {SAMPLE_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => handleCount(n)}
              className={`rounded-md px-3 py-1 font-mono transition-colors ${
                numSamples === n
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                  : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              }`}
              aria-label={`Draw ${n} samples`}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>

        <button
          onClick={resample}
          className="rounded-md bg-foreground/5 px-3 py-1 text-foreground/60 transition-colors hover:bg-foreground/10"
          aria-label="Resample"
        >
          ↻ Resample
        </button>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-4 text-sm text-foreground/60">
        {[...CONTOURS].reverse().map((c) => (
          <span key={c.n} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${c.dot}`} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
