"use client";

const WIDTH = 600;
const HEIGHT = 460;
const PAD = { top: 24, right: 24, bottom: 44, left: 52 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const X_MIN = -6;
const X_MAX = 6;
const Y_MIN = -2;
const Y_MAX = 6;

function toSvgX(x: number) {
  return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}
function toSvgY(y: number) {
  return PAD.top + PLOT_H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}

const DATA = [
  { x: -5, y: 1 },
  { x: -4, y: 2 },
  { x: -3, y: 3 },
  { x: -2, y: 4 },
  { x: -1, y: 5 },
];

const MX = -3;
const MY = 3;

const naiveProducts = DATA.map((p) => p.x * p.y);
const naiveSum = naiveProducts.reduce((s, v) => s + v, 0);

const centeredProducts = DATA.map((p) => (p.x - MX) * (p.y - MY));
const centeredSum = centeredProducts.reduce((s, v) => s + v, 0);
const cov = centeredSum / (DATA.length - 1);

const xTicks = [-6, -4, -2, 0, 2, 4, 6];
const yTicks = [-2, 0, 2, 4, 6];

export function WhyMeanCenter() {
  return (
    <div className="my-8 flex flex-col items-center gap-6">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[600px] select-none overflow-visible"
        role="img"
        aria-label="Scatter plot showing five positively correlated points all in quadrant II, with the origin and mean marked"
      >
        {/* Grid */}
        {xTicks.map((x) => (
          <line
            key={`gx${x}`}
            x1={toSvgX(x)}
            x2={toSvgX(x)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            className="stroke-foreground/[0.06]"
            strokeWidth={1}
          />
        ))}
        {yTicks.map((y) => (
          <line
            key={`gy${y}`}
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={toSvgY(y)}
            y2={toSvgY(y)}
            className="stroke-foreground/[0.06]"
            strokeWidth={1}
          />
        ))}

        {/* Origin crosshairs */}
        <line
          x1={toSvgX(0)}
          x2={toSvgX(0)}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          className="stroke-foreground/20"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={toSvgY(0)}
          y2={toSvgY(0)}
          className="stroke-foreground/20"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* Origin label */}
        <circle
          cx={toSvgX(0)}
          cy={toSvgY(0)}
          r={4}
          className="fill-foreground/30 stroke-foreground/50"
          strokeWidth={1.5}
        />
        <text
          x={toSvgX(0) + 10}
          y={toSvgY(0) + 16}
          className="fill-foreground/50 text-[11px] font-medium"
        >
          origin (0, 0)
        </text>

        {/* Quadrant II label */}
        <text
          x={toSvgX(-3)}
          y={PAD.top + 18}
          textAnchor="middle"
          className="fill-foreground/20 text-sm font-bold"
        >
          Quadrant II
        </text>

        {/* Trend line through the data: y = x + 6, from x=-5.5 to x=-0.5 */}
        <line
          x1={toSvgX(-5.5)}
          y1={toSvgY(0.5)}
          x2={toSvgX(-0.5)}
          y2={toSvgY(5.5)}
          className="stroke-violet-400/40"
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {/* Data points */}
        {DATA.map((p, i) => (
          <g key={i}>
            <circle
              cx={toSvgX(p.x)}
              cy={toSvgY(p.y)}
              r={7}
              className="fill-violet-400 stroke-violet-200"
              strokeWidth={1.5}
            />
            <text
              x={toSvgX(p.x) + 12}
              y={toSvgY(p.y) + 4}
              className="fill-foreground/50 text-[10px]"
            >
              ({p.x}, {p.y})
            </text>
          </g>
        ))}

        {/* Mean point */}
        <circle
          cx={toSvgX(MX)}
          cy={toSvgY(MY)}
          r={5}
          className="fill-amber-400 stroke-amber-200"
          strokeWidth={2}
        />
        <text
          x={toSvgX(MX) + 10}
          y={toSvgY(MY) - 10}
          className="fill-amber-400/80 text-[11px] font-medium"
        >
          mean ({MX}, {MY})
        </text>

        {/* Axes */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        {/* X ticks */}
        {xTicks.map((x) => (
          <g key={`xt${x}`}>
            <line
              x1={toSvgX(x)}
              x2={toSvgX(x)}
              y1={PAD.top + PLOT_H}
              y2={PAD.top + PLOT_H + 6}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={toSvgX(x)}
              y={PAD.top + PLOT_H + 22}
              textAnchor="middle"
              className="fill-foreground/60 text-[11px]"
            >
              {x}
            </text>
          </g>
        ))}

        {/* Y ticks */}
        {yTicks.map((y) => (
          <g key={`yt${y}`}>
            <line
              x1={PAD.left - 6}
              x2={PAD.left}
              y1={toSvgY(y)}
              y2={toSvgY(y)}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={toSvgY(y) + 4}
              textAnchor="end"
              className="fill-foreground/60 text-[11px]"
            >
              {y}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={PAD.left + PLOT_W / 2}
          y={HEIGHT - 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
        >
          X
        </text>
        <text
          x={14}
          y={PAD.top + PLOT_H / 2}
          textAnchor="middle"
          className="fill-foreground/50 text-xs"
          transform={`rotate(-90, 14, ${PAD.top + PLOT_H / 2})`}
        >
          Y
        </text>
      </svg>

      {/* Calculation comparison */}
      <div className="grid w-full max-w-[600px] grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Without centering */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
          <p className="mb-3 text-center text-sm font-semibold text-rose-400">
            Without centering
          </p>
          <p className="mb-2 text-center text-xs text-foreground/50">
            Naive: just multiply x&#7522; &middot; y&#7522;
          </p>
          <div className="flex flex-col gap-1">
            {DATA.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs tabular-nums text-foreground/60"
              >
                <span>
                  ({p.x})({p.y})
                </span>
                <span className="text-rose-400">{naiveProducts[i]}</span>
              </div>
            ))}
            <div className="mt-1 border-t border-foreground/10 pt-1">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-foreground/60">Sum</span>
                <span className="text-rose-400">{naiveSum}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-rose-400/80">
            All products negative &mdash; says &ldquo;negative relationship&rdquo;!
          </p>
        </div>

        {/* With centering */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="mb-3 text-center text-sm font-semibold text-emerald-400">
            With mean-centering
          </p>
          <p className="mb-2 text-center text-xs text-foreground/50">
            Proper: (x&#7522; &minus; x&#772;)(y&#7522; &minus; y&#772;)
          </p>
          <div className="flex flex-col gap-1">
            {DATA.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs tabular-nums text-foreground/60"
              >
                <span>
                  ({p.x - MX})({p.y - MY})
                </span>
                <span className="text-emerald-400">
                  {centeredProducts[i] > 0 ? "+" : ""}
                  {centeredProducts[i]}
                </span>
              </div>
            ))}
            <div className="mt-1 border-t border-foreground/10 pt-1">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-foreground/60">
                  Cov = {centeredSum} / {DATA.length - 1}
                </span>
                <span className="text-emerald-400">+{cov.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-emerald-400/80">
            Correctly detects the positive relationship
          </p>
        </div>
      </div>
    </div>
  );
}
