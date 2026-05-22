"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const TAU = 2 * Math.PI;

const W = 960;
const H = 420;
const CX = 195;
const CY = 210;
const S = 75;
const WL = 375;
const WR = 935;
const WS = (WR - WL) / TAU;

const COS_C = "#22d3ee";
const SIN_C = "#f472b6";
const ANG_C = "#fbbf24";

function wPath(fn: (t: number) => number, a: number, end: number) {
  const n = Math.max(4, Math.ceil(500 * (end / TAU)));
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * end;
    d += `${i ? "L" : "M"}${(WL + t * WS).toFixed(1)},${(CY - a * fn(t) * S).toFixed(1)}`;
  }
  return d;
}

function wFill(fn: (t: number) => number, a: number, end: number) {
  if (end < 0.005) return "";
  const n = Math.max(4, Math.ceil(500 * (end / TAU)));
  let d = `M${WL},${CY}`;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * end;
    d += `L${(WL + t * WS).toFixed(1)},${(CY - a * fn(t) * S).toFixed(1)}`;
  }
  return d + `L${(WL + end * WS).toFixed(1)},${CY}Z`;
}

function arcD(r: number, angle: number) {
  if (angle < 0.01) return "";
  const a = Math.min(angle, TAU - 0.001);
  const ex = CX + r * Math.cos(a);
  const ey = CY - r * Math.sin(a);
  return `M${CX + r},${CY}A${r},${r} 0 ${a > Math.PI ? 1 : 0} 0 ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

const XTICKS: [number, string][] = [
  [0, "0"],
  [Math.PI / 2, "π/2"],
  [Math.PI, "π"],
  [1.5 * Math.PI, "3π/2"],
  [TAU, "2π"],
];

export function CircleWaveExplorer() {
  const [A, setA] = useState(1.0);
  const [x, setX] = useState(Math.PI / 4);
  const [showSin, setShowSin] = useState(true);
  const [showCos, setShowCos] = useState(true);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const prev = useRef(0);

  const r = A * S;
  const px = CX + r * Math.cos(x);
  const py = CY - r * Math.sin(x);
  const cv = A * Math.cos(x);
  const sv = A * Math.sin(x);
  const wx = WL + x * WS;

  const tick = useCallback((t: number) => {
    if (!prev.current) prev.current = t;
    const dt = (t - prev.current) / 1000;
    prev.current = t;
    setX((p) => {
      const n = p + dt * 1.3;
      if (n >= TAU) {
        setPlaying(false);
        return TAU;
      }
      return n;
    });
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      prev.current = 0;
      raf.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf.current);
    }
    return () => cancelAnimationFrame(raf.current);
  }, [playing, tick]);

  return (
    <div
      className="trig-vis my-10 mx-auto w-full max-w-[960px] rounded-2xl overflow-hidden"
      style={{
        background: "#0c0f1d",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <style>{SLIDER_CSS}</style>

      {/* ── SVG ── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label="Unit circle and sinusoidal wave visualization"
      >
        <defs>
          <radialGradient id="tbg" cx="25%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0c0f1d" />
          </radialGradient>
          <filter id="gw">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gc">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feFlood floodColor={COS_C} floodOpacity=".5" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge>
              <feMergeNode in="d" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gp">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feFlood floodColor={SIN_C} floodOpacity=".5" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge>
              <feMergeNode in="d" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#tbg)" />

        {/* ── Circle area ── */}

        {/* Faint grid */}
        {[-2, -1, 1, 2].map((v) => (
          <g key={v} opacity={0.04}>
            <line
              x1={CX + v * S}
              y1={30}
              x2={CX + v * S}
              y2={H - 30}
              stroke="#fff"
            />
            <line
              x1={30}
              y1={CY + v * S}
              x2={360}
              y2={CY + v * S}
              stroke="#fff"
            />
          </g>
        ))}

        {/* Axes */}
        <line x1={30} y1={CY} x2={360} y2={CY} stroke="#fff" opacity={0.12} />
        <line x1={CX} y1={30} x2={CX} y2={H - 30} stroke="#fff" opacity={0.12} />

        {/* Unit circle reference (when A !== 1) */}
        {Math.abs(A - 1) > 0.08 && (
          <circle
            cx={CX}
            cy={CY}
            r={S}
            fill="none"
            stroke="#fff"
            strokeDasharray="3 6"
            opacity={0.07}
          />
        )}

        {/* Main circle */}
        <circle
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth={1.5}
          opacity={0.18}
        />

        {/* Quadrant reference dots */}
        {[0, Math.PI / 2, Math.PI, 1.5 * Math.PI].map((a, i) => (
          <circle
            key={i}
            cx={CX + r * Math.cos(a)}
            cy={CY - r * Math.sin(a)}
            r={2}
            fill="#fff"
            opacity={0.12}
          />
        ))}

        {/* Angle arc */}
        {x > 0.02 && (
          <path
            d={arcD(Math.min(35, r * 0.35), x)}
            fill="none"
            stroke={ANG_C}
            strokeWidth={2}
            opacity={0.6}
          />
        )}

        {/* Angle label */}
        {x > 0.25 && (
          <text
            x={CX + 50 * Math.cos(x * 0.45)}
            y={CY - 50 * Math.sin(x * 0.45) + 1}
            fill={ANG_C}
            fontSize={14}
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={0.7}
            fontStyle="italic"
            fontFamily="Georgia, serif"
          >
            x
          </text>
        )}

        {/* Cosine projection (horizontal) */}
        {showCos && (
          <line
            x1={CX}
            y1={CY}
            x2={CX + r * Math.cos(x)}
            y2={CY}
            stroke={COS_C}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.85}
          />
        )}

        {/* Sine projection (vertical) */}
        {showSin && (
          <line
            x1={CX + r * Math.cos(x)}
            y1={CY}
            x2={px}
            y2={py}
            stroke={SIN_C}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.85}
          />
        )}

        {/* Projection labels */}
        {showCos && Math.abs(cv) > 0.2 && (
          <text
            x={CX + (r * Math.cos(x)) / 2}
            y={CY + (Math.sin(x) >= 0 ? 20 : -12)}
            fill={COS_C}
            fontSize={13}
            textAnchor="middle"
            fontWeight={600}
            opacity={0.8}
          >
            cos
          </text>
        )}
        {showSin && Math.abs(sv) > 0.2 && (
          <text
            x={px + (Math.cos(x) >= 0 ? 18 : -18)}
            y={CY - (r * Math.sin(x)) / 2 + 4}
            fill={SIN_C}
            fontSize={13}
            textAnchor={Math.cos(x) >= 0 ? "start" : "end"}
            fontWeight={600}
            opacity={0.8}
          >
            sin
          </text>
        )}

        {/* Radius line */}
        <line
          x1={CX}
          y1={CY}
          x2={px}
          y2={py}
          stroke="#fff"
          strokeDasharray="4 4"
          opacity={0.2}
        />

        {/* Point on circle */}
        <circle
          cx={px}
          cy={py}
          r={8}
          fill="#fff"
          opacity={0.25}
          filter="url(#gw)"
        />
        <circle cx={px} cy={py} r={5} fill="#fff" />

        {/* ── Wave area ── */}

        {/* Wave x-axis */}
        <line
          x1={WL}
          y1={CY}
          x2={WR}
          y2={CY}
          stroke="#fff"
          opacity={0.12}
        />

        {/* Amplitude guide lines */}
        <line
          x1={WL}
          y1={CY - A * S}
          x2={WR}
          y2={CY - A * S}
          stroke="#fff"
          strokeDasharray="2 6"
          opacity={0.05}
        />
        <line
          x1={WL}
          y1={CY + A * S}
          x2={WR}
          y2={CY + A * S}
          stroke="#fff"
          strokeDasharray="2 6"
          opacity={0.05}
        />
        <text
          x={WL - 8}
          y={CY - A * S}
          fill="#fff"
          fontSize={10}
          textAnchor="end"
          dominantBaseline="middle"
          opacity={0.22}
        >
          {A === 1 ? "1" : A.toFixed(1)}
        </text>
        <text
          x={WL - 8}
          y={CY + A * S}
          fill="#fff"
          fontSize={10}
          textAnchor="end"
          dominantBaseline="middle"
          opacity={0.22}
        >
          {A === 1 ? "−1" : `−${A.toFixed(1)}`}
        </text>

        {/* Wave x-axis ticks */}
        {XTICKS.map(([t, label]) => (
          <g key={label}>
            <line
              x1={WL + t * WS}
              y1={CY - 4}
              x2={WL + t * WS}
              y2={CY + 4}
              stroke="#fff"
              opacity={0.15}
            />
            <text
              x={WL + t * WS}
              y={CY + 22}
              fill="#fff"
              fontSize={12}
              textAnchor="middle"
              opacity={0.28}
              fontStyle="italic"
              fontFamily="Georgia, serif"
            >
              {label}
            </text>
          </g>
        ))}

        {/* Full wave guide (dim) */}
        {showCos && (
          <path
            d={wPath(Math.cos, A, TAU)}
            fill="none"
            stroke={COS_C}
            strokeWidth={1.5}
            opacity={0.1}
          />
        )}
        {showSin && (
          <path
            d={wPath(Math.sin, A, TAU)}
            fill="none"
            stroke={SIN_C}
            strokeWidth={1.5}
            opacity={0.1}
          />
        )}

        {/* Active wave fills */}
        {showCos && (
          <path d={wFill(Math.cos, A, x)} fill={COS_C} opacity={0.06} />
        )}
        {showSin && (
          <path d={wFill(Math.sin, A, x)} fill={SIN_C} opacity={0.06} />
        )}

        {/* Active wave curves */}
        {showCos && (
          <path
            d={wPath(Math.cos, A, x)}
            fill="none"
            stroke={COS_C}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        {showSin && (
          <path
            d={wPath(Math.sin, A, x)}
            fill="none"
            stroke={SIN_C}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {/* Connection line: circle point → wave (horizontal, y matches) */}
        {showSin && x > 0.02 && (
          <line
            x1={px}
            y1={py}
            x2={wx}
            y2={py}
            stroke={SIN_C}
            strokeDasharray="4 4"
            opacity={0.35}
          />
        )}

        {/* Vertical marker at current x on the wave */}
        <line
          x1={wx}
          y1={CY - A * S - 10}
          x2={wx}
          y2={CY + A * S + 10}
          stroke="#fff"
          strokeDasharray="3 4"
          opacity={0.08}
        />

        {/* Dots on the wave at current x */}
        {showCos && (
          <circle
            cx={wx}
            cy={CY - cv * S}
            r={5}
            fill={COS_C}
            filter="url(#gc)"
          />
        )}
        {showSin && (
          <circle
            cx={wx}
            cy={CY - sv * S}
            r={5}
            fill={SIN_C}
            filter="url(#gp)"
          />
        )}

        {/* Section labels */}
        <text
          x={CX}
          y={H - 12}
          fill="#fff"
          fontSize={10}
          textAnchor="middle"
          opacity={0.15}
          fontWeight={500}
          letterSpacing={1.5}
        >
          CIRCLE
        </text>
        <text
          x={(WL + WR) / 2}
          y={H - 12}
          fill="#fff"
          fontSize={10}
          textAnchor="middle"
          opacity={0.15}
          fontWeight={500}
          letterSpacing={1.5}
        >
          WAVEFORM
        </text>
      </svg>

      {/* ── Controls panel ── */}
      <div className="px-5 sm:px-6 py-5 flex flex-col gap-5">
        {/* Value readout cards */}
        <div className="flex flex-wrap gap-3">
          {showCos && (
            <div
              className="flex-1 min-w-[220px] rounded-xl px-4 py-3"
              style={{
                background: "rgba(34,211,238,0.03)",
                border: "1px solid rgba(34,211,238,0.12)",
              }}
            >
              <div
                className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1.5"
                style={{ color: "rgba(34,211,238,0.5)" }}
              >
                Cosine
              </div>
              <div className="font-mono text-sm">
                <span style={{ color: "rgba(255,255,255,0.45)" }}>
                  {A.toFixed(2)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}> &middot; </span>
                <span style={{ color: COS_C }}>cos</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>(</span>
                <span style={{ color: ANG_C }}>{x.toFixed(2)}</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>)</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}> = </span>
                <span
                  className="text-[1.1rem] font-semibold"
                  style={{ color: COS_C }}
                >
                  {cv.toFixed(4)}
                </span>
              </div>
            </div>
          )}
          {showSin && (
            <div
              className="flex-1 min-w-[220px] rounded-xl px-4 py-3"
              style={{
                background: "rgba(244,114,182,0.03)",
                border: "1px solid rgba(244,114,182,0.12)",
              }}
            >
              <div
                className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1.5"
                style={{ color: "rgba(244,114,182,0.5)" }}
              >
                Sine
              </div>
              <div className="font-mono text-sm">
                <span style={{ color: "rgba(255,255,255,0.45)" }}>
                  {A.toFixed(2)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}> &middot; </span>
                <span style={{ color: SIN_C }}>sin</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>(</span>
                <span style={{ color: ANG_C }}>{x.toFixed(2)}</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>)</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}> = </span>
                <span
                  className="text-[1.1rem] font-semibold"
                  style={{ color: SIN_C }}
                >
                  {sv.toFixed(4)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Amplitude */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span
                className="text-[10px] font-semibold tracking-[0.15em] uppercase"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Amplitude
              </span>
              <span
                className="font-mono text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                A = {A.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.01}
              value={A}
              onChange={(e) => setA(+e.target.value)}
              style={
                {
                  "--tc": "#fff",
                  "--tg": "rgba(255,255,255,0.25)",
                } as React.CSSProperties
              }
              aria-label="Amplitude A"
            />
            <div
              className="flex justify-between font-mono"
              style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}
            >
              <span>0.2</span>
              <span>2.0</span>
            </div>
          </div>

          {/* Angle */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span
                className="text-[10px] font-semibold tracking-[0.15em] uppercase"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Angle
              </span>
              <span
                className="font-mono text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                x = {x.toFixed(2)}{" "}
                <span style={{ color: "rgba(255,255,255,0.22)" }}>
                  ({((x * 180) / Math.PI).toFixed(0)}&deg;)
                </span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={TAU}
              step={0.01}
              value={x}
              onChange={(e) => {
                setPlaying(false);
                setX(+e.target.value);
              }}
              style={
                {
                  "--tc": ANG_C,
                  "--tg": "rgba(251,191,36,0.25)",
                } as React.CSSProperties
              }
              aria-label="Angle x"
            />
            <div
              className="flex justify-between font-mono"
              style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}
            >
              <span>0</span>
              <span>2&pi;</span>
            </div>
          </div>
        </div>

        {/* Toggles + Play */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSin((v) => !v)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: showSin
                  ? "rgba(244,114,182,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${showSin ? "rgba(244,114,182,0.2)" : "rgba(255,255,255,0.06)"}`,
                color: showSin ? SIN_C : "rgba(255,255,255,0.25)",
              }}
              aria-label="Toggle sine"
              aria-pressed={showSin}
            >
              sin
            </button>
            <button
              onClick={() => setShowCos((v) => !v)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: showCos
                  ? "rgba(34,211,238,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${showCos ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.06)"}`,
                color: showCos ? COS_C : "rgba(255,255,255,0.25)",
              }}
              aria-label="Toggle cosine"
              aria-pressed={showCos}
            >
              cos
            </button>
          </div>

          <button
            onClick={() => {
              setX(0);
              setPlaying(true);
            }}
            className="px-5 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)",
            }}
            aria-label={playing ? "Playing" : "Play animation"}
          >
            {playing ? "Playing…" : "▶  Play"}
          </button>
        </div>
      </div>
    </div>
  );
}

const SLIDER_CSS = `
.trig-vis input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
}
.trig-vis input[type="range"]::-webkit-slider-track {
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
}
.trig-vis input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--tc, #fff);
  box-shadow: 0 0 10px var(--tg, rgba(255,255,255,0.2));
  margin-top: -7.5px;
  transition: box-shadow 0.2s ease;
}
.trig-vis input[type="range"]::-webkit-slider-thumb:hover {
  box-shadow: 0 0 18px var(--tg, rgba(255,255,255,0.4));
}
.trig-vis input[type="range"]::-moz-range-track {
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  border: none;
}
.trig-vis input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--tc, #fff);
  box-shadow: 0 0 10px var(--tg, rgba(255,255,255,0.2));
}
`;
