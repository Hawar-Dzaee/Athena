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

const IN_R = 5; // input H
const IN_C = 5; // input W

/* per-(channel, depth-slice) pastel triple, echoing the reference sketch.
 * three shades cover a kernel up to 3 frames deep. */
const CH_COLORS: string[][] = [
  ["#f6b3b3", "#ece6c6", "#f3d2b3"], // channel 0 — pink / beige / peach
  ["#f5c184", "#dcb4ef", "#c9d6a3"], // channel 1 — orange / lilac / sage
  ["#a8d2ff", "#bde9cf", "#d9c2f0"], // channel 2 — blue / mint / wisteria
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
  const [kSize, setKSize] = useState(2); // spatial kernel size (square, KH = KW)
  const [stride, setStride] = useState(1); // stride along every axis
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(440); // ms per scan step

  /* kernel geometry derived from the controls */
  const KH = kSize;
  const KW = kSize;
  const kD = Math.min(kSize, tDepth); // depth kernel, clamped to available frames
  const sH = stride;
  const sW = stride;
  const sD = stride;

  /* output geometry — PyTorch's floor((in − kernel) / stride) + 1 */
  const OUT_R = Math.floor((IN_R - KH) / sH) + 1;
  const OUT_C = Math.floor((IN_C - KW) / sW) + 1;
  const tOut = Math.floor((tDepth - kD) / sD) + 1;
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
                    input[c][od * sD + dd][or * sH + hh][oc * sW + ww] *
                    weight[c][dd][hh][ww];
          return s / count; // keep results in a clean 0..1 range
        }),
      ),
    );
    return { input, weight, output };
  }, [cin, tDepth, seed, kD, tOut, KH, KW, OUT_R, OUT_C, sD, sH, sW]);

  // reset the scan whenever the configuration changes
  useEffect(() => {
    setStep(-1);
    setPlaying(false);
  }, [cin, tDepth, seed, kSize, stride]);

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

  /* input highlight: the receptive field of the current output cell,
   * anchored by the stride along every axis */
  const inHit = (d: number, r: number, c: number) =>
    cur != null &&
    d >= cur.od * sD &&
    d < cur.od * sD + kD &&
    r >= cur.or * sH &&
    r < cur.or * sH + KH &&
    c >= cur.oc * sW &&
    c < cur.oc * sW + KW;

  const inputFill =
    (ch: number): CellFn =>
    (d, r, c) =>
      inHit(d, r, c)
        ? CH_COLORS[ch][d - (cur as { od: number }).od * sD]
        : null;
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

  /* layout: line each kernel up with the center of its input channel */
  const VOL_PAD = 20; // Volume's pad * 2
  const CH_GAP = 22; // vertical gap between stacked input channels
  const inH = IN_R * IN_CELL + (tDepth - 1) * DDY + VOL_PAD;
  const kernelH = KH * K_CELL + (kD - 1) * DDY + VOL_PAD;
  const kernelW = KW * K_CELL + (kD - 1) * DDX + VOL_PAD;
  const colH = cin * inH + (cin - 1) * CH_GAP;
  const channelCenter = (c: number) => c * (inH + CH_GAP) + inH / 2;

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
        <Selector label="kernel  (K)" value={kSize} onChange={setKSize} />
        <Selector label="stride  (S)" value={stride} onChange={setStride} />
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
          <div
            style={{ display: "flex", flexDirection: "column", gap: CH_GAP }}
          >
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
          {/* each kernel is absolutely centered on its input channel */}
          <div style={{ position: "relative", width: kernelW, height: colH }}>
            {range(cin).map((c) => (
              <div
                key={c}
                style={{
                  position: "absolute",
                  top: channelCenter(c) - kernelH / 2,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Volume
                  frames={kD}
                  rows={KH}
                  cols={KW}
                  cell={K_CELL}
                  fillAt={(d) => CH_COLORS[c][d]}
                  ariaLabel={`Kernel for input channel ${c + 1}`}
                />
              </div>
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
