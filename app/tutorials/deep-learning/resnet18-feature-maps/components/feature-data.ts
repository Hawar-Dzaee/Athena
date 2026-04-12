/**
 * Procedural feature-map generation for the ResNet-18 feature-flow
 * visualization.  Nothing here runs a real model — we synthesize
 * activations that are *educationally faithful*:
 *
 *  • Early layers → many small edge-like features, high spatial noise
 *  • Deep layers  → few large blobs, sparse activations
 *  • Spatial size  shrinks as depth grows  (224 → 112 → 56 → 28 → 14 → 7)
 *  • Channel count grows                  (3 → 64 → 128 → 256 → 512)
 */

// ─── Seeded PRNG (mulberry32) ──────────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Layer specification ───────────────────────────────────────────

export interface LayerSpec {
  id: string;
  label: string;
  fullChannels: number;
  displayChannels: number;
  /** Internal canvas resolution (determines pixelation) */
  spatialSize: number;
  /** Human-readable actual spatial dims */
  actualSpatial: string;
  stage: string;
  /** 0 = input, 1 = deepest conv layer */
  depth: number;
}

export const LAYERS: LayerSpec[] = [
  { id: "input",    label: "Input",       fullChannels: 3,   displayChannels: 3, spatialSize: 32, actualSpatial: "224 × 224", stage: "input",  depth: 0    },
  { id: "conv1",    label: "conv1 + bn + relu", fullChannels: 64,  displayChannels: 4, spatialSize: 16, actualSpatial: "112 × 112", stage: "stem",   depth: 0.05 },
  { id: "maxpool",  label: "maxpool",     fullChannels: 64,  displayChannels: 4, spatialSize: 12, actualSpatial: "56 × 56",   stage: "stem",   depth: 0.1  },
  { id: "layer1_0", label: "layer1[0]",   fullChannels: 64,  displayChannels: 4, spatialSize: 12, actualSpatial: "56 × 56",   stage: "layer1", depth: 0.2  },
  { id: "layer1_1", label: "layer1[1]",   fullChannels: 64,  displayChannels: 4, spatialSize: 12, actualSpatial: "56 × 56",   stage: "layer1", depth: 0.3  },
  { id: "layer2_0", label: "layer2[0]",   fullChannels: 128, displayChannels: 4, spatialSize: 8,  actualSpatial: "28 × 28",   stage: "layer2", depth: 0.4  },
  { id: "layer2_1", label: "layer2[1]",   fullChannels: 128, displayChannels: 4, spatialSize: 8,  actualSpatial: "28 × 28",   stage: "layer2", depth: 0.5  },
  { id: "layer3_0", label: "layer3[0]",   fullChannels: 256, displayChannels: 4, spatialSize: 6,  actualSpatial: "14 × 14",   stage: "layer3", depth: 0.6  },
  { id: "layer3_1", label: "layer3[1]",   fullChannels: 256, displayChannels: 4, spatialSize: 6,  actualSpatial: "14 × 14",   stage: "layer3", depth: 0.7  },
  { id: "layer4_0", label: "layer4[0]",   fullChannels: 512, displayChannels: 4, spatialSize: 4,  actualSpatial: "7 × 7",     stage: "layer4", depth: 0.85 },
  { id: "layer4_1", label: "layer4[1]",   fullChannels: 512, displayChannels: 4, spatialSize: 4,  actualSpatial: "7 × 7",     stage: "layer4", depth: 1.0  },
];

export const STAGE_COLORS: Record<string, string> = {
  input:  "#94a3b8",
  stem:   "#f59e0b",
  layer1: "#f43f5e",
  layer2: "#a855f7",
  layer3: "#06b6d4",
  layer4: "#10b981",
};

export const STAGE_LABELS: Record<string, string> = {
  input:  "Input",
  stem:   "Stem",
  layer1: "Layer 1",
  layer2: "Layer 2",
  layer3: "Layer 3",
  layer4: "Layer 4",
};

// ─── Sample input images (procedural) ──────────────────────────────

export interface SampleImage {
  name: string;
  label: string;
  generate: (size: number) => number[][][]; // [channel][y][x]  0..1
}

function makeCircleImage(size: number): number[][][] {
  const c: number[][][] = [[], [], []];
  const cx = size / 2, cy = size / 2, r = size * 0.32;
  for (let y = 0; y < size; y++) {
    c[0][y] = []; c[1][y] = []; c[2][y] = [];
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const inside = d < r ? 1 : 0;
      const ring = Math.abs(d - r) < 1.5 ? 0.7 : 0;
      c[0][y][x] = inside * 0.85 + ring * 0.2 + 0.08;
      c[1][y][x] = inside * 0.35 + ring * 0.1 + 0.08;
      c[2][y][x] = inside * 0.10 + ring * 0.1 + 0.08;
    }
  }
  return c;
}

function makeStripesImage(size: number): number[][][] {
  const c: number[][][] = [[], [], []];
  for (let y = 0; y < size; y++) {
    c[0][y] = []; c[1][y] = []; c[2][y] = [];
    for (let x = 0; x < size; x++) {
      const s = Math.sin((x + y) * Math.PI * 6 / size) * 0.5 + 0.5;
      c[0][y][x] = s * 0.15 + 0.12;
      c[1][y][x] = s * 0.45 + 0.20;
      c[2][y][x] = s * 0.80 + 0.10;
    }
  }
  return c;
}

function makeCrossImage(size: number): number[][][] {
  const c: number[][][] = [[], [], []];
  const half = size / 2, arm = size * 0.12;
  for (let y = 0; y < size; y++) {
    c[0][y] = []; c[1][y] = []; c[2][y] = [];
    for (let x = 0; x < size; x++) {
      const horiz = Math.abs(y - half) < arm && Math.abs(x - half) < half * 0.7;
      const vert  = Math.abs(x - half) < arm && Math.abs(y - half) < half * 0.7;
      const on = horiz || vert ? 1 : 0;
      c[0][y][x] = on * 0.70 + 0.10;
      c[1][y][x] = on * 0.20 + 0.10;
      c[2][y][x] = on * 0.55 + 0.10;
    }
  }
  return c;
}

export const SAMPLE_IMAGES: SampleImage[] = [
  { name: "circle",  label: "Circle",  generate: makeCircleImage  },
  { name: "stripes", label: "Stripes", generate: makeStripesImage },
  { name: "cross",   label: "Cross",   generate: makeCrossImage   },
];

// ─── Feature-map generation ────────────────────────────────────────

export function generateFeatureMap(
  spatialSize: number,
  depth: number,
  channelIdx: number,
  imageSeed: number,
): number[][] {
  const rng = mulberry32(imageSeed * 17389 + channelIdx * 7919 + Math.floor(depth * 1000) * 31);

  // Shallow → many small blobs + oriented edge pattern + noise
  // Deep    → few large blobs, sparse, little noise
  const numBlobs = Math.max(1, Math.round(6 - depth * 4 + rng() * 2));
  const baseSize = 0.12 + depth * 0.30;

  const blobs = Array.from({ length: numBlobs }, () => ({
    cx: rng(), cy: rng(),
    sx: baseSize * (0.5 + rng() * 0.8),
    sy: baseSize * (0.5 + rng() * 0.8),
    amp: (rng() - 0.35) * 2.5,
  }));

  // Edge pattern for shallow layers
  const hasEdge = depth < 0.25;
  const edgeAngle = rng() * Math.PI;
  const edgeFreq = 4 + rng() * 8;
  const edgeAmp = hasEdge ? 0.5 + rng() * 0.5 : 0;

  const map: number[][] = [];
  for (let y = 0; y < spatialSize; y++) {
    map[y] = [];
    for (let x = 0; x < spatialSize; x++) {
      const nx = x / spatialSize, ny = y / spatialSize;
      let val = 0;

      for (const b of blobs) {
        const dx = (nx - b.cx) / b.sx;
        const dy = (ny - b.cy) / b.sy;
        val += b.amp * Math.exp(-0.5 * (dx * dx + dy * dy));
      }

      if (hasEdge) {
        val += edgeAmp * Math.cos(edgeFreq * (nx * Math.cos(edgeAngle) + ny * Math.sin(edgeAngle)));
      }

      val += (rng() - 0.5) * 0.3 * (1 - depth * 0.7);

      // Sparsify deeper layers (ReLU-like)
      if (depth > 0.2 && val < 0 && rng() < depth * 0.4) val = 0;

      map[y][x] = val;
    }
  }
  return map;
}

// ─── Aggregate all layers for one image ────────────────────────────

export interface LayerData {
  spec: LayerSpec;
  maps: number[][][];       // [channelIdx][y][x]
  channelIndices: number[];  // which channels we're actually showing
}

export function generateAllLayers(imageIdx: number): LayerData[] {
  return LAYERS.map((spec) => {
    if (spec.id === "input") {
      const img = SAMPLE_IMAGES[imageIdx].generate(spec.spatialSize);
      return { spec, maps: img, channelIndices: [0, 1, 2] };
    }

    const maps: number[][][] = [];
    const channelIndices: number[] = [];

    for (let i = 0; i < spec.displayChannels; i++) {
      const idx = Math.floor((i / spec.displayChannels) * spec.fullChannels);
      channelIndices.push(idx);
      maps.push(generateFeatureMap(spec.spatialSize, spec.depth, idx + imageIdx * 100, imageIdx));
    }

    return { spec, maps, channelIndices };
  });
}

// ─── Fake output predictions ───────────────────────────────────────

const CLASS_LABELS = [
  "goldfish", "tiger", "school bus", "pizza", "castle",
  "tennis ball", "espresso", "tabby cat", "airplane", "church",
];

export function generatePredictions(imageIdx: number): { label: string; prob: number }[] {
  const rng = mulberry32(imageIdx * 9973 + 42);
  const raw = CLASS_LABELS.map((label) => ({ label, prob: rng() * rng() }));

  // Give one class a dominant probability
  raw[imageIdx % raw.length].prob = 2 + rng();

  const sum = raw.reduce((s, r) => s + r.prob, 0);
  return raw
    .map((r) => ({ label: r.label, prob: r.prob / sum }))
    .sort((a, b) => b.prob - a.prob);
}

// ─── Diverging colormap  (blue → white → red) ─────────────────────

export function divergingColor(t: number): [number, number, number] {
  // t ∈ [0, 1] where 0 = most negative (blue), 1 = most positive (red)
  if (t <= 0.5) {
    const s = t * 2;
    return [
      Math.round(44  + s * (250 - 44)),
      Math.round(105 + s * (250 - 105)),
      Math.round(210 + s * (250 - 210)),
    ];
  }
  const s = (t - 0.5) * 2;
  return [
    Math.round(250 - s * (250 - 210)),
    Math.round(250 - s * (250 - 70)),
    Math.round(250 - s * (250 - 60)),
  ];
}
