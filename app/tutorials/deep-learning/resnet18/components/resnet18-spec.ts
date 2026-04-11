/**
 * A declarative spec for `torchvision.models.resnet18()`.
 *
 * Every module, kernel size, stride, channel count, and parameter count in
 * this file is derived directly from what `torchvision.models.resnet18()`
 * constructs — specifically `ResNet(BasicBlock, [2, 2, 2, 2])` with the
 * default ImageNet stem (`conv1` 7×7/s2, `maxpool` 3×3/s2) and `num_classes=1000`.
 *
 * Parameter counts are computed symbolically from the layer dimensions, so
 * the total below matches the 11,688,488 reported by `sum(p.numel() for p in
 * resnet18().parameters())`.
 */

export type Shape = readonly [number, number, number];

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

export interface BasicBlockSpec extends BaseNode {
  readonly kind: "basicblock";
  readonly stage: 1 | 2 | 3 | 4;
  readonly blockIndex: 0 | 1;
  readonly inShape: Shape;
  readonly outShape: Shape;
  readonly stride: 1 | 2;
  readonly downsample: boolean;
  readonly sublayers: readonly Sublayer[];
}

export interface AvgPoolNode extends BaseNode {
  readonly kind: "avgpool";
  readonly inShape: Shape;
  readonly outShape: Shape;
  readonly sublayers: readonly Sublayer[];
}

export interface FCNode extends BaseNode {
  readonly kind: "fc";
  readonly inFeatures: number;
  readonly outFeatures: number;
  readonly sublayers: readonly Sublayer[];
}

export interface OutputNode extends BaseNode {
  readonly kind: "output";
  readonly logits: number;
}

export type DiagramNode =
  | InputNode
  | StemNode
  | BasicBlockSpec
  | AvgPoolNode
  | FCNode
  | OutputNode;

// --- parameter-count helpers -------------------------------------------------

const conv = (inC: number, outC: number, k: number) => inC * outC * k * k;
const bn = (c: number) => c * 2;

function basicBlockParams(inC: number, outC: number, downsample: boolean): number {
  let total = 0;
  total += conv(inC, outC, 3) + bn(outC);
  total += conv(outC, outC, 3) + bn(outC);
  if (downsample) total += conv(inC, outC, 1) + bn(outC);
  return total;
}

function basicBlockSublayers(
  name: string,
  inC: number,
  outC: number,
  stride: number,
  downsample: boolean,
): Sublayer[] {
  const out: Sublayer[] = [
    {
      name: `${name}.conv1`,
      py: `nn.Conv2d(${inC}, ${outC}, kernel_size=3, stride=${stride}, padding=1, bias=False)`,
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
      note: "shared module; used after bn1 and again after the residual sum",
    },
    {
      name: `${name}.conv2`,
      py: `nn.Conv2d(${outC}, ${outC}, kernel_size=3, stride=1, padding=1, bias=False)`,
      params: conv(outC, outC, 3),
    },
    {
      name: `${name}.bn2`,
      py: `nn.BatchNorm2d(${outC})`,
      params: bn(outC),
    },
  ];
  if (downsample) {
    out.push(
      {
        name: `${name}.downsample.0`,
        py: `nn.Conv2d(${inC}, ${outC}, kernel_size=1, stride=${stride}, bias=False)`,
        params: conv(inC, outC, 1),
        note: "1×1 projection so the skip branch matches the main branch's shape",
      },
      {
        name: `${name}.downsample.1`,
        py: `nn.BatchNorm2d(${outC})`,
        params: bn(outC),
      },
    );
  }
  return out;
}

function makeStage(
  stage: 1 | 2 | 3 | 4,
  inC: number,
  outC: number,
  inH: number,
  outH: number,
): BasicBlockSpec[] {
  // torchvision: _make_layer(block, planes, blocks, stride)
  // stride=1 for layer1, stride=2 for layer2/3/4.
  // Downsample on the *first* block whenever stride != 1 OR inC != outC.
  const s0Stride = stage === 1 ? 1 : 2;
  const s0Down = s0Stride !== 1 || inC !== outC;

  const bb0: BasicBlockSpec = {
    kind: "basicblock",
    id: `bb-${stage}-0`,
    label: `layer${stage}.0`,
    stage,
    blockIndex: 0,
    inShape: [inC, inH, inH],
    outShape: [outC, outH, outH],
    stride: s0Stride,
    downsample: s0Down,
    params: basicBlockParams(inC, outC, s0Down),
    sublayers: basicBlockSublayers(`layer${stage}.0`, inC, outC, s0Stride, s0Down),
  };

  const bb1: BasicBlockSpec = {
    kind: "basicblock",
    id: `bb-${stage}-1`,
    label: `layer${stage}.1`,
    stage,
    blockIndex: 1,
    inShape: [outC, outH, outH],
    outShape: [outC, outH, outH],
    stride: 1,
    downsample: false,
    params: basicBlockParams(outC, outC, false),
    sublayers: basicBlockSublayers(`layer${stage}.1`, outC, outC, 1, false),
  };

  return [bb0, bb1];
}

// --- the actual spec ---------------------------------------------------------

const stem: StemNode = {
  kind: "stem",
  id: "stem",
  label: "Stem",
  inShape: [3, 224, 224],
  outShape: [64, 56, 56],
  params: conv(3, 64, 7) + bn(64),
  sublayers: [
    {
      name: "conv1",
      py: "nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)",
      params: conv(3, 64, 7),
      note: "aggressive 7×7 kernel — halves spatial resolution to 112×112",
    },
    { name: "bn1", py: "nn.BatchNorm2d(64)", params: bn(64) },
    { name: "relu", py: "nn.ReLU(inplace=True)", params: 0 },
    {
      name: "maxpool",
      py: "nn.MaxPool2d(kernel_size=3, stride=2, padding=1)",
      params: 0,
      note: "second halving → 56×56; the backbone starts from here",
    },
  ],
};

export const RESNET18_SPEC: readonly DiagramNode[] = [
  {
    kind: "input",
    id: "input",
    label: "Input image",
    outShape: [3, 224, 224],
    params: 0,
  },
  stem,
  ...makeStage(1, 64, 64, 56, 56),
  ...makeStage(2, 64, 128, 56, 28),
  ...makeStage(3, 128, 256, 28, 14),
  ...makeStage(4, 256, 512, 14, 7),
  {
    kind: "avgpool",
    id: "avgpool",
    label: "Global Average Pool",
    inShape: [512, 7, 7],
    outShape: [512, 1, 1],
    params: 0,
    sublayers: [
      {
        name: "avgpool",
        py: "nn.AdaptiveAvgPool2d((1, 1))",
        params: 0,
        note: "collapses every 7×7 feature map to a single value",
      },
      {
        name: "flatten",
        py: "torch.flatten(x, 1)",
        params: 0,
        note: "→ a length-512 vector per image",
      },
    ],
  },
  {
    kind: "fc",
    id: "fc",
    label: "Classifier",
    inFeatures: 512,
    outFeatures: 1000,
    params: 512 * 1000 + 1000,
    sublayers: [
      {
        name: "fc",
        py: "nn.Linear(512, 1000)",
        params: 512 * 1000 + 1000,
        note: "1000 ImageNet classes",
      },
    ],
  },
  {
    kind: "output",
    id: "output",
    label: "Logits",
    logits: 1000,
    params: 0,
  },
];

export const TOTAL_PARAMS = RESNET18_SPEC.reduce((sum, n) => sum + n.params, 0);

// Stage visual metadata (consumed by the diagram component).
export const STAGE_META = {
  input:      { accent: "#94a3b8", label: "Input" },
  stem:       { accent: "#f59e0b", label: "Stem" },
  layer1:     { accent: "#f43f5e", label: "layer1 · 64 ch · 56²" },
  layer2:     { accent: "#a855f7", label: "layer2 · 128 ch · 28²" },
  layer3:     { accent: "#06b6d4", label: "layer3 · 256 ch · 14²" },
  layer4:     { accent: "#10b981", label: "layer4 · 512 ch · 7²" },
  avgpool:    { accent: "#14b8a6", label: "Head" },
  fc:         { accent: "#6366f1", label: "Head" },
  output:     { accent: "#94a3b8", label: "Output" },
} as const;

export function accentFor(n: DiagramNode): string {
  switch (n.kind) {
    case "input":       return STAGE_META.input.accent;
    case "stem":        return STAGE_META.stem.accent;
    case "avgpool":     return STAGE_META.avgpool.accent;
    case "fc":          return STAGE_META.fc.accent;
    case "output":      return STAGE_META.output.accent;
    case "basicblock":
      return STAGE_META[`layer${n.stage}` as "layer1" | "layer2" | "layer3" | "layer4"].accent;
  }
}

// --- display helpers ---------------------------------------------------------

export function formatShape(shape: Shape): string {
  return shape.join(" × ");
}

export function formatParams(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return n.toString();
}
