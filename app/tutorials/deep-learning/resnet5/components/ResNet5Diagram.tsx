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
  buildResNet5Spec,
  validateConfig,
  accentFor,
  formatParams,
  formatShape,
  STAGE_ACCENTS,
  DEFAULT_CONFIG,
  type DiagramNode,
  type ResBlockSpec,
  type ResNet5Config,
  type Sublayer,
} from "./resnet5-spec";

// ---------------------------------------------------------------------------
// Sublayer visual mapping
// ---------------------------------------------------------------------------

type SublayerType = "conv" | "bn" | "relu" | "avgpool" | "flatten";

const SUBLAYER_COLORS: Record<SublayerType, string> = {
  conv:    "#3b82f6",
  bn:      "#f59e0b",
  relu:    "#ef4444",
  avgpool: "#14b8a6",
  flatten: "#64748b",
};

const SUBLAYER_LABELS: Record<SublayerType, string> = {
  conv:    "Conv2d",
  bn:      "BN",
  relu:    "ReLU",
  avgpool: "AvgPool",
  flatten: "Flatten",
};

function classifySublayer(sl: Sublayer): SublayerType {
  if (sl.py.startsWith("nn.Conv2d")) return "conv";
  if (sl.py.startsWith("nn.BatchNorm")) return "bn";
  if (sl.py.startsWith("nn.ReLU")) return "relu";
  if (sl.py.startsWith("nn.AdaptiveAvgPool")) return "avgpool";
  return "flatten";
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_W = 72;
const HEADER_H = 36;
const BAND_H = 24;
const X_STEP = 180;

function nodeBoxHeight(spec: DiagramNode): number {
  const count = "sublayers" in spec ? spec.sublayers.length : 0;
  if (count > 0) return count * BAND_H;
  return HEADER_H + BAND_H;
}

function nodeHeight(spec: DiagramNode): number {
  return HEADER_H + nodeBoxHeight(spec);
}

// ---------------------------------------------------------------------------
// Node data types
// ---------------------------------------------------------------------------

type DiagramNodeData = {
  spec: DiagramNode;
  accent: string;
  selected: boolean;
  nodeH: number;
  labelTop: number;
};

type LayerGroupData = {
  accent: string;
  label: string;
  w: number;
  h: number;
};

type StageRFNode = Node<DiagramNodeData, "stage">;
type ResBlockRFNode = Node<DiagramNodeData, "resblock">;
type LayerGroupRFNode = Node<LayerGroupData, "layerGroup">;
type AnyRFNode = StageRFNode | ResBlockRFNode | LayerGroupRFNode;

// ---------------------------------------------------------------------------
// Custom node components
// ---------------------------------------------------------------------------

function LayerGroupComp({ data }: NodeProps<LayerGroupRFNode>) {
  return (
    <div style={{ position: "relative", width: data.w, height: data.h }}>
      <span
        className="absolute left-0 text-[36px] font-bold tracking-wide"
        style={{ color: data.accent, top: -50 }}
      >
        {data.label}
      </span>
      <div
        className="rounded-2xl border"
        style={{
          width: data.w,
          height: data.h,
          borderColor: `${data.accent}40`,
          background: `${data.accent}08`,
        }}
      />
    </div>
  );
}

function NodeShell({
  spec,
  accent,
  selected,
  height,
  labelTop,
}: {
  spec: DiagramNode;
  accent: string;
  selected: boolean;
  height: number;
  labelTop: number;
}) {
  const sublayers: readonly Sublayer[] = "sublayers" in spec ? spec.sublayers : [];
  const boxH = height - HEADER_H;

  return (
    <div style={{ position: "relative", width: NODE_W, height }}>
      <span
        className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-bold tracking-wide ${
          spec.kind === "resblock" ? "text-[16px]" : "text-[36px]"
        }`}
        style={{ color: accent, top: labelTop }}
      >
        {spec.label}
      </span>
      <div
        className="absolute bottom-0 flex flex-col overflow-hidden rounded-xl border-2 shadow-sm backdrop-blur-sm transition"
        style={{
          width: NODE_W,
          height: boxH,
          borderColor: selected ? accent : `${accent}55`,
          boxShadow: selected ? `0 0 0 4px ${accent}33` : undefined,
        }}
      >
        {sublayers.length > 0 ? (
          <div className="flex flex-1 flex-col">
            {sublayers.map((sl, i) => {
              const slType = classifySublayer(sl);
              const color = SUBLAYER_COLORS[slType];
              return (
                <div
                  key={i}
                  className="flex flex-1 items-center justify-center"
                  style={{ background: `${color}22`, borderTop: i > 0 ? `1px solid ${color}30` : undefined }}
                >
                  <span className="text-[8px] font-semibold leading-none" style={{ color }}>{SUBLAYER_LABELS[slType]}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center" style={{ background: `${accent}0a` }} />
        )}
      </div>
    </div>
  );
}

function handleTopForSpec(spec: DiagramNode): number {
  const boxH = nodeBoxHeight(spec);
  return HEADER_H + boxH / 2;
}

const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
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

function StageNodeComp({ data }: NodeProps<StageRFNode>) {
  const hTop = handleTopForSpec(data.spec);
  const mainHandleStyle = { ...handleStyle, top: hTop };
  return (
    <>
      <Handle type="target" position={Position.Left} id="main-in" style={mainHandleStyle} />
      <Handle type="source" position={Position.Right} id="main-out" style={mainHandleStyle} />
      <NodeShell spec={data.spec} accent={data.accent} selected={data.selected} height={data.nodeH} labelTop={data.labelTop} />
    </>
  );
}

function ResBlockNodeComp({ data }: NodeProps<ResBlockRFNode>) {
  const hTop = handleTopForSpec(data.spec);
  const mainHandleStyle = { ...handleStyle, top: hTop };
  const skipSrcStyle = { ...hiddenHandleStyle, left: -1, top: hTop } as React.CSSProperties;
  const skipDstStyle = { ...hiddenHandleStyle, left: NODE_W + 1, top: hTop } as React.CSSProperties;

  return (
    <>
      <Handle type="target" position={Position.Left} id="main-in" style={mainHandleStyle} />
      <Handle type="source" position={Position.Right} id="main-out" style={mainHandleStyle} />
      <Handle type="source" position={Position.Left} id="skip-src" style={skipSrcStyle} />
      <Handle type="target" position={Position.Right} id="skip-dst" style={skipDstStyle} />
      <NodeShell spec={data.spec} accent={data.accent} selected={data.selected} height={data.nodeH} labelTop={data.labelTop} />
    </>
  );
}

const nodeTypes = {
  stage: StageNodeComp,
  resblock: ResBlockNodeComp,
  layerGroup: LayerGroupComp,
};

// ---------------------------------------------------------------------------
// Residual edge
// ---------------------------------------------------------------------------

type ResidualData = { downsample: boolean; nodeH: number };
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
  const downsample = Boolean(data?.downsample);
  const nodeH = data?.nodeH ?? 300;
  const hPad = 30;
  const topY = sourceY - nodeH / 2 - 60;
  const path = `M ${sourceX - hPad},${sourceY} L ${sourceX - hPad},${topY} L ${targetX + hPad},${topY} L ${targetX + hPad},${targetY}`;
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: "#94a3b8",
        strokeWidth: 2,
        strokeDasharray: downsample ? "6 4" : undefined,
      }}
    />
  );
}

const edgeTypes = { residual: ResidualEdgeComp };

// ---------------------------------------------------------------------------
// Build the React Flow graph
// ---------------------------------------------------------------------------

const GROUP_PAD_X = 50;
const GROUP_PAD_TOP = 140;
const GROUP_PAD_BOTTOM = 40;

function buildGraph(
  specList: readonly DiagramNode[],
  selectedId: string | null,
): { nodes: AnyRFNode[]; edges: Edge[] } {
  const LAYOUT: Record<string, { col: number }> = {
    input:   { col: 0 },
    stem:    { col: 1 },
    layer1:  { col: 2 },
    layer2:  { col: 3 },
    layer3:  { col: 4 },
    avgpool: { col: 5 },
    output:  { col: 6 },
  };

  const hasAvgPool = specList.some((n) => n.kind === "avgpool");
  if (!hasAvgPool) LAYOUT.output = { col: 5 };

  const maxH = Math.max(...specList.map(nodeHeight));
  const nodes: AnyRFNode[] = [];

  // Group box around the 3 residual blocks
  const LAYER_GROUPS = [
    { id: "grp-blocks", label: "Residual Blocks", accent: "#a855f7", blocks: ["layer1", "layer2", "layer3"] },
  ];

  const blockToGroup = new Map<string, string>();
  for (const grp of LAYER_GROUPS) {
    for (const b of grp.blocks) blockToGroup.set(b, grp.id);
  }

  for (const grp of LAYER_GROUPS) {
    const cols = grp.blocks.map((b) => LAYOUT[b].col);
    const col0 = Math.min(...cols);
    const col1 = Math.max(...cols);
    const grpX = col0 * X_STEP - GROUP_PAD_X;
    const grpY = -GROUP_PAD_TOP;
    const grpW = (col1 - col0) * X_STEP + NODE_W + GROUP_PAD_X * 2;
    const grpH = maxH + GROUP_PAD_TOP + GROUP_PAD_BOTTOM;

    nodes.push({
      id: grp.id,
      type: "layerGroup",
      position: { x: grpX, y: grpY },
      data: { accent: grp.accent, label: grp.label, w: grpW, h: grpH },
      draggable: false,
      selectable: false,
      zIndex: -1,
      style: { width: grpW, height: grpH },
    } as LayerGroupRFNode);
  }

  for (const spec of specList) {
    const layout = LAYOUT[spec.id];
    if (!layout) continue;
    const totalH = nodeHeight(spec);
    const x = layout.col * X_STEP;
    const y = (maxH - totalH) / 2;
    const groupId = blockToGroup.get(spec.id);

    const labelAbsY = -GROUP_PAD_TOP - 50;
    const labelTop = groupId ? 0 : labelAbsY - y;

    const data: DiagramNodeData = {
      spec,
      accent: accentFor(spec),
      selected: selectedId === spec.id,
      nodeH: totalH,
      labelTop,
    };

    const node = {
      id: spec.id,
      type: spec.kind === "resblock" ? "resblock" : "stage",
      position: groupId
        ? { x: x - nodes.find((n) => n.id === groupId)!.position.x, y: y - nodes.find((n) => n.id === groupId)!.position.y }
        : { x, y },
      data,
      draggable: false,
      selectable: true,
      ...(groupId ? { parentId: groupId, extent: "parent" as const } : {}),
    };
    nodes.push(node as AnyRFNode);
  }

  // Forward flow edges
  const edges: Edge[] = [];
  for (let i = 0; i < specList.length - 1; i++) {
    edges.push({
      id: `flow-${specList[i].id}-${specList[i + 1].id}`,
      source: specList[i].id,
      target: specList[i + 1].id,
      sourceHandle: "main-out",
      targetHandle: "main-in",
      type: "straight",
      style: { stroke: "var(--color-border)", strokeWidth: 3 },
    });
  }

  // Skip-connection self-loops on each ResidualBlock
  for (const spec of specList) {
    if (spec.kind !== "resblock") continue;
    edges.push({
      id: `skip-${spec.id}`,
      source: spec.id,
      target: spec.id,
      sourceHandle: "skip-src",
      targetHandle: "skip-dst",
      type: "residual",
      data: { downsample: spec.downsample, nodeH: nodeHeight(spec) },
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Detail sidebar
// ---------------------------------------------------------------------------

const SIDEBAR_DEFAULT = 340;
const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 520;

function SublayerList({ title, sublayers }: { title: string; sublayers: readonly Sublayer[] }) {
  return (
    <>
      <div className="text-[10px] font-semibold tracking-wide text-foreground/45 uppercase">
        {title}
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
  );
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
  const sublayers: readonly Sublayer[] = spec && "sublayers" in spec ? spec.sublayers : [];
  const scSublayers: readonly Sublayer[] = spec && "shortcutSublayers" in spec ? spec.shortcutSublayers : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setWidth((w) => (w > 0 ? 0 : SIDEBAR_DEFAULT))}
        aria-expanded={open}
        aria-controls="resnet5-detail-sidebar"
        aria-label={open ? "Close layer details" : "Show layer details"}
        className="fixed top-1/2 z-50 flex h-28 w-10 -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-l-lg border border-r-0 border-border bg-background text-foreground/70 shadow-lg hover:bg-accent/10 hover:text-foreground"
        style={{ right: open ? `${width}px` : 0 }}
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      <aside
        id="resnet5-detail-sidebar"
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
            {spec?.kind === "resblock" && (
              <span className="text-[11px] text-foreground/50">
                ResidualBlock{spec.downsample ? " · 1x1 shortcut" : " · identity shortcut"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {spec ? (
              <button type="button" onClick={onClear} className="rounded-md px-2 py-0.5 text-[11px] text-foreground/50 transition hover:bg-muted hover:text-foreground">
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
            <div className="space-y-5">
              <SublayerList title="Main path" sublayers={sublayers} />
              {scSublayers.length > 0 && (
                <SublayerList title="Shortcut (skip branch)" sublayers={scSublayers} />
              )}
            </div>
          ) : spec ? (
            <div className="text-[12px] text-foreground/55">No learnable submodules.</div>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-foreground/60">
              Every node maps to an actual{" "}
              <code className="font-mono">nn.Module</code> from{" "}
              <code className="font-mono">ResNet5</code>.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Flow canvas
// ---------------------------------------------------------------------------

function FlowCanvas({
  specList,
  totalParams,
  selectedId,
  onSelect,
  onHoverChange,
}: {
  specList: readonly DiagramNode[];
  totalParams: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHoverChange: (id: string | null) => void;
}) {
  const { nodes, edges } = useMemo(() => buildGraph(specList, selectedId), [specList, selectedId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { onSelect(node.id); }, [onSelect]);
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => { onHoverChange(node.id); }, [onHoverChange]);
  const onNodeMouseLeave = useCallback(() => { onHoverChange(null); }, [onHoverChange]);

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
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--color-border)" />
      <Controls
        position="bottom-left"
        showInteractive={false}
        style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 8 }}
      />
      <Panel position="top-left">
        <div className="pointer-events-none rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur">
          <div className="font-semibold text-foreground/80">ResNet5</div>
          <div className="text-foreground/50">{formatParams(totalParams)} parameters</div>
        </div>
      </Panel>
      <Panel position="bottom-right">
        <div className="pointer-events-none rounded-xl border border-border/60 bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur">
          <div className="text-[10px] font-semibold tracking-wide text-foreground/45 uppercase mb-1.5">Module types</div>
          <div className="flex flex-col gap-1">
            {(Object.keys(SUBLAYER_COLORS) as SublayerType[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SUBLAYER_COLORS[t] }} />
                <span className="text-[11px] text-foreground/70">{SUBLAYER_LABELS[t]}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-semibold tracking-wide text-foreground/45 uppercase mt-2.5 mb-1.5">Skip connections</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <svg width="20" height="6" className="shrink-0"><line x1="0" y1="3" x2="20" y2="3" stroke="#94a3b8" strokeWidth="2" /></svg>
              <span className="text-[11px] text-foreground/70">Identity</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="6" className="shrink-0"><line x1="0" y1="3" x2="20" y2="3" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" /></svg>
              <span className="text-[11px] text-foreground/70">1x1 Projection</span>
            </div>
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function ResNet5Diagram() {
  const [config, setConfig] = useState<ResNet5Config>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState<ResNet5Config>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(0);

  const { spec: specList, totalParams } = useMemo(() => buildResNet5Spec(config), [config]);

  const activeId = hoverId ?? selectedId;
  const activeSpec = useMemo(() => specList.find((n) => n.id === activeId) ?? null, [specList, activeId]);

  const handleApply = () => {
    const msg = validateConfig(draft);
    if (msg) { setError(msg); return; }
    setError(null);
    setConfig({ ...draft });
  };

  const handleReset = () => {
    setDraft(DEFAULT_CONFIG);
    setError(null);
    setConfig(DEFAULT_CONFIG);
  };

  const draftsMatchApplied =
    draft.in_d === config.in_d && draft.h_d === config.h_d && draft.out_d === config.out_d &&
    draft.s1 === config.s1 && draft.s2 === config.s2 && draft.s3 === config.s3 &&
    draft.avg_pool === config.avg_pool && draft.inputH === config.inputH && draft.inputW === config.inputW;

  const updateDraft = (patch: Partial<ResNet5Config>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  return (
    <figure className="my-8">
      {/* Controls */}
      <div className="mb-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-semibold tracking-wide text-foreground/55 uppercase">Config</span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-in_d" className="text-[12px] text-foreground/50">in_d</label>
            <input id="r5-in_d" type="number" min={1} value={draft.in_d}
              onChange={(e) => updateDraft({ in_d: parseInt(e.target.value, 10) || 1 })}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[56px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-h_d" className="text-[12px] text-foreground/50">h_d</label>
            <input id="r5-h_d" type="number" min={1} value={draft.h_d}
              onChange={(e) => updateDraft({ h_d: parseInt(e.target.value, 10) || 1 })}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[56px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-out_d" className="text-[12px] text-foreground/50">out_d</label>
            <input id="r5-out_d" type="number" min={1} value={draft.out_d}
              onChange={(e) => updateDraft({ out_d: parseInt(e.target.value, 10) || 1 })}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[56px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none" />
          </div>

          <span className="text-foreground/30">|</span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-s1" className="text-[12px] text-foreground/50">s1</label>
            <select id="r5-s1" value={draft.s1} onChange={(e) => updateDraft({ s1: Number(e.target.value) })}
              className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none">
              <option value={1}>1</option><option value={2}>2</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-s2" className="text-[12px] text-foreground/50">s2</label>
            <select id="r5-s2" value={draft.s2} onChange={(e) => updateDraft({ s2: Number(e.target.value) })}
              className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none">
              <option value={1}>1</option><option value={2}>2</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-s3" className="text-[12px] text-foreground/50">s3</label>
            <select id="r5-s3" value={draft.s3} onChange={(e) => updateDraft({ s3: Number(e.target.value) })}
              className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none">
              <option value={1}>1</option><option value={2}>2</option>
            </select>
          </div>

          <span className="text-foreground/30">|</span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-H" className="text-[12px] text-foreground/50">H</label>
            <input id="r5-H" type="number" min={1} value={draft.inputH}
              onChange={(e) => updateDraft({ inputH: parseInt(e.target.value, 10) || 1 })}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[56px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="r5-W" className="text-[12px] text-foreground/50">W</label>
            <input id="r5-W" type="number" min={1} value={draft.inputW}
              onChange={(e) => updateDraft({ inputW: parseInt(e.target.value, 10) || 1 })}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="w-[56px] rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[13px] text-foreground focus:border-accent focus:outline-none" />
          </div>

          <span className="text-foreground/30">|</span>

          <label className="flex items-center gap-1.5 text-[12px] text-foreground/50 cursor-pointer">
            <input type="checkbox" checked={draft.avg_pool} onChange={(e) => updateDraft({ avg_pool: e.target.checked })} className="rounded border-border" />
            avg_pool
          </label>

          <button type="button" onClick={handleApply} disabled={draftsMatchApplied && !error}
            className="rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-white transition hover:bg-accent/80 disabled:opacity-40 disabled:cursor-default">
            Apply
          </button>
          {!draftsMatchApplied && (
            <button type="button" onClick={handleReset}
              className="rounded-md px-2 py-0.5 text-[11px] text-foreground/50 transition hover:bg-muted hover:text-foreground">
              reset
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-[12px] leading-relaxed text-red-400" role="alert">{error}</p>}
      </div>

      {/* Diagram */}
      <div className="h-[620px] overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        <ReactFlowProvider>
          <FlowCanvas specList={specList} totalParams={totalParams} selectedId={selectedId} onSelect={setSelectedId} onHoverChange={setHoverId} />
        </ReactFlowProvider>
      </div>

      <DetailSidebar spec={activeSpec} onClear={() => setSelectedId(null)} width={sidebarWidth} setWidth={setSidebarWidth} />
    </figure>
  );
}
