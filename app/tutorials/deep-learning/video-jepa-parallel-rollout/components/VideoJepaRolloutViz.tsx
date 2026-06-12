"use client";

import { type ReactNode, useState } from "react";

/* ------------------------------------------------------------------ *
 * Video JEPA — parallel-mode n-step rollout
 *
 * Faithful to eb_jepa/jepa.py `unroll(unroll_mode="parallel")` with a
 * StateOnlyPredictor (context_length = 2):
 *
 *   predicted = state                         # T frames
 *   for _ in range(nsteps):                   # nsteps = T - 2
 *       predicted = predictor(predicted)[:, :, :-1]   # T-1 -> drop last -> T-2
 *       predicted = cat(state[:, :, :2], predicted)   # prepend 2 GT -> back to T
 *
 * StateOnlyPredictor forms (prev, next) pairs:  T frames -> T-1 pairs (C=2)
 * -> predict T-1 frames -> drop last -> T-2 predictions.
 *
 * The prediction-depth of frame t after `step` passes is min(step, t-1),
 * 0 for the two ground-truth context frames. It saturates at T-2, which is
 * why "moving forward is useless" past step T-2.
 *
 * Same whiteboard / marker aesthetic as the Conv3d tutorial.
 * ------------------------------------------------------------------ */

/* ---- palette ---- */
const PAPER = "#fbfaf6";
const INK = "#2b2b2b";
const GRID = "#dad6cb";
const MUTE = "#9a958a";
const GT = "#ece6c6"; // ground-truth context frame (beige) — no loss
const RED = "#e8867a"; // prev frame (pair channel 0)
const BLUE = "#8aa2e8"; // next frame (pair channel 1)
const FONT = `ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Quicksand", system-ui, sans-serif`;

const CONTEXT = 2; // context_length — GT frames re-fed on the left every step

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/* prediction-depth of frame t after `step` parallel passes.
 * step 0 = all ground truth. Light-cone: min(step, t-1), saturating at T-2. */
function depthAt(t: number, step: number): number {
  if (t < CONTEXT) return 0;
  return Math.max(0, Math.min(step, t - 1));
}

/* colour a frame from its prediction depth (0 = GT, deeper = paler purple) */
function frameColor(depth: number, maxDepth: number): string {
  if (depth <= 0) return GT;
  const span = Math.max(1, maxDepth - 1);
  const l = 60 + ((depth - 1) / span) * 28; // 60% (solid) -> 88% (faded)
  return `hsl(258 62% ${l}%)`;
}

/* ---- one oblique stack of frames (time recedes up-and-right) ---- */
const CELL = 24;
const DDX = 16;
const DDY = 16;

function FrameStack({
  depths,
  maxDepth,
  cell = CELL,
  ddx = DDX,
  ddy = DDY,
  showT = true,
  ariaLabel,
}: {
  depths: number[]; // depth per time index t
  maxDepth: number;
  cell?: number;
  ddx?: number;
  ddy?: number;
  showT?: boolean;
  ariaLabel: string;
}) {
  const T = depths.length;
  const pad = 8;
  const W = cell + (T - 1) * ddx + pad * 2;
  const H = cell + (T - 1) * ddy + pad * 2;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      style={{ overflow: "visible", display: "block" }}
    >
      {/* t = 0 at back, increasing t toward front (down-right), front on top */}
      {range(T).map((t) => {
        const x = pad + t * ddx;
        const y = pad + (T - 1 - t) * ddy;
        const d = depths[t];
        return (
          <g key={t}>
            <rect
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx={4}
              fill={frameColor(d, maxDepth)}
              stroke={INK}
              strokeWidth={1.4}
            />
            {showT && (
              <text
                x={x + cell / 2}
                y={y + cell / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cell * 0.34}
                fontFamily={FONT}
                fontWeight={700}
                fill={d === 0 ? INK : "rgba(43,43,43,0.78)"}
              >
                {t}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* a single (prev,next) pair: two channel-stacked cards (red over blue) */
function PairCard({ cell = 20 }: { cell?: number }) {
  const off = 5;
  const pad = 4;
  const W = cell + off + pad * 2;
  const H = cell + off + pad * 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <rect x={pad + off} y={pad} width={cell} height={cell} rx={3} fill={BLUE} stroke={INK} strokeWidth={1.2} />
      <rect x={pad} y={pad + off} width={cell} height={cell} rx={3} fill={RED} stroke={INK} strokeWidth={1.2} />
    </svg>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0 2px" }}>
      {label && <span style={{ fontSize: 10.5, color: MUTE, fontFamily: FONT, whiteSpace: "nowrap" }}>{label}</span>}
      <svg width={30} height={12} viewBox="0 0 30 12" aria-hidden>
        <line x1={1} y1={6} x2={24} y2={6} stroke={INK} strokeWidth={1.5} />
        <path d="M24 2 L29 6 L24 10 Z" fill={INK} />
      </svg>
    </div>
  );
}

function Shape({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: MUTE, fontFamily: FONT, marginTop: 4, textAlign: "center", whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

function MiniLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: INK, fontFamily: FONT, fontWeight: 600, marginBottom: 5, textAlign: "center" }}>
      {children}
    </div>
  );
}

/* ---- expanded StateOnlyPredictor internals for one step ---- */
function PredictorPipeline({ T }: { T: number }) {
  const nPairs = T - 1;
  const flatCells = range(Math.min(nPairs, 6)); // cap drawn pair-cards for width
  const truncated = nPairs > flatCells.length;
  return (
    <div
      style={{
        marginTop: 10,
        padding: "14px 16px",
        border: `1px dashed ${GRID}`,
        borderRadius: 14,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
        rowGap: 14,
      }}
    >
      {/* states in */}
      <div>
        <MiniLabel>States</MiniLabel>
        <FrameStack
          depths={range(T).map(() => 0)}
          maxDepth={1}
          cell={18}
          ddx={12}
          ddy={12}
          showT={false}
          ariaLabel="predictor input states"
        />
        <Shape>[B, C, T={T}, H, W]</Shape>
      </div>

      <Arrow label="form pairs" />

      {/* prev/next pairs, channel-stacked */}
      <div>
        <MiniLabel>
          <span style={{ color: RED }}>prev</span> / <span style={{ color: BLUE }}>next</span>
        </MiniLabel>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {flatCells.map((i) => (
            <PairCard key={i} />
          ))}
          {truncated && <span style={{ color: MUTE, fontFamily: FONT, fontSize: 14, paddingBottom: 6 }}>…</span>}
        </div>
        <Shape>[B, C=2, T−1={nPairs}, H, W]</Shape>
      </div>

      <Arrow label="rearrange" />

      {/* flattened batch N = T-1 */}
      <div>
        <MiniLabel>N = T−1 = {nPairs}</MiniLabel>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {flatCells.map((i) => (
            <PairCard key={i} />
          ))}
          {truncated && <span style={{ color: MUTE, fontFamily: FONT, fontSize: 14, paddingBottom: 6 }}>…</span>}
        </div>
        <Shape>[(B·{nPairs}), C=2, H, W]</Shape>
      </div>

      <Arrow label="prediction net" />

      {/* per-pair single-channel prediction */}
      <div>
        <MiniLabel>predicted</MiniLabel>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {flatCells.map((i) => (
            <svg key={i} width={24} height={24} style={{ display: "block" }}>
              <rect x={1.5} y={1.5} width={20} height={20} rx={3} fill={frameColor(1, 2)} stroke={INK} strokeWidth={1.2} />
            </svg>
          ))}
          {truncated && <span style={{ color: MUTE, fontFamily: FONT, fontSize: 14, paddingBottom: 4 }}>…</span>}
        </div>
        <Shape>[(B·{nPairs}), C=1, H, W]</Shape>
      </div>

      <Arrow label="rearrange · drop last · +2 GT" />

      {/* predicted_states out */}
      <div>
        <MiniLabel>Predicted_states</MiniLabel>
        <FrameStack
          depths={range(T).map((t) => depthAt(t, 1))}
          maxDepth={Math.max(1, T - 2)}
          cell={18}
          ddx={12}
          ddy={12}
          showT={false}
          ariaLabel="predictor output predicted states"
        />
        <Shape>[B, C=1, T={T}, H, W]</Shape>
      </div>
    </div>
  );
}

/* ---- compact prediction-loss readout ---- */
function PlossReadout({ active }: { active: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: FONT,
        fontSize: 12.5,
        color: active ? INK : MUTE,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: MUTE }}>
        (States, Pred) <span style={{ fontStyle: "italic" }}>·</span> Projector
      </span>
      <svg width={26} height={10} viewBox="0 0 26 10" aria-hidden>
        <line x1={1} y1={5} x2={20} y2={5} stroke={active ? INK : GRID} strokeWidth={1.4} />
        <path d="M20 1.5 L25 5 L20 8.5 Z" fill={active ? INK : GRID} />
      </svg>
      {active ? (
        <span style={{ color: "#c0392b", fontWeight: 700 }}>+ ploss</span>
      ) : (
        <span style={{ color: MUTE, fontWeight: 700 }}>0</span>
      )}
    </div>
  );
}

/* ---- one rollout step (row) ---- */
function RolloutRow({
  step,
  T,
  expanded,
  onToggle,
}: {
  step: number; // 1-based parallel pass
  T: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const maxDepth = Math.max(1, T - 2);
  const inDepths = range(T).map((t) => depthAt(t, step - 1));
  const outDepths = range(T).map((t) => depthAt(t, step));

  return (
    <div
      style={{
        borderTop: `1px solid ${GRID}`,
        padding: "18px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          rowGap: 12,
        }}
      >
        {/* step badge */}
        <div
          style={{
            minWidth: 58,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 14,
            color: INK,
          }}
        >
          <div>n = {step}</div>
          <div style={{ fontSize: 11, color: MUTE, fontWeight: 500 }}>of {T - CONTEXT}</div>
        </div>

        {/* input states */}
        <div>
          <MiniLabel>States</MiniLabel>
          <FrameStack depths={inDepths} maxDepth={maxDepth} ariaLabel={`step ${step} input states`} />
        </div>

        {/* predictor box (click to expand) */}
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`StateOnlyPredictor, step ${step} — ${expanded ? "collapse" : "expand"} internals`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "14px 14px",
            borderRadius: 12,
            border: `1.6px solid ${INK}`,
            background: expanded ? INK : "#fff",
            color: expanded ? "#fff" : INK,
            cursor: "pointer",
            fontFamily: FONT,
            transition: "all 120ms ease",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>StateOnlyPredictor</span>
          <span style={{ fontSize: 10.5, opacity: 0.7 }}>{expanded ? "▾ hide internals" : "▸ show internals"}</span>
        </button>

        {/* output predicted states */}
        <div>
          <MiniLabel>Predicted_states</MiniLabel>
          <FrameStack depths={outDepths} maxDepth={maxDepth} ariaLabel={`step ${step} predicted states`} />
        </div>

        {/* loss */}
        <div style={{ marginLeft: "auto" }}>
          <PlossReadout active />
        </div>
      </div>

      {expanded && <PredictorPipeline T={T} />}
    </div>
  );
}

/* ---- terminal degenerate step (light-cone saturated) ---- */
function TerminalRow({ T }: { T: number }) {
  const maxDepth = Math.max(1, T - 2);
  const depths = range(T).map((t) => depthAt(t, T - 1)); // == depthAt(.., T-2)
  return (
    <div style={{ borderTop: `1px dashed ${GRID}`, padding: "18px 4px", opacity: 0.7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", rowGap: 12 }}>
        <div style={{ minWidth: 58, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: MUTE }}>
          <div>n = {T - 1}</div>
          <div style={{ fontSize: 11, color: MUTE, fontWeight: 500 }}>(stop)</div>
        </div>
        <div>
          <MiniLabel>
            <span style={{ color: MUTE }}>States</span>
          </MiniLabel>
          <FrameStack depths={depths} maxDepth={maxDepth} ariaLabel="saturated states" />
        </div>
        <div
          style={{
            maxWidth: 320,
            fontFamily: FONT,
            fontSize: 12.5,
            color: "#c0392b",
            lineHeight: 1.45,
          }}
        >
          Since we only have <strong>{T} frames</strong>, moving forward is useless — the light-cone has
          saturated (every frame already reaches depth&nbsp;{T - 2}), so this pass reproduces the same
          prediction.
        </div>
        <div style={{ marginLeft: "auto" }}>
          <PlossReadout active={false} />
        </div>
      </div>
    </div>
  );
}

/* ---- depth legend ---- */
function Legend({ T }: { T: number }) {
  const maxDepth = Math.max(1, T - 2);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        fontFamily: FONT,
        fontSize: 11.5,
        color: MUTE,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 15, height: 15, borderRadius: 3, background: GT, border: `1px solid ${INK}` }} />
        GT context (no loss)
      </span>
      <span style={{ color: GRID }}>•</span>
      <span>prediction depth:</span>
      {range(maxDepth).map((i) => {
        const d = i + 1;
        return (
          <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: 3,
                background: frameColor(d, maxDepth),
                border: `1px solid ${INK}`,
              }}
            />
            {d}
          </span>
        );
      })}
      <span style={{ color: MUTE }}>(deeper = pred-of-pred, fades out)</span>
    </div>
  );
}

export default function VideoJepaRolloutViz() {
  const [T, setT] = useState(4);
  const [expanded, setExpanded] = useState<number | null>(null); // which step's internals are open

  const nsteps = T - CONTEXT;
  const frameOptions = [4, 5, 6, 7, 8, 9, 10];

  return (
    <div
      role="group"
      aria-label="Interactive Video JEPA parallel-mode rollout"
      style={{
        fontFamily: FONT,
        background: PAPER,
        color: INK,
        borderRadius: 20,
        padding: "22px 22px",
        border: `1px solid ${GRID}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* controls */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 0.4, color: MUTE, marginBottom: 6 }}>T &nbsp;(frames)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {frameOptions.map((n) => {
              const on = T === n;
              return (
                <button
                  key={n}
                  onClick={() => {
                    setT(n);
                    setExpanded(null);
                  }}
                  aria-pressed={on}
                  aria-label={`T = ${n} frames`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    cursor: "pointer",
                    border: `1.5px solid ${on ? INK : GRID}`,
                    background: on ? INK : "#fff",
                    color: on ? "#fff" : INK,
                    fontFamily: FONT,
                    fontSize: 15,
                    fontWeight: 700,
                    transition: "all 120ms ease",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 18,
            fontSize: 13,
            fontFamily: FONT,
            color: INK,
          }}
        >
          <span>
            context_length = <strong>{CONTEXT}</strong>
          </span>
          <span>
            nsteps = T − 2 = <strong>{nsteps}</strong>
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Legend T={T} />
      </div>

      {/* rollout */}
      <div>
        {range(nsteps).map((i) => {
          const step = i + 1;
          return (
            <RolloutRow
              key={`${T}-${step}`}
              step={step}
              T={T}
              expanded={expanded === step}
              onToggle={() => setExpanded((e) => (e === step ? null : step))}
            />
          );
        })}
        <TerminalRow T={T} />
      </div>
    </div>
  );
}
