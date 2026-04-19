"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Point {
  x: number;
  y: number;
}

interface EmbeddingPair {
  /** Embedding from view 1 */
  z1: Point;
  /** Embedding from view 2 */
  z2: Point;
  /** Original "base" position (for identity) */
  base: Point;
  /** Color for this sample */
  color: string;
}

type LossTerms = {
  variance: boolean;
  invariance: boolean;
  covariance: boolean;
};

/* ------------------------------------------------------------------ */
/*  Seeded random (deterministic initial layout)                       */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Physics simulation                                                 */
/* ------------------------------------------------------------------ */

const N_SAMPLES = 16;
const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#ef4444", "#22c55e", "#eab308", "#3b82f6",
  "#d946ef",
];

function createInitialPairs(rng: () => number): EmbeddingPair[] {
  const pairs: EmbeddingPair[] = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    const bx = (rng() - 0.5) * 4;
    const by = (rng() - 0.5) * 4;
    pairs.push({
      base: { x: bx, y: by },
      z1: { x: bx + (rng() - 0.5) * 1.2, y: by + (rng() - 0.5) * 1.2 },
      z2: { x: bx + (rng() - 0.5) * 1.2, y: by + (rng() - 0.5) * 1.2 },
      color: COLORS[i % COLORS.length],
    });
  }
  return pairs;
}

/** Compute collapsed states for each configuration */
function computeTargets(
  pairs: EmbeddingPair[],
  terms: LossTerms,
  rng: () => number
): EmbeddingPair[] {
  const allOff = !terms.variance && !terms.invariance && !terms.covariance;

  if (allOff) {
    // Total collapse: everything to origin
    return pairs.map((p) => ({
      ...p,
      z1: { x: 0, y: 0 },
      z2: { x: 0, y: 0 },
    }));
  }

  if (terms.variance && terms.invariance && terms.covariance) {
    // All three: well-spread, paired, decorrelated — ideal embedding
    // Spread points on a nice grid-like pattern with small pair offsets
    const n = pairs.length;
    const result = pairs.map((p, i) => {
      const angle = (i / n) * Math.PI * 2;
      const radius = 1.5 + (i % 3) * 0.6;
      const bx = Math.cos(angle) * radius;
      const by = Math.sin(angle) * radius;
      const jitter = 0.08;
      return {
        ...p,
        z1: { x: bx + (rng() - 0.5) * jitter, y: by + (rng() - 0.5) * jitter },
        z2: { x: bx + (rng() - 0.5) * jitter, y: by + (rng() - 0.5) * jitter },
      };
    });
    return result;
  }

  if (terms.invariance && !terms.variance && !terms.covariance) {
    // Only invariance: pairs collapse to same point, but all points collapse together
    return pairs.map(() => {
      const cx = (rng() - 0.5) * 0.3;
      const cy = (rng() - 0.5) * 0.3;
      return {
        ...pairs[0],
        z1: { x: cx, y: cy },
        z2: { x: cx, y: cy },
      };
    }).map((p, i) => ({ ...p, color: pairs[i].color, base: pairs[i].base }));
  }

  if (terms.variance && !terms.invariance && !terms.covariance) {
    // Only variance: spread out but pairs are far apart, and axes are correlated
    return pairs.map((p, i) => {
      const angle = (i / pairs.length) * Math.PI * 2;
      const r1 = 1.8;
      const r2 = 1.8;
      const offset = Math.PI * 0.4; // views are spread far from each other
      return {
        ...p,
        z1: { x: Math.cos(angle) * r1, y: Math.sin(angle) * r1 },
        z2: { x: Math.cos(angle + offset) * r2, y: Math.sin(angle + offset) * r2 },
      };
    });
  }

  if (terms.covariance && !terms.invariance && !terms.variance) {
    // Only covariance: decorrelated axes but could still collapse in magnitude
    // Points cluster near origin but with decorrelated x,y
    return pairs.map((p) => {
      const x1 = (rng() - 0.5) * 1.0;
      const y1 = (rng() - 0.5) * 1.0;
      return {
        ...p,
        z1: { x: x1, y: y1 },
        z2: { x: (rng() - 0.5) * 1.0, y: (rng() - 0.5) * 1.0 },
      };
    });
  }

  if (terms.variance && terms.invariance && !terms.covariance) {
    // Variance + Invariance: pairs together, spread, but correlated — points along a diagonal
    return pairs.map((p, i) => {
      const t = ((i / pairs.length) * 2 - 1) * 2.5;
      const jitter = 0.06;
      // Strong diagonal correlation: y ≈ x
      return {
        ...p,
        z1: { x: t + (rng() - 0.5) * jitter, y: t * 0.9 + (rng() - 0.5) * jitter },
        z2: { x: t + (rng() - 0.5) * jitter, y: t * 0.9 + (rng() - 0.5) * jitter },
      };
    });
  }

  if (terms.variance && !terms.invariance && terms.covariance) {
    // Variance + Covariance: spread and decorrelated, but pairs are far apart
    return pairs.map((p, i) => {
      const angle = (i / pairs.length) * Math.PI * 2;
      const r = 2.0;
      const offset = Math.PI * 0.5;
      return {
        ...p,
        z1: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
        z2: { x: Math.cos(angle + offset) * r, y: Math.sin(angle + offset) * r },
      };
    });
  }

  if (!terms.variance && terms.invariance && terms.covariance) {
    // Invariance + Covariance: pairs together, decorrelated, but low variance — tight cluster
    return pairs.map((p) => {
      const x = (rng() - 0.5) * 0.8;
      const y = (rng() - 0.5) * 0.8;
      return {
        ...p,
        z1: { x, y },
        z2: { x: x + (rng() - 0.5) * 0.06, y: y + (rng() - 0.5) * 0.06 },
      };
    });
  }

  // Fallback (shouldn't reach)
  return pairs;
}

/* ------------------------------------------------------------------ */
/*  Stats helpers                                                      */
/* ------------------------------------------------------------------ */

function computeStats(pairs: EmbeddingPair[]) {
  const allZ1 = pairs.map((p) => p.z1);
  const allZ2 = pairs.map((p) => p.z2);
  const all = [...allZ1, ...allZ2];

  // Variance per dimension
  const meanX = d3.mean(all, (d) => d.x) ?? 0;
  const meanY = d3.mean(all, (d) => d.y) ?? 0;
  const varX = d3.mean(all, (d) => (d.x - meanX) ** 2) ?? 0;
  const varY = d3.mean(all, (d) => (d.y - meanY) ** 2) ?? 0;

  // Invariance: mean squared distance between paired views
  const invariance =
    d3.mean(pairs, (p) => (p.z1.x - p.z2.x) ** 2 + (p.z1.y - p.z2.y) ** 2) ?? 0;

  // Covariance between dimensions
  const covXY = d3.mean(all, (d) => (d.x - meanX) * (d.y - meanY)) ?? 0;

  return { varX, varY, invariance, covXY };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TermToggle({
  label,
  symbol,
  active,
  onToggle,
  color,
  description,
}: {
  label: string;
  symbol: string;
  active: boolean;
  onToggle: () => void;
  color: string;
  description: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Toggle ${label} term`}
      aria-pressed={active}
      className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? `border-${color}-400/50 bg-${color}-500/10`
          : "border-[var(--color-border)] bg-[var(--color-background)] opacity-50"
      }`}
      style={active ? { borderColor: `var(--tw-${color})`, backgroundColor: `color-mix(in srgb, var(--tw-${color}) 10%, transparent)` } : {}}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white transition-colors`}
          style={{ backgroundColor: active ? `var(--color-${color}, ${color === "violet" ? "#8b5cf6" : color === "emerald" ? "#10b981" : "#f59e0b"})` : "#555" }}
        >
          {symbol}
        </div>
        <span className="text-sm font-semibold text-[var(--color-foreground)]">{label}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            active ? "bg-green-500/20 text-green-400" : "bg-neutral-500/20 text-neutral-500"
          }`}
        >
          {active ? "ON" : "OFF"}
        </span>
      </div>
      <span className="text-xs text-[var(--color-muted-foreground)]">{description}</span>
    </button>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(Math.abs(value) / max, 1) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-right text-xs text-[var(--color-muted-foreground)]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs text-[var(--color-muted-foreground)]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function VICRegExplorer() {
  const rngRef = useRef(mulberry32(42));
  const targetRngRef = useRef(mulberry32(123));

  const initialPairs = useMemo(() => createInitialPairs(rngRef.current), []);

  const [terms, setTerms] = useState<LossTerms>({
    variance: true,
    invariance: true,
    covariance: true,
  });

  const [pairs, setPairs] = useState<EmbeddingPair[]>(initialPairs);

  // Animate to target whenever terms change
  useEffect(() => {
    targetRngRef.current = mulberry32(123); // reset for deterministic targets
    const targets = computeTargets(initialPairs, terms, targetRngRef.current);
    setPairs(targets);
  }, [terms, initialPairs]);

  const toggleTerm = useCallback((term: keyof LossTerms) => {
    setTerms((prev) => ({ ...prev, [term]: !prev[term] }));
  }, []);

  const stats = computeStats(pairs);

  // SVG dimensions
  const width = 500;
  const height = 500;
  const margin = 40;

  const xScale = d3
    .scaleLinear()
    .domain([-3.5, 3.5])
    .range([margin, width - margin]);
  const yScale = d3
    .scaleLinear()
    .domain([-3.5, 3.5])
    .range([height - margin, margin]);

  const gridLines = [-3, -2, -1, 0, 1, 2, 3];

  return (
    <figure className="my-8" role="figure" aria-label="VICReg interactive embedding explorer">
      {/* Term toggles */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TermToggle
          label="Variance"
          symbol="V"
          active={terms.variance}
          onToggle={() => toggleTerm("variance")}
          color="violet"
          description="Force each dimension to have high variance — prevents all points from collapsing to one spot."
        />
        <TermToggle
          label="Invariance"
          symbol="I"
          active={terms.invariance}
          onToggle={() => toggleTerm("invariance")}
          color="emerald"
          description="Pull together embeddings of two views of the same image — the representation should be view-invariant."
        />
        <TermToggle
          label="Covariance"
          symbol="C"
          active={terms.covariance}
          onToggle={() => toggleTerm("covariance")}
          color="amber"
          description="Decorrelate embedding dimensions — each axis should capture independent information."
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Scatter plot */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label="2D embedding scatter plot showing paired representations"
          >
            {/* Grid */}
            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={xScale(v)}
                  y1={yScale(-3.5)}
                  x2={xScale(v)}
                  y2={yScale(3.5)}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.2}
                />
                <line
                  x1={xScale(-3.5)}
                  y1={yScale(v)}
                  x2={xScale(3.5)}
                  y2={yScale(v)}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.2}
                />
              </g>
            ))}

            {/* Axis labels */}
            <text x={width - margin + 5} y={yScale(0) + 4} fontSize="11" fill="var(--color-muted-foreground)">
              dim 1
            </text>
            <text x={xScale(0) + 5} y={margin - 10} fontSize="11" fill="var(--color-muted-foreground)">
              dim 2
            </text>

            {/* Connecting lines between paired views */}
            {pairs.map((p, i) => (
              <motion.line
                key={`line-${i}`}
                animate={{
                  x1: xScale(p.z1.x),
                  y1: yScale(p.z1.y),
                  x2: xScale(p.z2.x),
                  y2: yScale(p.z2.y),
                }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                stroke={p.color}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.35}
              />
            ))}

            {/* View 1 points (circles) */}
            {pairs.map((p, i) => (
              <motion.circle
                key={`z1-${i}`}
                animate={{ cx: xScale(p.z1.x), cy: yScale(p.z1.y) }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                r={7}
                fill={p.color}
                stroke="white"
                strokeWidth={1.5}
                opacity={0.9}
              />
            ))}

            {/* View 2 points (diamonds) */}
            {pairs.map((p, i) => {
              const size = 6;
              return (
                <motion.g
                  key={`z2-${i}`}
                  animate={{ x: xScale(p.z2.x), y: yScale(p.z2.y) }}
                  transition={{ type: "spring", stiffness: 50, damping: 15 }}
                >
                  <polygon
                    points={`0,${-size} ${size},0 0,${size} ${-size},0`}
                    fill={p.color}
                    stroke="white"
                    strokeWidth={1.5}
                    opacity={0.9}
                  />
                </motion.g>
              );
            })}

            {/* Legend */}
            <g transform={`translate(${margin + 8}, ${margin + 8})`}>
              <rect x={-6} y={-6} width={120} height={52} rx={8} fill="var(--color-background)" fillOpacity={0.85} stroke="var(--color-border)" strokeWidth={0.5} />
              <circle cx={8} cy={10} r={5} fill="#888" stroke="white" strokeWidth={1} />
              <text x={20} y={14} fontSize="11" fill="var(--color-muted-foreground)">
                View 1
              </text>
              <polygon points="8,26 13,32 8,38 3,32" fill="#888" stroke="white" strokeWidth={1} />
              <text x={20} y={36} fontSize="11" fill="var(--color-muted-foreground)">
                View 2
              </text>
            </g>
          </svg>
        </div>

        {/* Stats panel */}
        <div className="flex w-full flex-col gap-4 lg:w-64">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Live statistics
            </h3>
            <div className="flex flex-col gap-3">
              <StatBar label="Var(dim 1)" value={stats.varX} max={5} color="#8b5cf6" />
              <StatBar label="Var(dim 2)" value={stats.varY} max={5} color="#8b5cf6" />
              <div className="my-1 h-px bg-[var(--color-border)]" />
              <StatBar label="Invariance" value={stats.invariance} max={4} color="#10b981" />
              <div className="my-1 h-px bg-[var(--color-border)]" />
              <StatBar label="|Cov(1,2)|" value={Math.abs(stats.covXY)} max={3} color="#f59e0b" />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              What to look for
            </h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={JSON.stringify(terms)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-sm leading-relaxed text-[var(--color-foreground)]"
              >
                {getInsight(terms)}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Contextual insights                                                */
/* ------------------------------------------------------------------ */

function getInsight(terms: LossTerms): string {
  const { variance: v, invariance: i, covariance: c } = terms;

  if (!v && !i && !c)
    return "With no loss terms active, the encoder has no incentive to produce useful representations. Everything collapses to a single constant — the trivial solution.";

  if (v && i && c)
    return "All three terms cooperate: pairs stay close (invariance), the cloud is wide (variance), and the axes are independent (covariance). This is the ideal embedding.";

  if (i && !v && !c)
    return "Invariance alone pulls paired views together — but without variance or covariance, all points collapse to the same spot. This is the classic representation collapse.";

  if (v && !i && !c)
    return "Variance spreads points out, preventing collapse. But without invariance, the two views of the same image can end up far apart — the representation doesn't capture identity.";

  if (c && !i && !v)
    return "Covariance decorrelates the axes, but nothing prevents the points from clustering near zero or losing view consistency. Decorrelation alone isn't enough.";

  if (v && i && !c)
    return "Variance + invariance: pairs are close and spread is high, but notice the diagonal pattern? Both dimensions encode the same information. Covariance would fix this.";

  if (v && !i && c)
    return "Variance + covariance: the cloud is wide and axes are independent — great feature diversity. But paired views are scattered apart. Invariance is what ties them together.";

  if (!v && i && c)
    return "Invariance + covariance: pairs are close and axes are decorrelated, but the whole cluster is tiny. Without the variance term, the representation under-uses the embedding space.";

  return "";
}
