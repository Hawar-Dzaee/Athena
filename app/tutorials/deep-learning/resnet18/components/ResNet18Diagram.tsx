"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlowProvider,
  BaseEdge,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  buildResNet18Spec,
  validateInputSize,
  accentFor,
  formatParams,
  formatShape,
  type BasicBlockSpec,
  type DiagramNode,
  type Sublayer,
} from "./resnet18-spec";

// ---------------------------------------------------------------------------
// Sublayer visual mapping
// ---------------------------------------------------------------------------

type SublayerType = "conv" | "bn" | "relu" | "maxpool" | "avgpool" | "linear" | "flatten";

const SUBLAYER_COLORS: Record<SublayerType, string> = {
  conv:    "#3b82f6",
  bn:      "#f59e0b",
  relu:    "#ef4444",
  maxpool: "#06b6d4",
  avgpool: "#14b8a6",
  linear:  "#a855f7",
  flatten: "#64748b",
};

const SUBLAYER_LABELS: Record<SublayerType, string> = {
  conv:    "Conv2d",
  bn:      "BN",
  relu:    "ReLU",
  maxpool: "MaxPool",
  avgpool: "AvgPool",
  linear:  "Linear",
  flatten: "Flatten",
};

function classifySublayer(sl: Sublayer): SublayerType {
  if (sl.py.startsWith("nn.Conv2d")) return "conv";
  if (sl.py.startsWith("nn.BatchNorm")) return "bn";
  if (sl.py.startsWith("nn.ReLU")) return "relu";
  if (sl.py.startsWith("nn.MaxPool")) return "maxpool";
  if (sl.py.startsWith("nn.AdaptiveAvgPool")) return "avgpool";
  if (sl.py.startsWith("nn.Linear")) return "linear";
  return "flatten";
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const NODE_W = 110;
const HEADER_H = 28;
const BAND_H = 32;
const X_STEP = 140;

function nodeHeight(spec: DiagramNode): number {
  const count = "sublayers" in spec ? spec.sublayers.length : 0;
  return HEADER_H + Math.max(count, 1) * BAND_H;
}

const LAYOUT: Record<string, { row: 0; col: number }> = {
  input:    { row: 0, col: 0 },
  stem:     { row: 0, col: 1 },
  "bb-1-0": { row: 0, col: 2 },
  "bb-1-1": { row: 0, col: 3 },
  "bb-2-0": { row: 0, col: 4 },
  "bb-2-1": { row: 0, col: 5 },
  "bb-3-0": { row: 0, col: 6 },
  "bb-3-1": { row: 0, col: 7 },
  "bb-4-0": { row: 0, col: 8 },
  "bb-4-1": { row: 0, col: 9 },
  avgpool:  { row: 0, col: 10 },
  fc:       { row: 0, col: 11 },
  output:   { row: 0, col: 12 },
};

// ---------------------------------------------------------------------------
// Node data types
// ---------------------------------------------------------------------------

type DiagramNodeData = {
  spec: DiagramNode;
  accent: string;
  selected: boolean;
  skipSide: "top" | "bottom";
  nodeH: number;
};

type StageRFNode = Node<DiagramNodeData, "stage">;
type BasicBlockRFNode = Node<DiagramNodeData, "basicblock">;
type AnyRFNode = StageRFNode | BasicBlockRFNode;

// ---------------------------------------------------------------------------
// Custom node components
// ---------------------------------------------------------------------------

function NodeShell({
  spec,
  accent,
  selected,
  height,
}: {
  spec: DiagramNode;
  accent: string;
  selected: boolean;
  height: number;
}) {
  const sublayers: readonly Sublayer[] = "sublayers" in spec ? spec.sublayers : [];

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border-2 shadow-sm backdrop-blur-sm transition"
      style={{
        width: NODE_W,
        height,
        borderColor: selected ? accent : `${accent}55`,
        boxShadow: selected ? `0 0 0 4px ${accent}33` : undefined,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ height: HEADER_H, background: `${accent}30` }}
      >
        <span className="text-center text-[10px] font-bold leading-tight tracking-tight" style={{ color: accent }}>
          {spec.label}
        </span>
      </div>
      {sublayers.length > 0 ? (
        <div className="flex flex-1 flex-col">
          {sublayers.map((sl, i) => {
            const slType = classifySublayer(sl);
            const color = SUBLAYER_COLORS[slType];
            const label = SUBLAYER_LABELS[slType];
            return (
              <div
                key={i}
                className="flex flex-1 items-center justify-center"
                style={{ background: `${color}22`, borderTop: `1px solid ${color}30` }}
              >
                <span className="text-[9px] font-semibold" style={{ color }}>{label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center" style={{ background: `${accent}0a` }}>
          <span className="text-center font-mono text-[9px] leading-tight text-foreground/50">
            {spec.kind === "input" ? formatShape(spec.outShape) : spec.kind === "output" ? `${spec.logits}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function StageNodeComp({ data }: NodeProps<StageRFNode>) {
  return (
    <>
      <Handle type="target" position={Position.Left} id="main-in" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="main-out" style={handleStyle} />
      <NodeShell spec={data.spec} accent={data.accent} selected={data.selected} height={data.nodeH} />
    </>
  );
}

function BasicBlockNodeComp({ data }: NodeProps<BasicBlockRFNode>) {
  const skipSrcStyle = {
    ...hiddenHandleStyle,
    left: 12,
    top: -2,
  } as React.CSSProperties;
  const skipDstStyle = {
    ...hiddenHandleStyle,
    left: NODE_W - 12,
    top: -2,
  } as React.CSSProperties;

  return (
    <>
      <Handle type="target" position={Position.Left} id="main-in" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="main-out" style={handleStyle} />
      <Handle type="source" position={Position.Top} id="skip-src" style={skipSrcStyle} />
      <Handle type="target" position={Position.Top} id="skip-dst" style={skipDstStyle} />
      <NodeShell spec={data.spec} accent={data.accent} selected={data.selected} height={data.nodeH} />
    </>
  );
}

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "var(--color-border)",
  border: "none",
};

const hiddenHandleStyle: React.CSSProperties = {
  width: 1,
  height: 1,
  background: "transparent",
  border: "none",
  opacity: 0,
};

const nodeTypes = {
  stage: StageNodeComp,
  basicblock: BasicBlockNodeComp,
};

// ---------------------------------------------------------------------------
// Custom residual edge — a right/left-arcing bezier that hugs the block it
// bypasses, making the skip connection visually distinct from the main flow.
// ---------------------------------------------------------------------------

type ResidualData = { accent: string; downsample: boolean; arcUp: boolean };
type ResidualEdge = Edge<ResidualData, "residual">;

function ResidualEdgeComp({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps<ResidualEdge>) {
  const accent = data?.accent ?? "#94a3b8";
  const downsample = Boolean(data?.downsample);
  const offset = data?.arcUp ? -50 : 50;
  const path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + offset} ${targetX},${targetY + offset} ${targetX},${targetY}`;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2 + offset * 0.9;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: accent,
          strokeWidth: 2,
          strokeDasharray: downsample ? undefined : "5 5",
          opacity: 0.85,
        }}
      />
      <text
        x={midX}
        y={midY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          fill: accent,
          pointerEvents: "none",
        }}
      >
        {downsample ? "1×1 proj" : "identity"}
      </text>
    </>
  );
}

const edgeTypes = {
  residual: ResidualEdgeComp,
};

// ---------------------------------------------------------------------------
// Build the React Flow graph from the spec
// ---------------------------------------------------------------------------

function buildGraph(
  specList: readonly DiagramNode[],
  selectedId: string | null,
): { nodes: AnyRFNode[]; edges: Edge[] } {
  const nodes: AnyRFNode[] = specList.map((spec) => {
    const layout = LAYOUT[spec.id];
    const h = nodeHeight(spec);
    const x = layout.col * X_STEP;
    const data: DiagramNodeData = {
      spec,
      accent: accentFor(spec),
      selected: selectedId === spec.id,
      skipSide: "top",
      nodeH: h,
    };
    return {
      id: spec.id,
      type: spec.kind === "basicblock" ? "basicblock" : "stage",
      position: { x, y: 0 },
      data,
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = [];

  // Main forward flow between consecutive nodes.
  for (let i = 0; i < specList.length - 1; i++) {
    const a = specList[i];
    const b = specList[i + 1];
    edges.push({
      id: `flow-${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
      sourceHandle: "main-out",
      targetHandle: "main-in",
      type: "smoothstep",
      style: { stroke: "var(--color-border)", strokeWidth: 2.5 },
    });
  }

  // Residual skip self-loops on every BasicBlock.
  for (const spec of specList) {
    if (spec.kind !== "basicblock") continue;
    const bb = spec as BasicBlockSpec;
    edges.push({
      id: `skip-${bb.id}`,
      source: bb.id,
      target: bb.id,
      sourceHandle: "skip-src",
      targetHandle: "skip-dst",
      type: "residual",
      data: { accent: accentFor(bb), downsample: bb.downsample, arcUp: true },
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Right sidebar — fixed to viewport edge, playground-style
// ---------------------------------------------------------------------------

const SIDEBAR_DEFAULT = 340;
const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 520;

function kindLabel(spec: DiagramNode): string {
  switch (spec.kind) {
    case "input":       return "Input";
    case "stem":        return "Stem · conv1 + bn1 + relu + maxpool";
    case "basicblock":
      return `BasicBlock · layer${spec.stage}${spec.downsample ? " · with 1×1 downsample" : ""}`;
    case "avgpool":     return "Head · global average pool";
    case "fc":          return "Head · classifier";
    case "output":      return "Output";
  }
}

function DetailSidebar({
  spec,
  onClear,
  width,
  setWidth,
}: {
  spec: DiagramNode | null;
  onClear: () => void;
  width: number;
  setWidth: (w: number | ((prev: number) => number)) => void;
}) {
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const open = width > 0;
  const accent = spec ? accentFor(spec) : "var(--color-border)";
  const sublayers: readonly Sublayer[] =
    spec && "sublayers" in spec ? spec.sublayers : [];

  return (
    <>
      {/* Edge tab */}
      <button
        type="button"
        onClick={() => setWidth((w) => (w > 0 ? 0 : SIDEBAR_DEFAULT))}
        aria-expanded={open}
        aria-controls="resnet-detail-sidebar"
        aria-label={open ? "Close layer details" : "Show layer details"}
        className="fixed top-1/2 z-50 flex h-28 w-10 -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-l-lg border border-r-0 border-border bg-background text-foreground/70 shadow-lg hover:bg-accent/10 hover:text-foreground"
        style={{ right: open ? `${width}px` : 0 }}
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      {/* Sidebar panel */}
      <aside
        id="resnet-detail-sidebar"
        className={`fixed top-0 right-0 z-50 flex h-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: `${width || SIDEBAR_DEFAULT}px` }}
        aria-label="Layer detail sidebar"
      >
        {/* Drag handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current = { startX: e.clientX, startW: width };
            const onMove = (ev: MouseEvent) => {
              if (!dragRef.current) return;
              const delta = dragRef.current.startX - ev.clientX;
              const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragRef.current.startW + delta));
              setWidth(next);
            };
            const onUp = () => {
              dragRef.current = null;
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
            };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          className="absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-accent/30 active:bg-accent/50"
          aria-label="Resize sidebar"
          role="separator"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {spec ? spec.label : "Click a block"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {spec ? (
              <button
                type="button"
                onClick={onClear}
                className="rounded-md px-2 py-0.5 text-[11px] text-foreground/50 transition hover:bg-muted hover:text-foreground"
              >
                clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setWidth(0)}
              aria-label="Close sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition hover:bg-accent/10 hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>
        </div>

        {/* Shape / param summary */}
        {spec ? (
          <div className="shrink-0 border-b border-border/50 px-4 py-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11.5px] text-foreground/80">
              {"inShape" in spec && spec.inShape ? (
                <>
                  <dt className="text-foreground/50">in</dt>
                  <dd>{formatShape(spec.inShape)}</dd>
                </>
              ) : null}
              {"outShape" in spec && spec.outShape ? (
                <>
                  <dt className="text-foreground/50">out</dt>
                  <dd>{formatShape(spec.outShape)}</dd>
                </>
              ) : null}
              {spec.kind === "fc" ? (
                <>
                  <dt className="text-foreground/50">out</dt>
                  <dd>{spec.outFeatures}</dd>
                </>
              ) : null}
              {spec.kind === "output" ? (
                <>
                  <dt className="text-foreground/50">out</dt>
                  <dd>{spec.logits} logits</dd>
                </>
              ) : null}
              {spec.params > 0 ? (
                <>
                  <dt className="text-foreground/50">params</dt>
                  <dd>
                    {spec.params.toLocaleString()}{" "}
                    <span className="text-foreground/40">({formatParams(spec.params)})</span>
                  </dd>
                </>
              ) : null}
            </dl>
          </div>
        ) : null}

        {/* Sublayers */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {sublayers.length > 0 ? (
            <>
              <div className="text-[10px] font-semibold tracking-wide text-foreground/45 uppercase">
                PyTorch modules
              </div>
              <ul className="mt-2 space-y-3">
                {sublayers.map((sl) => {
                  const slType = classifySublayer(sl);
                  const color = SUBLAYER_COLORS[slType];
                  return (
                    <li key={sl.name}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                        <span className="text-[11px] font-semibold" style={{ color }}>{SUBLAYER_LABELS[slType]}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap pl-[18px] font-mono text-[11.5px] leading-relaxed text-foreground/85">
                        {sl.py}
                      </div>
                      {sl.note ? (
                        <div className="mt-0.5 pl-[18px] text-[10.5px] text-foreground/50 italic">{sl.note}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : spec ? (
            <div className="text-[12px] text-foreground/55">No learnable submodules.</div>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-foreground/60">
              Every node maps to an actual{" "}
              <code className="font-mono">nn.Module</code> from{" "}
              <code className="font-mono">torchvision.models.resnet18()</code>.
            </p>
          )}
        </div>

        {/* Legend footer */}
        <div className="shrink-0 border-t border-border/50 bg-muted/20 px-4 py-3">
          <div className="text-[10px] font-semibold tracking-wide text-foreground/45 uppercase">
            Sublayer colors
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {(Object.keys(SUBLAYER_COLORS) as SublayerType[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-sm" style={{ background: SUBLAYER_COLORS[t] }} />
                <span className="text-[10px] text-foreground/60">{SUBLAYER_LABELS[t]}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

interface FlowCanvasProps {
  specList: readonly DiagramNode[];
  totalParams: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHoverChange: (id: string | null) => void;
}

function FlowCanvas({ specList, totalParams, selectedId, onSelect, onHoverChange }: FlowCanvasProps) {
  const { nodes, edges } = useMemo(() => buildGraph(specList, selectedId), [specList, selectedId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelect(node.id);
    },
    [onSelect],
  );

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onHoverChange(node.id);
    },
    [onHoverChange],
  );

  const onNodeMouseLeave = useCallback(() => {
    onHoverChange(null);
  }, [onHoverChange]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3}
      maxZoom={1.8}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onPaneClick={() => onSelect(null)}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="var(--color-border)"
      />
      <Controls
        position="bottom-left"
        showInteractive={false}
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
        }}
      />
      <Panel position="top-left">
        <div className="pointer-events-none rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur">
          <div className="font-semibold text-foreground/80">
            torchvision.models.resnet18()
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

const DEFAULT_H = 224;
const DEFAULT_W = 224;

export function ResNet18Diagram() {
  // Applied dimensions — what the diagram currently shows.
  const [appliedH, setAppliedH] = useState(DEFAULT_H);
  const [appliedW, setAppliedW] = useState(DEFAULT_W);

  // Draft dimensions — what the user is typing before hitting Apply.
  const [draftH, setDraftH] = useState(String(DEFAULT_H));
  const [draftW, setDraftW] = useState(String(DEFAULT_W));

  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>("bb-2-0");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(0);

  const { spec: specList, totalParams } = useMemo(
    () => buildResNet18Spec(appliedH, appliedW),
    [appliedH, appliedW],
  );

  const activeId = hoverId ?? selectedId;
  const activeSpec = useMemo(
    () => specList.find((n) => n.id === activeId) ?? null,
    [specList, activeId],
  );

  const handleApply = () => {
    const h = parseInt(draftH, 10);
    const w = parseInt(draftW, 10);

    if (Number.isNaN(h) || Number.isNaN(w)) {
      setError("Height and width must be numbers.");
      return;
    }

    const msg = validateInputSize(h, w);
    if (msg) {
      setError(msg);
      return;
    }

    setError(null);
    setAppliedH(h);
    setAppliedW(w);
  };

  const handleReset = () => {
    setDraftH(String(DEFAULT_H));
    setDraftW(String(DEFAULT_W));
    setError(null);
    setAppliedH(DEFAULT_H);
    setAppliedW(DEFAULT_W);
  };

  const draftsMatchApplied =
    parseInt(draftH, 10) === appliedH && parseInt(draftW, 10) === appliedW;

  return (
    <figure className="my-8">
      {/* Input size controls */}
      <div className="mb-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-semibold tracking-wide text-foreground/55 uppercase">
            Input size
          </span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="resnet-h" className="text-[12px] text-foreground/50">H</label>
            <input
              id="resnet-h"
              type="number"
              value={draftH}
              onChange={(e) => { setDraftH(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[72px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <span className="text-foreground/30">&times;</span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="resnet-w" className="text-[12px] text-foreground/50">W</label>
            <input
              id="resnet-w"
              type="number"
              value={draftW}
              onChange={(e) => { setDraftW(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[72px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={draftsMatchApplied && !error}
            className="rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-white transition hover:bg-accent/80 disabled:opacity-40 disabled:cursor-default"
          >
            Apply
          </button>
          {(appliedH !== DEFAULT_H || appliedW !== DEFAULT_W) && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md px-2 py-0.5 text-[11px] text-foreground/50 transition hover:bg-muted hover:text-foreground"
            >
              reset to 224
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-[12px] leading-relaxed text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="h-[620px] overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        <ReactFlowProvider>
          <FlowCanvas
            specList={specList}
            totalParams={totalParams}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onHoverChange={setHoverId}
          />
        </ReactFlowProvider>
      </div>

      <DetailSidebar
        spec={activeSpec}
        onClear={() => setSelectedId(null)}
        width={sidebarWidth}
        setWidth={setSidebarWidth}
      />
    </figure>
  );
}
