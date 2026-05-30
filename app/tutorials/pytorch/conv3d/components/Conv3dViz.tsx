"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ *
 * Conv3d — interactive scanning visualization
 * A fresh "whiteboard / marker" look, intentionally unlike the rest of
 * the platform: warm paper background, ink outlines, rounded frames,
 * pastel receptive-field highlights.
 * ------------------------------------------------------------------ */

/* ---- fixed geometry ---- */
const IN_CELL = 26;
const K_CELL = 24;
const OUT_CELL = 34;
const DDX = 18; // depth (time) offset, x — frames recede up-and-right
const DDY = 18; // depth (time) offset, y

const IN_R = 4; // input H
const IN_C = 4; // input W
const KH = 2; // kernel height
const KW = 2; // kernel width
const OUT_R = IN_R - KH + 1; // 3
const OUT_C = IN_C - KW + 1; // 3

/* per-(channel, depth-slice) pastel pair, echoing the reference sketch */
const CH_COLORS: [string, string][] = [
  ["#f6b3b3", "#ece6c6"], // channel 0 — pink / beige
  ["#f5c184", "#dcb4ef"], // channel 1 — orange / lilac
  ["#a8d2ff", "#bde9cf"], // channel 2 — blue / mint
];

/* ---- palette ---- */
const PAPER = "#fbfaf6";
const INK = "#2b2b2b";
const GRID = "#dad6cb";
const MUTE = "#9a958a";
const FONT = `ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Quicksand", system-ui, sans-serif`;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/* tiny deterministic PRNG so "reroll" gives reproducible fresh data */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type CellFn = (d: number, r: number, c: number) => string | null;
type FlagFn = (d: number, r: number, c: number) => boolean;

/* ---- one oblique stack of frames (a volume) ---- */
function Volume({
  frames,
  rows,
  cols,
  cell,
  fillAt,
  textAt,
  currentAt,
  ariaLabel,
}: {
  frames: number;
  rows: number;
  cols: number;
  cell: number;
  fillAt: CellFn;
  textAt?: CellFn;
  currentAt?: FlagFn;
  ariaLabel: string;
}) {
  const pad = 10;
  const frameW = cols * cell;
  const frameH = rows * cell;
  const topPad = (frames - 1) * DDY;
  const rightPad = (frames - 1) * DDX;
  const W = frameW + rightPad + pad * 2;
  const H = frameH + topPad + pad * 2;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      style={{ overflow: "visible", display: "block" }}
    >
      {/* back-to-front so the nearest frame (d=0) sits on top */}
      {range(frames)
        .slice()
        .reverse()
        .map((d) => {
          const fx = pad + d * DDX;
          const fy = pad + topPad - d * DDY;
          return (
            <g key={d}>
              {range(rows).map((r) =>
                range(cols).map((c) => {
                  const x = fx + c * cell;
                  const y = fy + r * cell;
                  const fill = fillAt(d, r, c);
                  const cur = currentAt ? currentAt(d, r, c) : false;
                  const txt = textAt ? textAt(d, r, c) : null;
                  return (
                    <g key={`${r}-${c}`}>
                      <rect
                        x={x}
                        y={y}
                        width={cell}
                        height={cell}
                        rx={3}
                        fill={fill ?? "transparent"}
                        stroke={cur ? INK : GRID}
                        strokeWidth={cur ? 2.4 : 1}
                      />
                      {txt != null && (
                        <text
                          x={x + cell / 2}
                          y={y + cell / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={cell * 0.42}
                          fontFamily={FONT}
                          fontWeight={600}
                          fill={INK}
                        >
                          {txt}
                        </text>
                      )}
                    </g>
                  );
                }),
              )}
              {/* rounded frame outline — the "sketch" look */}
              <rect
                x={fx - 2}
                y={fy - 2}
                width={frameW + 4}
                height={frameH + 4}
                rx={10}
                fill="none"
                stroke={INK}
                strokeWidth={1.6}
              />
            </g>
          );
        })}
    </svg>
  );
}

/* ---- 1 / 2 / 3 selector ---- */
function Selector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          letterSpacing: 0.4,
          color: MUTE,
          marginBottom: 6,
          fontFamily: FONT,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3].map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-pressed={on}
              aria-label={`${label} = ${n}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                cursor: "pointer",
                border: `1.5px solid ${on ? INK : GRID}`,
                background: on ? INK : "#fff",
                color: on ? "#fff" : INK,
                fontFamily: FONT,
                fontSize: 16,
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
  );
}

function Btn({
  children,
  onClick,
  filled,
}: {
  children: ReactNode;
  onClick: () => void;
  filled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 16px",
        borderRadius: 11,
        border: `1.5px solid ${INK}`,
        background: filled ? INK : "#fff",
        color: filled ? "#fff" : INK,
        cursor: "pointer",
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: 600,
        transition: "all 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  axis,
  children,
}: {
  title: string;
  axis?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        minWidth: 120,
      }}
    >
      <div
        style={{
          borderBottom: `2px solid ${INK}`,
          paddingBottom: 6,
          fontSize: 15,
          fontWeight: 700,
          minWidth: 96,
          textAlign: "center",
          fontFamily: FONT,
          color: INK,
        }}
      >
        {title}
      </div>
      {axis && (
        <div
          style={{
            fontSize: 12,
            color: MUTE,
            alignSelf: "flex-start",
            fontFamily: FONT,
          }}
        >
          ↗ {axis}
        </div>
      )}
      {children}
    </div>
  );
}

export default function Conv3dViz() {
  const [cin, setCin] = useState(2);
  const [tDepth, setTDepth] = useState(3);
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(440); // ms per scan step

  const kD = Math.min(2, tDepth); // kernel depth: 1×1×1 when T=1, else 2-deep
  const tOut = tDepth - kD + 1;
  const N = tOut * OUT_R * OUT_C;

  /* random input volume + kernel weights, recomputed on config / reroll */
  const { input, weight, output } = useMemo(() => {
    const rand = rng(seed * 7919 + cin * 131 + tDepth * 17 + 1);
    const input = range(cin).map(() =>
      range(tDepth).map(() =>
        range(IN_R).map(() => range(IN_C).map(() => rand())),
      ),
    );
    const weight = range(cin).map(() =>
      range(kD).map(() => range(KH).map(() => range(KW).map(() => rand()))),
    );
    const count = cin * kD * KH * KW;
    const output = range(tOut).map((od) =>
      range(OUT_R).map((or) =>
        range(OUT_C).map((oc) => {
          let s = 0;
          for (let c = 0; c < cin; c++)
            for (let dd = 0; dd < kD; dd++)
              for (let hh = 0; hh < KH; hh++)
                for (let ww = 0; ww < KW; ww++)
                  s +=
                    input[c][od + dd][or + hh][oc + ww] *
                    weight[c][dd][hh][ww];
          return s / count; // keep results in a clean 0..1 range
        }),
      ),
    );
    return { input, weight, output };
  }, [cin, tDepth, seed, kD, tOut]);

  // reset the scan whenever the configuration changes
  useEffect(() => {
    setStep(-1);
    setPlaying(false);
  }, [cin, tDepth, seed]);

  // playback loop
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => (s >= N - 1 ? s : s + 1));
    }, speed);
    return () => clearInterval(id);
  }, [playing, speed, N]);

  useEffect(() => {
    if (playing && step >= N - 1) setPlaying(false);
  }, [step, N, playing]);

  const cur =
    step >= 0 && step < N
      ? {
          od: Math.floor(step / (OUT_R * OUT_C)),
          or: Math.floor((step % (OUT_R * OUT_C)) / OUT_C),
          oc: step % OUT_C,
        }
      : null;

  /* input highlight: the receptive field of the current output cell */
  const inHit = (d: number, r: number, c: number) =>
    cur != null &&
    d >= cur.od &&
    d < cur.od + kD &&
    r >= cur.or &&
    r < cur.or + KH &&
    c >= cur.oc &&
    c < cur.oc + KW;

  const inputFill =
    (ch: number): CellFn =>
    (d, r, c) =>
      inHit(d, r, c) ? CH_COLORS[ch][d - (cur as { od: number }).od] : null;
  const inputCurrent: FlagFn = (d, r, c) => inHit(d, r, c);

  const idx = (od: number, or: number, oc: number) =>
    od * (OUT_R * OUT_C) + or * OUT_C + oc;

  const outFill: CellFn = (od, or, oc) => {
    if (idx(od, or, oc) > step) return null;
    const v = output[od][or][oc];
    return `hsl(168 55% ${88 - v * 34}%)`;
  };
  const outText: CellFn = (od, or, oc) =>
    idx(od, or, oc) > step ? null : output[od][or][oc].toFixed(1);
  const outCurrent: FlagFn = (od, or, oc) => idx(od, or, oc) === step;

  const atEnd = step >= N - 1;

  return (
    <div
      role="group"
      aria-label="Interactive Conv3d scanning visualization"
      style={{
        fontFamily: FONT,
        background: PAPER,
        color: INK,
        borderRadius: 20,
        padding: "24px 22px",
        border: `1px solid ${GRID}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-end",
          marginBottom: 18,
        }}
      >
        <Selector label="C_in  (channels)" value={cin} onChange={setCin} />
        <Selector label="T  (depth)" value={tDepth} onChange={setTDepth} />
        <div
          style={{
            display: "flex",
            gap: 8,
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          <Btn
            filled
            onClick={() => {
              if (atEnd) setStep(-1);
              setPlaying((p) => !p);
            }}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </Btn>
          <Btn onClick={() => setStep((s) => Math.min(N - 1, s + 1))}>Step</Btn>
          <Btn
            onClick={() => {
              setPlaying(false);
              setStep(-1);
            }}
          >
            Reset
          </Btn>
          <Btn onClick={() => setSeed((s) => s + 1)}>Reroll</Btn>
        </div>
      </div>

      {/* speed + progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 26,
          fontSize: 12,
          color: MUTE,
        }}
      >
        <span>fast</span>
        <input
          type="range"
          min={120}
          max={760}
          step={20}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          aria-label="scan speed (milliseconds per step)"
          style={{ accentColor: INK, width: 130 }}
        />
        <span>slow</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
          {Math.max(0, step + 1)} / {N}
        </span>
      </div>

      {/* diagram */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 28,
          justifyContent: "center",
        }}
      >
        <Panel title={`C_in = ${cin}`} axis="T">
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {range(cin).map((c) => (
              <Volume
                key={c}
                frames={tDepth}
                rows={IN_R}
                cols={IN_C}
                cell={IN_CELL}
                fillAt={inputFill(c)}
                currentAt={inputCurrent}
                ariaLabel={`Input channel ${c + 1}: ${tDepth} frames of ${IN_R} by ${IN_C}`}
              />
            ))}
          </div>
        </Panel>

        <Panel title={`kernel  ${kD}×${KH}×${KW}`} axis="kD">
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {range(cin).map((c) => (
              <Volume
                key={c}
                frames={kD}
                rows={KH}
                cols={KW}
                cell={K_CELL}
                fillAt={(d) => CH_COLORS[c][d]}
                ariaLabel={`Kernel for input channel ${c + 1}`}
              />
            ))}
          </div>
        </Panel>

        <Panel title="C_out = 1">
          <Volume
            frames={tOut}
            rows={OUT_R}
            cols={OUT_C}
            cell={OUT_CELL}
            fillAt={outFill}
            textAt={outText}
            currentAt={outCurrent}
            ariaLabel={`Output: ${tOut} frames of ${OUT_R} by ${OUT_C}`}
          />
        </Panel>
      </div>
    </div>
  );
}
