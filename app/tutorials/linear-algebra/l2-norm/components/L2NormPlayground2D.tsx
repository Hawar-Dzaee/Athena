"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

const VIEW = 480;
const PADDING = 24;
const RANGE = 5;
const SCALE = (VIEW - PADDING * 2) / (RANGE * 2);
const ORIGIN = VIEW / 2;

type Pt = { x: number; y: number };

function worldToSvg(p: Pt): Pt {
  return { x: ORIGIN + p.x * SCALE, y: ORIGIN - p.y * SCALE };
}
function svgToWorld(p: Pt): Pt {
  return { x: (p.x - ORIGIN) / SCALE, y: (ORIGIN - p.y) / SCALE };
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const VEC_COLOR = "var(--color-vec-a)";
const NORM_COLOR = "var(--color-vec-sum)";

export function L2NormPlayground2D() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrowId = useId();
  const gridId = useId();

  const [v, setV] = useState<Pt>({ x: 3, y: 2 });
  const [snap, setSnap] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showUnitCircle, setShowUnitCircle] = useState(false);
  const [showL1, setShowL1] = useState(false);

  const norm = useMemo(() => Math.sqrt(v.x * v.x + v.y * v.y), [v]);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !dragging) return;
      const rect = svg.getBoundingClientRect();
      const sx = ((clientX - rect.left) / rect.width) * VIEW;
      const sy = ((clientY - rect.top) / rect.height) * VIEW;
      let world = svgToWorld({ x: sx, y: sy });
      if (snap) {
        world = { x: Math.round(world.x), y: Math.round(world.y) };
      } else {
        world = { x: round1(world.x), y: round1(world.y) };
      }
      world.x = clamp(world.x, -RANGE, RANGE);
      world.y = clamp(world.y, -RANGE, RANGE);
      setV(world);
    },
    [dragging, snap],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromPointer]);

  const o = worldToSvg({ x: 0, y: 0 });
  const vS = worldToSvg(v);
  const foot = worldToSvg({ x: v.x, y: 0 });

  const unitCircleR = SCALE;
  const l1Points = [
    worldToSvg({ x: 1, y: 0 }),
    worldToSvg({ x: 0, y: 1 }),
    worldToSvg({ x: -1, y: 0 }),
    worldToSvg({ x: 0, y: -1 }),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  const bracketSize = 6;

  return (
    <div className="not-prose my-8 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        <div className="flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="aspect-square w-full touch-none select-none"
            role="img"
            aria-label="Interactive L2 norm diagram — drag the vector tip to change its length"
          >
            <defs>
              <ArrowMarker id={arrowId} color={VEC_COLOR} />
              <pattern
                id={gridId}
                width={SCALE}
                height={SCALE}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.5}
                  className="text-foreground/10"
                />
              </pattern>
            </defs>

            <rect width={VIEW} height={VIEW} fill={`url(#${gridId})`} />

            {/* Axes */}
            <line
              x1={PADDING}
              y1={ORIGIN}
              x2={VIEW - PADDING}
              y2={ORIGIN}
              stroke="currentColor"
              strokeWidth={1}
              className="text-foreground/60"
            />
            <line
              x1={ORIGIN}
              y1={PADDING}
              x2={ORIGIN}
              y2={VIEW - PADDING}
              stroke="currentColor"
              strokeWidth={1}
              className="text-foreground/60"
            />

            {/* Unit circle (L2) */}
            {showUnitCircle && (
              <circle
                cx={o.x}
                cy={o.y}
                r={unitCircleR}
                fill={NORM_COLOR}
                fillOpacity={0.06}
                stroke={NORM_COLOR}
                strokeOpacity={0.4}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}

            {/* L1 unit ball (diamond) */}
            {showL1 && (
              <polygon
                points={l1Points}
                fill="var(--color-vec-b)"
                fillOpacity={0.06}
                stroke="var(--color-vec-b)"
                strokeOpacity={0.4}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}

            {/* Right triangle: horizontal leg, vertical leg, right-angle bracket */}
            {v.x !== 0 && v.y !== 0 && (
              <>
                {/* Horizontal leg */}
                <line
                  x1={o.x}
                  y1={o.y}
                  x2={foot.x}
                  y2={foot.y}
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {/* Vertical leg */}
                <line
                  x1={foot.x}
                  y1={foot.y}
                  x2={vS.x}
                  y2={vS.y}
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {/* Right-angle bracket */}
                <polyline
                  points={`${foot.x + (v.x > 0 ? -bracketSize : bracketSize)},${foot.y} ${foot.x + (v.x > 0 ? -bracketSize : bracketSize)},${foot.y + (v.y > 0 ? bracketSize : -bracketSize)} ${foot.x},${foot.y + (v.y > 0 ? bracketSize : -bracketSize)}`}
                  fill="none"
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
                {/* Component labels */}
                <text
                  x={(o.x + foot.x) / 2}
                  y={o.y + (v.y > 0 ? 16 : -8)}
                  fontSize={11}
                  fill="var(--color-foreground)"
                  fillOpacity={0.5}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {Math.abs(v.x).toFixed(1)}
                </text>
                <text
                  x={foot.x + (v.x > 0 ? 14 : -14)}
                  y={(foot.y + vS.y) / 2 + 4}
                  fontSize={11}
                  fill="var(--color-foreground)"
                  fillOpacity={0.5}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {Math.abs(v.y).toFixed(1)}
                </text>
              </>
            )}

            {/* Vector */}
            <line
              x1={o.x}
              y1={o.y}
              x2={vS.x}
              y2={vS.y}
              stroke={VEC_COLOR}
              strokeWidth={3}
              markerEnd={`url(#${arrowId})`}
            />

            {/* Norm label on the vector */}
            <NormLabel v={v} norm={norm} />

            {/* Drag handle */}
            <DragHandle
              cx={vS.x}
              cy={vS.y}
              color={VEC_COLOR}
              label="v"
              active={dragging}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging(true);
              }}
            />
          </svg>
        </div>

        <aside className="flex w-full flex-col gap-3 md:w-64">
          <div className="rounded-lg border border-border/50 px-3 py-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Vector v
            </div>
            <div className="font-mono text-sm" style={{ color: VEC_COLOR }}>
              ({v.x.toFixed(1)}, {v.y.toFixed(1)})
            </div>
          </div>

          <div
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: NORM_COLOR }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: NORM_COLOR }}>
                ||v||₂
              </span>
              <span className="font-mono text-lg font-bold" style={{ color: NORM_COLOR }}>
                {norm.toFixed(3)}
              </span>
            </div>
          </div>

          <FormulaBreakdown v={v} norm={norm} />

          <div className="mt-1 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
                className="h-4 w-4 accent-vec-a"
              />
              Snap to grid
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={showUnitCircle}
                onChange={(e) => setShowUnitCircle(e.target.checked)}
                className="h-4 w-4 accent-vec-sum"
              />
              Show L2 unit circle
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={showL1}
                onChange={(e) => setShowL1(e.target.checked)}
                className="h-4 w-4 accent-vec-b"
              />
              Show L1 unit ball
            </label>
          </div>

          <p className="mt-auto text-xs leading-relaxed text-foreground/50">
            Drag the circle at the vector tip. The dashed triangle shows the
            Pythagorean decomposition — the L2 norm is the hypotenuse.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={8}
      refY={5}
      markerWidth={7}
      markerHeight={7}
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

function DragHandle({
  cx,
  cy,
  color,
  label,
  active,
  onPointerDown,
}: {
  cx: number;
  cy: number;
  color: string;
  label: string;
  active: boolean;
  onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <g style={{ cursor: active ? "grabbing" : "grab" }}>
      <circle
        cx={cx}
        cy={cy}
        r={active ? 13 : 11}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={1}
      />
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke="var(--background)"
        strokeWidth={2}
        onPointerDown={onPointerDown}
      />
      <text
        x={cx + 12}
        y={cy - 10}
        fontSize={13}
        fontWeight={600}
        fill={color}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function NormLabel({ v, norm }: { v: Pt; norm: number }) {
  if (norm < 0.3) return null;
  const angle = Math.atan2(v.y, v.x);
  const mid = worldToSvg({ x: v.x / 2, y: v.y / 2 });
  const offset = 14;
  const perpX = -Math.sin(angle) * offset;
  const perpY = Math.cos(angle) * offset;
  return (
    <text
      x={mid.x + perpX}
      y={mid.y + perpY}
      fontSize={12}
      fontWeight={600}
      fill={NORM_COLOR}
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
    >
      {norm.toFixed(2)}
    </text>
  );
}

function FormulaBreakdown({ v, norm }: { v: Pt; norm: number }) {
  const x2 = v.x * v.x;
  const y2 = v.y * v.y;
  return (
    <div className="rounded-lg border border-border/50 px-3 py-2">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        Pythagorean breakdown
      </div>
      <div className="font-mono text-xs leading-relaxed text-foreground/80">
        <span>sqrt({v.x.toFixed(1)}² + {v.y.toFixed(1)}²)</span>
        <br />
        <span>= sqrt({x2.toFixed(2)} + {y2.toFixed(2)})</span>
        <br />
        <span>= sqrt({(x2 + y2).toFixed(2)})</span>
        <br />
        <span className="font-semibold">= {norm.toFixed(3)}</span>
      </div>
    </div>
  );
}
