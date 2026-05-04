"use client";

import { useState, useMemo } from "react";
import * as d3 from "d3";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianSample(rng: () => number) {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

type Preset = "correlated" | "decorrelated" | "anti-corr";

export function CovarianceMatMulDemo() {
  const [n, setN] = useState(8);
  const [d, setD] = useState(5);
  const [preset, setPreset] = useState<Preset>("correlated");
  const [hovered, setHovered] = useState<{ i: number; j: number } | null>(null);

  const computed = useMemo(() => {
    const rng = mulberry32(42);
    const raw = new Float32Array(n * d);

    if (preset === "correlated") {
      for (let ri = 0; ri < n; ri++) {
        const base = gaussianSample(rng) * 2;
        for (let ci = 0; ci < d; ci++)
          raw[ri * d + ci] = base + gaussianSample(rng) * 0.3;
      }
    } else if (preset === "decorrelated") {
      for (let ri = 0; ri < n; ri++)
        for (let ci = 0; ci < d; ci++)
          raw[ri * d + ci] = gaussianSample(rng) * 1.5;
    } else {
      for (let ri = 0; ri < n; ri++)
        for (let ci = 0; ci < d; ci++) {
          const base = gaussianSample(rng) * 2;
          raw[ri * d + ci] = ci % 2 === 0 ? base : -base + gaussianSample(rng) * 0.2;
        }
    }

    const means = new Float32Array(d);
    for (let ci = 0; ci < d; ci++) {
      let s = 0;
      for (let ri = 0; ri < n; ri++) s += raw[ri * d + ci];
      means[ci] = s / n;
    }
    const xC = new Float32Array(n * d);
    for (let ri = 0; ri < n; ri++)
      for (let ci = 0; ci < d; ci++)
        xC[ri * d + ci] = raw[ri * d + ci] - means[ci];

    const xT = new Float32Array(d * n);
    for (let i = 0; i < d; i++)
      for (let k = 0; k < n; k++)
        xT[i * n + k] = xC[k * d + i];

    const cov = new Float32Array(d * d);
    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += xT[i * n + k] * xC[k * d + j];
        cov[i * d + j] = s / (n - 1);
      }

    let mxX = 0;
    for (let i = 0; i < xC.length; i++)
      if (Math.abs(xC[i]) > mxX) mxX = Math.abs(xC[i]);
    let mxC = 0;
    for (let i = 0; i < cov.length; i++)
      if (Math.abs(cov[i]) > mxC) mxC = Math.abs(cov[i]);

    let offSum = 0, offCnt = 0;
    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++)
        if (i !== j) { offSum += cov[i * d + j] ** 2; offCnt++; }

    return {
      xC, xT, cov,
      absMaxX: Math.max(mxX, 0.5),
      absMaxCov: Math.max(mxC, 0.5),
      loss: offCnt > 0 ? offSum / offCnt : 0,
    };
  }, [n, d, preset]);

  const scaleMaxX = Math.max(computed.absMaxX, 1);
  const scaleMaxCov = Math.max(computed.absMaxCov, 1);

  const xColorFn = useMemo(() => {
    const interp = d3.interpolateRgbBasis(["#3b82f6", "#1e1e2e", "#ef4444"]);
    return (v: number) => interp((v / scaleMaxX + 1) / 2);
  }, [scaleMaxX]);

  const covColorFn = useMemo(() => {
    const interp = d3.interpolateRgbBasis(["#3b82f6", "#1e1e2e", "#ef4444"]);
    return (v: number) => interp((v / scaleMaxCov + 1) / 2);
  }, [scaleMaxCov]);

  const cs = Math.max(20, Math.min(32, Math.floor(280 / Math.max(n, d))));
  const pad = 48;
  const gap = 16;

  const xOx = pad + n * cs + gap;
  const xOy = pad;
  const xtOx = pad;
  const xtOy = pad + n * cs + gap;
  const covOx = pad + n * cs + gap;
  const covOy = pad + n * cs + gap;

  const barGap = 14;
  const barW = 10;
  const barX = covOx + d * cs + barGap;
  const svgW = barX + barW + 44;
  const svgH = covOy + d * cs + 24;

  const emptyCenter = { x: pad + (n * cs) / 2, y: pad + (n * cs) / 2 };

  const nTicks = useMemo(() => {
    if (n <= 10) return Array.from({ length: n }, (_, i) => i);
    const t: number[] = [0];
    const step = Math.max(1, Math.floor(n / 4));
    for (let i = step; i < n; i += step) t.push(i);
    if (t[t.length - 1] !== n - 1) t.push(n - 1);
    return t;
  }, [n]);

  const dTicks = useMemo(() => {
    if (d <= 10) return Array.from({ length: d }, (_, i) => i);
    const t: number[] = [0];
    const step = Math.max(1, Math.floor(d / 4));
    for (let i = step; i < d; i += step) t.push(i);
    if (t[t.length - 1] !== d - 1) t.push(d - 1);
    return t;
  }, [d]);

  const xGradStops = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      offset: `${(i / 6) * 100}%`,
      color: xColorFn(-scaleMaxX + (i / 6) * 2 * scaleMaxX),
    })), [xColorFn, scaleMaxX]);

  const covGradStops = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      offset: `${(i / 6) * 100}%`,
      color: covColorFn(-scaleMaxCov + (i / 6) * 2 * scaleMaxCov),
    })), [covColorFn, scaleMaxCov]);

  const presetMeta: { key: Preset; label: string }[] = [
    { key: "correlated", label: "Correlated" },
    { key: "decorrelated", label: "Decorrelated" },
    { key: "anti-corr", label: "Anti-corr" },
  ];

  const hoveredInfo = useMemo(() => {
    if (!hovered) return null;
    const val = computed.cov[hovered.i * d + hovered.j];
    return { ...hovered, val, isDiag: hovered.i === hovered.j };
  }, [hovered, computed.cov, d]);

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="Covariance matrix multiplication visualization"
    >
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span className="font-semibold uppercase tracking-wider">Batch (N)</span>
            <span className="ml-3 font-mono">{n}</span>
          </div>
          <input
            type="range" min={4} max={12} step={1} value={n}
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
            type="range" min={3} max={8} step={1} value={d}
            onChange={(e) => setD(parseInt(e.target.value))}
            className="w-36 accent-violet-500"
            aria-label="Feature dimensions"
          />
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {presetMeta.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              preset === key
                ? "border-violet-500 bg-violet-500/20 text-violet-300"
                : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* L-shaped matrix multiplication SVG */}
      <div
        className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[#1e1e2e] p-4"
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          role="img"
          aria-label="L-shaped matrix multiplication: xᵀ @ x / (N-1) = cov"
        >
          <defs>
            <linearGradient id="cmm-x-grad" x1="0" x2="0" y1="1" y2="0">
              {xGradStops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
            <linearGradient id="cmm-cov-grad" x1="0" x2="0" y1="1" y2="0">
              {covGradStops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>

          {/* ── Formula in empty top-left quadrant ── */}
          <text
            x={emptyCenter.x} y={emptyCenter.y - 14}
            fontSize="16" fontWeight="700" fill="#d4d4d8"
            textAnchor="middle" fontFamily="monospace"
          >
            xᵀ @ x
          </text>
          <line
            x1={emptyCenter.x - 32} y1={emptyCenter.y + 2}
            x2={emptyCenter.x + 32} y2={emptyCenter.y + 2}
            stroke="#71717a" strokeWidth="1.5"
          />
          <text
            x={emptyCenter.x} y={emptyCenter.y + 18}
            fontSize="13" fill="#a1a1aa"
            textAnchor="middle" fontFamily="monospace"
          >
            N − 1
          </text>

          {/* ── x matrix (N×D) — top right ── */}
          <text
            x={xOx + (d * cs) / 2} y={xOy - 24}
            fontSize="12" fontWeight="600" fill="#d4d4d8"
            textAnchor="middle"
          >
            x (centered)
          </text>
          {/* Column ticks */}
          {dTicks.map((ci) => (
            <text
              key={`xc${ci}`}
              x={xOx + ci * cs + cs / 2} y={xOy - 6}
              fontSize="10" fill="#a1a1aa" textAnchor="middle" fontFamily="monospace"
            >
              {ci}
            </text>
          ))}
          {/* Row ticks — right side */}
          {nTicks.map((ri) => (
            <text
              key={`xr${ri}`}
              x={xOx + d * cs + 6} y={xOy + ri * cs + cs / 2 + 3}
              fontSize="10" fill="#a1a1aa" textAnchor="start" fontFamily="monospace"
            >
              {ri}
            </text>
          ))}
          {/* Background */}
          <rect
            x={xOx - 0.5} y={xOy - 0.5}
            width={d * cs + 1} height={n * cs + 1}
            fill="none" stroke="rgba(255,255,255,0.08)" rx={2}
          />
          {/* Cells */}
          {Array.from({ length: n * d }, (_, idx) => {
            const ri = Math.floor(idx / d);
            const ci = idx % d;
            return (
              <rect
                key={`x${idx}`}
                x={xOx + ci * cs} y={xOy + ri * cs}
                width={cs} height={cs}
                fill={xColorFn(computed.xC[ri * d + ci])}
              />
            );
          })}
          {/* Column highlight on hover */}
          {hovered && (
            <rect
              x={xOx + hovered.j * cs - 1} y={xOy - 1}
              width={cs + 2} height={n * cs + 2}
              fill="none" stroke="#fbbf24" strokeWidth={2.5} rx={3}
              pointerEvents="none"
            />
          )}

          {/* ── xᵀ matrix (D×N) — bottom left ── */}
          <text
            x={14} y={xtOy + (d * cs) / 2}
            fontSize="12" fontWeight="600" fill="#d4d4d8"
            textAnchor="middle"
            transform={`rotate(-90, 14, ${xtOy + (d * cs) / 2})`}
          >
            xᵀ
          </text>
          {/* Row ticks — left side */}
          {dTicks.map((ri) => (
            <text
              key={`xtr${ri}`}
              x={xtOx - 6} y={xtOy + ri * cs + cs / 2 + 3}
              fontSize="10" fill="#a1a1aa" textAnchor="end" fontFamily="monospace"
            >
              {ri}
            </text>
          ))}
          {/* Column ticks — bottom */}
          {nTicks.map((ci) => (
            <text
              key={`xtc${ci}`}
              x={xtOx + ci * cs + cs / 2} y={xtOy + d * cs + 14}
              fontSize="10" fill="#a1a1aa" textAnchor="middle" fontFamily="monospace"
            >
              {ci}
            </text>
          ))}
          {/* Background */}
          <rect
            x={xtOx - 0.5} y={xtOy - 0.5}
            width={n * cs + 1} height={d * cs + 1}
            fill="none" stroke="rgba(255,255,255,0.08)" rx={2}
          />
          {/* Cells */}
          {Array.from({ length: d * n }, (_, idx) => {
            const ri = Math.floor(idx / n);
            const ci = idx % n;
            return (
              <rect
                key={`xt${idx}`}
                x={xtOx + ci * cs} y={xtOy + ri * cs}
                width={cs} height={cs}
                fill={xColorFn(computed.xT[ri * n + ci])}
              />
            );
          })}
          {/* Row highlight on hover */}
          {hovered && (
            <rect
              x={xtOx - 1} y={xtOy + hovered.i * cs - 1}
              width={n * cs + 2} height={cs + 2}
              fill="none" stroke="#fbbf24" strokeWidth={2.5} rx={3}
              pointerEvents="none"
            />
          )}

          {/* ── cov matrix (D×D) — bottom right ── */}
          <text
            x={covOx + (d * cs) / 2} y={covOy - 4}
            fontSize="11" fontWeight="600" fill="#a78bfa"
            textAnchor="middle"
          >
            cov
          </text>
          {/* Column ticks — bottom */}
          {dTicks.map((ci) => (
            <text
              key={`covc${ci}`}
              x={covOx + ci * cs + cs / 2} y={covOy + d * cs + 14}
              fontSize="10" fill="#a1a1aa" textAnchor="middle" fontFamily="monospace"
            >
              {ci}
            </text>
          ))}
          {/* Subtle background to distinguish result */}
          <rect
            x={covOx - 2} y={covOy - 2}
            width={d * cs + 4} height={d * cs + 4}
            fill="rgba(139, 92, 246, 0.04)" rx={4}
          />
          {/* Border */}
          <rect
            x={covOx - 0.5} y={covOy - 0.5}
            width={d * cs + 1} height={d * cs + 1}
            fill="none" stroke="rgba(255,255,255,0.15)" rx={2}
          />
          {/* Cells with hover */}
          {Array.from({ length: d * d }, (_, idx) => {
            const ri = Math.floor(idx / d);
            const ci = idx % d;
            const isDiag = ri === ci;
            const isHov = hovered?.i === ri && hovered?.j === ci;
            return (
              <rect
                key={`cov${idx}`}
                x={covOx + ci * cs} y={covOy + ri * cs}
                width={cs} height={cs}
                fill={covColorFn(computed.cov[ri * d + ci])}
                stroke={
                  isHov ? "#ffffff"
                  : isDiag ? "rgba(139,92,246,0.5)"
                  : "rgba(239,68,68,0.3)"
                }
                strokeWidth={isHov ? 2.5 : 1}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered({ i: ri, j: ci })}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {/* Values inside cov cells */}
          {cs >= 26 && Array.from({ length: d * d }, (_, idx) => {
            const ri = Math.floor(idx / d);
            const ci = idx % d;
            return (
              <text
                key={`covt${idx}`}
                x={covOx + ci * cs + cs / 2}
                y={covOy + ri * cs + cs / 2 + 3}
                fontSize={cs >= 30 ? 9 : 8}
                fontFamily="monospace"
                fill="rgba(255,255,255,0.7)"
                textAnchor="middle"
                pointerEvents="none"
              >
                {computed.cov[ri * d + ci].toFixed(1)}
              </text>
            );
          })}

          {/* ── Connecting dashed lines on hover ── */}
          {hovered && (
            <>
              {/* xᵀ row → cov row (horizontal) */}
              <line
                x1={xtOx + n * cs} y1={xtOy + hovered.i * cs + cs / 2}
                x2={covOx} y2={covOy + hovered.i * cs + cs / 2}
                stroke="#fbbf24" strokeWidth={1.5}
                strokeDasharray="4,3" opacity={0.6}
                pointerEvents="none"
              />
              {/* x col → cov col (vertical) */}
              <line
                x1={xOx + hovered.j * cs + cs / 2} y1={xOy + n * cs}
                x2={covOx + hovered.j * cs + cs / 2} y2={covOy}
                stroke="#fbbf24" strokeWidth={1.5}
                strokeDasharray="4,3" opacity={0.6}
                pointerEvents="none"
              />
            </>
          )}

          {/* ── Color bar for x/xᵀ ── */}
          <rect
            x={barX} y={xOy}
            width={barW} height={n * cs}
            rx={4} fill="url(#cmm-x-grad)"
          />
          <text
            x={barX + barW + 4} y={xOy + 4}
            fontSize="10" fill="#a1a1aa" fontFamily="monospace"
            dominantBaseline="hanging"
          >
            {scaleMaxX.toFixed(1)}
          </text>
          <text
            x={barX + barW + 4} y={xOy + n * cs}
            fontSize="10" fill="#a1a1aa" fontFamily="monospace"
          >
            {(-scaleMaxX).toFixed(1)}
          </text>

          {/* ── Color bar for cov ── */}
          <rect
            x={barX} y={covOy}
            width={barW} height={d * cs}
            rx={4} fill="url(#cmm-cov-grad)"
          />
          <text
            x={barX + barW + 4} y={covOy + 4}
            fontSize="10" fill="#a1a1aa" fontFamily="monospace"
            dominantBaseline="hanging"
          >
            {scaleMaxCov.toFixed(1)}
          </text>
          <text
            x={barX + barW + 4} y={covOy + d * cs}
            fontSize="10" fill="#a1a1aa" fontFamily="monospace"
          >
            {(-scaleMaxCov).toFixed(1)}
          </text>
        </svg>
      </div>

      {/* Hover info */}
      <div className="mt-3 min-h-[1.5rem] text-sm text-[var(--color-muted-foreground)]">
        {hoveredInfo ? (
          hoveredInfo.isDiag ? (
            <>
              <span className="font-mono font-semibold text-violet-400">
                cov[{hoveredInfo.i},{hoveredInfo.j}]
              </span>{" "}
              = var(dim {hoveredInfo.i}) ={" "}
              <span className="font-mono font-semibold text-violet-400">
                {hoveredInfo.val.toFixed(3)}
              </span>{" "}
              — <span className="text-violet-400">diagonal, kept</span>
            </>
          ) : (
            <>
              <span className="font-mono font-semibold text-amber-400">
                cov[{hoveredInfo.i},{hoveredInfo.j}]
              </span>{" "}
              = cov(dim {hoveredInfo.i}, dim {hoveredInfo.j}) ={" "}
              <span className="font-mono font-semibold text-red-400">
                {hoveredInfo.val.toFixed(3)}
              </span>{" "}
              — <span className="text-red-400">off-diagonal, penalized</span>{" "}
              ({hoveredInfo.val.toFixed(3)}² = {(hoveredInfo.val ** 2).toFixed(4)})
            </>
          )
        ) : (
          <>
            Hover any cell in{" "}
            <span className="font-semibold text-[var(--color-foreground)]">cov</span>{" "}
            to see which vectors were dot-producted
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-muted-foreground)]">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.5)" }}
        />
        diagonal (kept)
        <span
          className="ml-2 inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)" }}
        />
        off-diagonal (penalized)
        <span
          className="ml-2 inline-block h-2.5 w-2.5 rounded-sm"
          style={{ border: "2px solid #fbbf24" }}
        />
        hover highlight
      </div>

      {/* Loss readout */}
      <div className="mt-2 flex items-baseline gap-2 font-mono text-sm">
        <span className="font-semibold text-[var(--color-foreground)]">CovarianceLoss</span>
        <span className="text-[var(--color-muted-foreground)]">=</span>
        <span className="text-[var(--color-muted-foreground)]">off_diag(cov).pow(2).mean()</span>
        <span className="text-[var(--color-muted-foreground)]">=</span>
        <span className={`text-lg font-bold ${computed.loss > 0.05 ? "text-red-400" : "text-emerald-400"}`}>
          {computed.loss.toFixed(4)}
        </span>
      </div>
    </figure>
  );
}
