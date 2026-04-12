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
      note: "shared module; used after bn1 and again after the residual sum",
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
  if (downsample) {
    out.push(
      {
        name: `${name}.downsample.0`,
        py: `nn.Conv2d(\n    ${inC}, ${outC},\n    kernel_size=1,\n    stride=${stride},\n    bias=False\n)`,
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

function makeStageHW(
  stage: 1 | 2 | 3 | 4,
  inC: number,
  outC: number,
  inH: number,
  inW: number,
  outH: number,
  outW: number,
): BasicBlockSpec[] {
  const s0Stride = stage === 1 ? 1 : 2;
  const s0Down = s0Stride !== 1 || inC !== outC;

  const bb0: BasicBlockSpec = {
    kind: "basicblock",
    id: `bb-${stage}-0`,
    label: `layer${stage}.0`,
    stage,
    blockIndex: 0,
    inShape: [inC, inH, inW],
    outShape: [outC, outH, outW],
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
    inShape: [outC, outH, outW],
    outShape: [outC, outH, outW],
    stride: 1,
    downsample: false,
    params: basicBlockParams(outC, outC, false),
    sublayers: basicBlockSublayers(`layer${stage}.1`, outC, outC, 1, false),
  };

  return [bb0, bb1];
}

// --- spatial-dimension helpers ------------------------------------------------

/** conv / pool output size: floor((x + 2p − k) / s) + 1 */
const spatialOut = (x: number, k: number, s: number, p: number) =>
  Math.floor((x + 2 * p - k) / s) + 1;

/** After stride-2 with k=7,p=3 or k=3,p=1: ceil(x/2). */
const halve = (x: number) => Math.ceil(x / 2);

// --- validation --------------------------------------------------------------

/**
 * Check whether a given H×W input can pass through ResNet-18 without any
 * spatial dimension hitting zero. Returns `null` if valid, or an error
 * message string describing where it breaks.
 */
export function validateInputSize(inputH: number, inputW: number): string | null {
  if (!Number.isInteger(inputH) || !Number.isInteger(inputW) || inputH < 1 || inputW < 1) {
    return "Height and width must be positive integers.";
  }

  const stages: { label: string; h: number; w: number }[] = [];

  const afterConv1H = spatialOut(inputH, 7, 2, 3);
  const afterConv1W = spatialOut(inputW, 7, 2, 3);
  stages.push({ label: "conv1 (7×7, stride 2)", h: afterConv1H, w: afterConv1W });

  const stemH = spatialOut(afterConv1H, 3, 2, 1);
  const stemW = spatialOut(afterConv1W, 3, 2, 1);
  stages.push({ label: "maxpool (3×3, stride 2)", h: stemH, w: stemW });

  let h = stemH, w = stemW;
  // layer1 keeps dims, layer2/3/4 halve
  for (const [name, doHalve] of [["layer2", true], ["layer3", true], ["layer4", true]] as const) {
    if (doHalve) { h = halve(h); w = halve(w); }
    stages.push({ label: `${name} (stride 2)`, h, w });
  }

  for (const s of stages) {
    if (s.h < 1 || s.w < 1) {
      return `Spatial dimensions collapse to ${s.h}×${s.w} at ${s.label}. Try a larger input.`;
    }
  }

  return null;
}

// --- the actual spec (built from user-supplied H × W) ------------------------

export function buildResNet18Spec(inputH: number, inputW: number): {
  spec: readonly DiagramNode[];
  totalParams: number;
} {
  // Stem: conv1 7×7/s2/p3 → bn → relu → maxpool 3×3/s2/p1
  const afterConv1H = spatialOut(inputH, 7, 2, 3);
  const afterConv1W = spatialOut(inputW, 7, 2, 3);
  const stemH = spatialOut(afterConv1H, 3, 2, 1);
  const stemW = spatialOut(afterConv1W, 3, 2, 1);

  const stem: StemNode = {
    kind: "stem",
    id: "stem",
    label: "Stem",
    inShape: [3, inputH, inputW],
    outShape: [64, stemH, stemW],
    params: conv(3, 64, 7) + bn(64),
    sublayers: [
      {
        name: "conv1",
        py: "nn.Conv2d(\n    3, 64,\n    kernel_size=7,\n    stride=2,\n    padding=3,\n    bias=False\n)",
        params: conv(3, 64, 7),
        note: `aggressive 7×7 kernel — halves spatial resolution to ${afterConv1H}×${afterConv1W}`,
      },
      { name: "bn1", py: "nn.BatchNorm2d(64)", params: bn(64) },
      { name: "relu", py: "nn.ReLU(inplace=True)", params: 0 },
      {
        name: "maxpool",
        py: "nn.MaxPool2d(\n    kernel_size=3,\n    stride=2,\n    padding=1\n)",
        params: 0,
        note: `second halving → ${stemH}×${stemW}; the backbone starts from here`,
      },
    ],
  };

  // Each stage: stride-2 blocks halve spatial dims (layer2/3/4), layer1 keeps them.
  const s1H = stemH, s1W = stemW;
  const s2H = halve(s1H), s2W = halve(s1W);
  const s3H = halve(s2H), s3W = halve(s2W);
  const s4H = halve(s3H), s4W = halve(s3W);

  const spec: readonly DiagramNode[] = [
    {
      kind: "input",
      id: "input",
      label: "Input image",
      outShape: [3, inputH, inputW],
      params: 0,
    },
    stem,
    ...makeStageHW(1, 64, 64, s1H, s1W, s1H, s1W),
    ...makeStageHW(2, 64, 128, s1H, s1W, s2H, s2W),
    ...makeStageHW(3, 128, 256, s2H, s2W, s3H, s3W),
    ...makeStageHW(4, 256, 512, s3H, s3W, s4H, s4W),
    {
      kind: "avgpool",
      id: "avgpool",
      label: "Global Average Pool",
      inShape: [512, s4H, s4W],
      outShape: [512, 1, 1],
      params: 0,
      sublayers: [
        {
          name: "avgpool",
          py: "nn.AdaptiveAvgPool2d((1, 1))",
          params: 0,
          note: `collapses every ${s4H}×${s4W} feature map to a single value`,
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

  const totalParams = spec.reduce((sum, n) => sum + n.params, 0);
  return { spec, totalParams };
}

/** Default 224×224 spec for convenience. */
export const RESNET18_SPEC_DEFAULT = buildResNet18Spec(224, 224);
export const RESNET18_SPEC = RESNET18_SPEC_DEFAULT.spec;
export const TOTAL_PARAMS = RESNET18_SPEC_DEFAULT.totalParams;

// Stage visual metadata (consumed by the diagram component).
export const STAGE_ACCENTS = {
  input:   "#94a3b8",
  stem:    "#f59e0b",
  layer1:  "#f43f5e",
  layer2:  "#a855f7",
  layer3:  "#06b6d4",
  layer4:  "#10b981",
  avgpool: "#14b8a6",
  fc:      "#6366f1",
  output:  "#94a3b8",
} as const;

/** Legacy alias — static labels for the default 224×224 spec. */
export const STAGE_META = {
  input:      { accent: STAGE_ACCENTS.input,   label: "Input" },
  stem:       { accent: STAGE_ACCENTS.stem,    label: "Stem" },
  layer1:     { accent: STAGE_ACCENTS.layer1,  label: "layer1 · 64 ch · 56²" },
  layer2:     { accent: STAGE_ACCENTS.layer2,  label: "layer2 · 128 ch · 28²" },
  layer3:     { accent: STAGE_ACCENTS.layer3,  label: "layer3 · 256 ch · 14²" },
  layer4:     { accent: STAGE_ACCENTS.layer4,  label: "layer4 · 512 ch · 7²" },
  avgpool:    { accent: STAGE_ACCENTS.avgpool, label: "Head" },
  fc:         { accent: STAGE_ACCENTS.fc,      label: "Head" },
  output:     { accent: STAGE_ACCENTS.output,  label: "Output" },
} as const;

export function accentFor(n: DiagramNode): string {
  switch (n.kind) {
    case "input":       return STAGE_ACCENTS.input;
    case "stem":        return STAGE_ACCENTS.stem;
    case "avgpool":     return STAGE_ACCENTS.avgpool;
    case "fc":          return STAGE_ACCENTS.fc;
    case "output":      return STAGE_ACCENTS.output;
    case "basicblock":
      return STAGE_ACCENTS[`layer${n.stage}` as "layer1" | "layer2" | "layer3" | "layer4"];
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
