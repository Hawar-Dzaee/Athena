/**
 * A declarative spec for `ResNet5` — a lightweight ResNet with a stem
 * convolution and 3 residual blocks.
 *
 * Architecture:
 *   Conv2d(in_d, h_d, 3, stride=1, padding=1) → BN → ReLU
 *   → ResidualBlock(h_d,   h_d,   stride=s1)
 *   → ResidualBlock(h_d,   h_d*2, stride=s2)
 *   → ResidualBlock(h_d*2, out_d, stride=s3)
 *   → [AdaptiveAvgPool2d((1,1)) + flatten]  (optional)
 *
 * Each ResidualBlock contains:
 *   conv1(3×3, stride) → bn1 → relu → conv2(3×3, stride=1) → bn2 → (+shortcut) → relu
 *   shortcut = 1×1 conv + BN if stride != 1 or in_channels != out_channels
 *
 * Parameter counts are computed symbolically from the layer dimensions.
 */

export type Shape = readonly number[];

export interface Sublayer {
  readonly name: string;
  readonly py: string;
  readonly params: number;
  readonly note?: string;
}

interface BaseNode {
  readonly id: string;
  readonly label: string;
  readonly params: number;
}

export interface InputNode extends BaseNode {
  readonly kind: "input";
  readonly outShape: Shape;
}

export interface StemNode extends BaseNode {
  readonly kind: "stem";
  readonly inShape: Shape;
  readonly outShape: Shape;
  readonly sublayers: readonly Sublayer[];
}

export interface ResBlockSpec extends BaseNode {
  readonly kind: "resblock";
  readonly layerIndex: 1 | 2 | 3;
  readonly inShape: Shape;
  readonly outShape: Shape;
  readonly stride: number;
  readonly downsample: boolean;
  readonly sublayers: readonly Sublayer[];
  readonly shortcutSublayers: readonly Sublayer[];
}

export interface AvgPoolNode extends BaseNode {
  readonly kind: "avgpool";
  readonly inShape: Shape;
  readonly outShape: Shape;
  readonly sublayers: readonly Sublayer[];
}

export interface OutputNode extends BaseNode {
  readonly kind: "output";
  readonly outShape: Shape;
}

export type DiagramNode =
  | InputNode
  | StemNode
  | ResBlockSpec
  | AvgPoolNode
  | OutputNode;

// --- parameter-count helpers -------------------------------------------------

const conv = (inC: number, outC: number, k: number) => inC * outC * k * k;
const bn = (c: number) => c * 2;

function resBlockParams(inC: number, outC: number, downsample: boolean): number {
  let total = 0;
  total += conv(inC, outC, 3) + bn(outC);
  total += conv(outC, outC, 3) + bn(outC);
  if (downsample) total += conv(inC, outC, 1) + bn(outC);
  return total;
}

function mainPathSublayers(
  name: string,
  inC: number,
  outC: number,
  stride: number,
): Sublayer[] {
  return [
    {
      name: `${name}.conv1`,
      py: `nn.Conv2d(\n    ${inC}, ${outC},\n    kernel_size=3,\n    stride=${stride},\n    padding=1,\n    bias=False\n)`,
      params: conv(inC, outC, 3),
    },
    {
      name: `${name}.bn1`,
      py: `nn.BatchNorm2d(${outC})`,
      params: bn(outC),
    },
    {
      name: "relu",
      py: "nn.ReLU(inplace=True)",
      params: 0,
      note: "shared; used after bn1 and again after the residual sum",
    },
    {
      name: `${name}.conv2`,
      py: `nn.Conv2d(\n    ${outC}, ${outC},\n    kernel_size=3,\n    stride=1,\n    padding=1,\n    bias=False\n)`,
      params: conv(outC, outC, 3),
    },
    {
      name: `${name}.bn2`,
      py: `nn.BatchNorm2d(${outC})`,
      params: bn(outC),
    },
  ];
}

function makeShortcutSublayers(
  name: string,
  inC: number,
  outC: number,
  stride: number,
  downsample: boolean,
): Sublayer[] {
  if (!downsample) {
    return [{ name: `${name}.shortcut`, py: "nn.Sequential()  # identity", params: 0, note: "input passes through unchanged" }];
  }
  return [
    {
      name: `${name}.shortcut.0`,
      py: `nn.Conv2d(\n    ${inC}, ${outC},\n    kernel_size=1,\n    stride=${stride},\n    bias=False\n)`,
      params: conv(inC, outC, 1),
      note: "1x1 projection to match main branch shape",
    },
    {
      name: `${name}.shortcut.1`,
      py: `nn.BatchNorm2d(${outC})`,
      params: bn(outC),
    },
  ];
}

// --- spatial-dimension helpers ------------------------------------------------

const spatialOut = (x: number, k: number, s: number, p: number) =>
  Math.floor((x + 2 * p - k) / s) + 1;

// --- config ------------------------------------------------------------------

export interface ResNet5Config {
  in_d: number;
  h_d: number;
  out_d: number;
  s1: number;
  s2: number;
  s3: number;
  avg_pool: boolean;
  inputH: number;
  inputW: number;
}

export const DEFAULT_CONFIG: ResNet5Config = {
  in_d: 3,
  h_d: 64,
  out_d: 256,
  s1: 1,
  s2: 2,
  s3: 2,
  avg_pool: true,
  inputH: 32,
  inputW: 32,
};

export function validateConfig(cfg: ResNet5Config): string | null {
  const { in_d, h_d, out_d, s1, s2, s3, inputH, inputW } = cfg;
  if (in_d < 1 || h_d < 1 || out_d < 1) return "Channel dimensions must be >= 1.";
  if (inputH < 1 || inputW < 1) return "Spatial dimensions must be >= 1.";
  if (![1, 2].includes(s1) || ![1, 2].includes(s2) || ![1, 2].includes(s3))
    return "Strides must be 1 or 2.";

  let h = inputH, w = inputW;
  h = spatialOut(h, 3, 1, 1);
  w = spatialOut(w, 3, 1, 1);

  h = spatialOut(h, 3, s1, 1);
  w = spatialOut(w, 3, s1, 1);
  if (h < 1 || w < 1) return `Spatial dims collapse at layer1 (stride=${s1}). Try a larger input.`;

  h = spatialOut(h, 3, s2, 1);
  w = spatialOut(w, 3, s2, 1);
  if (h < 1 || w < 1) return `Spatial dims collapse at layer2 (stride=${s2}). Try a larger input.`;

  h = spatialOut(h, 3, s3, 1);
  w = spatialOut(w, 3, s3, 1);
  if (h < 1 || w < 1) return `Spatial dims collapse at layer3 (stride=${s3}). Try a larger input.`;

  return null;
}

// --- build spec --------------------------------------------------------------

export function buildResNet5Spec(cfg: ResNet5Config): {
  spec: readonly DiagramNode[];
  totalParams: number;
} {
  const { in_d, h_d, out_d, s1, s2, s3, avg_pool, inputH, inputW } = cfg;

  const stemH = spatialOut(inputH, 3, 1, 1);
  const stemW = spatialOut(inputW, 3, 1, 1);
  const l1H = spatialOut(stemH, 3, s1, 1);
  const l1W = spatialOut(stemW, 3, s1, 1);
  const l2H = spatialOut(l1H, 3, s2, 1);
  const l2W = spatialOut(l1W, 3, s2, 1);
  const l3H = spatialOut(l2H, 3, s3, 1);
  const l3W = spatialOut(l2W, 3, s3, 1);

  const l1Down = s1 !== 1;
  const l2Down = true; // h_d → h_d*2 always needs projection
  const l3Down = s3 !== 1 || h_d * 2 !== out_d;

  const stem: StemNode = {
    kind: "stem",
    id: "stem",
    label: "Stem",
    inShape: [in_d, inputH, inputW],
    outShape: [h_d, stemH, stemW],
    params: conv(in_d, h_d, 3) + bn(h_d),
    sublayers: [
      {
        name: "conv1",
        py: `nn.Conv2d(\n    ${in_d}, ${h_d},\n    kernel_size=3,\n    stride=1,\n    padding=1,\n    bias=False\n)`,
        params: conv(in_d, h_d, 3),
      },
      { name: "bn1", py: `nn.BatchNorm2d(${h_d})`, params: bn(h_d) },
      { name: "relu", py: "nn.ReLU(inplace=True)", params: 0 },
    ],
  };

  const layer1: ResBlockSpec = {
    kind: "resblock",
    id: "layer1",
    label: "layer1",
    layerIndex: 1,
    inShape: [h_d, stemH, stemW],
    outShape: [h_d, l1H, l1W],
    stride: s1,
    downsample: l1Down,
    params: resBlockParams(h_d, h_d, l1Down),
    sublayers: mainPathSublayers("layer1", h_d, h_d, s1),
    shortcutSublayers: makeShortcutSublayers("layer1", h_d, h_d, s1, l1Down),
  };

  const layer2: ResBlockSpec = {
    kind: "resblock",
    id: "layer2",
    label: "layer2",
    layerIndex: 2,
    inShape: [h_d, l1H, l1W],
    outShape: [h_d * 2, l2H, l2W],
    stride: s2,
    downsample: l2Down,
    params: resBlockParams(h_d, h_d * 2, l2Down),
    sublayers: mainPathSublayers("layer2", h_d, h_d * 2, s2),
    shortcutSublayers: makeShortcutSublayers("layer2", h_d, h_d * 2, s2, l2Down),
  };

  const layer3: ResBlockSpec = {
    kind: "resblock",
    id: "layer3",
    label: "layer3",
    layerIndex: 3,
    inShape: [h_d * 2, l2H, l2W],
    outShape: [out_d, l3H, l3W],
    stride: s3,
    downsample: l3Down,
    params: resBlockParams(h_d * 2, out_d, l3Down),
    sublayers: mainPathSublayers("layer3", h_d * 2, out_d, s3),
    shortcutSublayers: makeShortcutSublayers("layer3", h_d * 2, out_d, s3, l3Down),
  };

  const nodes: DiagramNode[] = [
    { kind: "input", id: "input", label: "Input", outShape: [in_d, inputH, inputW], params: 0 },
    stem,
    layer1,
    layer2,
    layer3,
  ];

  if (avg_pool) {
    nodes.push({
      kind: "avgpool",
      id: "avgpool",
      label: "AvgPool",
      inShape: [out_d, l3H, l3W],
      outShape: [out_d],
      params: 0,
      sublayers: [
        { name: "avgpool", py: "nn.AdaptiveAvgPool2d((1, 1))", params: 0, note: `collapses ${l3H}x${l3W} feature map to 1x1` },
        { name: "flatten", py: "out.flatten(1)", params: 0, note: `-> length-${out_d} vector per sample` },
      ],
    });
  }

  nodes.push({
    kind: "output",
    id: "output",
    label: "Output",
    outShape: avg_pool ? [out_d] : [out_d, l3H, l3W],
    params: 0,
  });

  const totalParams = nodes.reduce((sum, n) => sum + n.params, 0);
  return { spec: nodes, totalParams };
}

// --- visual helpers ----------------------------------------------------------

export const STAGE_ACCENTS = {
  input:   "#94a3b8",
  stem:    "#f59e0b",
  layer1:  "#f43f5e",
  layer2:  "#a855f7",
  layer3:  "#06b6d4",
  avgpool: "#14b8a6",
  output:  "#94a3b8",
} as const;

export function accentFor(n: DiagramNode): string {
  switch (n.kind) {
    case "input":    return STAGE_ACCENTS.input;
    case "stem":     return STAGE_ACCENTS.stem;
    case "avgpool":  return STAGE_ACCENTS.avgpool;
    case "output":   return STAGE_ACCENTS.output;
    case "resblock":
      return STAGE_ACCENTS[`layer${n.layerIndex}` as "layer1" | "layer2" | "layer3"];
  }
}

export function formatShape(shape: Shape): string {
  return shape.join(" x ");
}

export function formatParams(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return n.toString();
}
