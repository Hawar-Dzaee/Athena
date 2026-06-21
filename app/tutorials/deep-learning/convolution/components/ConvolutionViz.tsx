"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ *
 * Convolution — slide a 3×3 kernel over a real image (Messi) and
 * watch the output image build up, pixel by pixel. The user types the
 * nine kernel weights (or picks a preset) and scrubs / plays the sweep.
 * ------------------------------------------------------------------ */

/* image is /public/messi.jpg, 364 × 486 (portrait). We sample it down
 * to a GW × GH grid of grayscale "pixels" so each cell is big enough to
 * see the kernel window crawl across it. */
const GH = 80;
const GW = Math.round((GH * 364) / 486); // 60
const SCALE = 5; // display px per data pixel
const W = GW * SCALE; // 300
const H = GH * SCALE; // 400
const TOTAL = GW * GH;

const ACCENT = "#6366f1";
const MARKER = "#f59e0b";

type Preset = { name: string; k: number[]; bias: number };

const PRESETS: Preset[] = [
  { name: "Identity", k: [0, 0, 0, 0, 1, 0, 0, 0, 0], bias: 0 },
  { name: "Box blur", k: Array(9).fill(1 / 9), bias: 0 },
  { name: "Gaussian", k: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v / 16), bias: 0 },
  { name: "Sharpen", k: [0, -1, 0, -1, 5, -1, 0, -1, 0], bias: 0 },
  { name: "Edge detect", k: [-1, -1, -1, -1, 8, -1, -1, -1, -1], bias: 0 },
  { name: "Sobel X", k: [1, 0, -1, 2, 0, -2, 1, 0, -1], bias: 128 },
  { name: "Sobel Y", k: [1, 2, 1, 0, 0, 0, -1, -2, -1], bias: 128 },
  { name: "Emboss", k: [-2, -1, 0, -1, 1, 1, 0, 1, 2], bias: 128 },
];

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function fmt(v: number) {
  // tidy kernel-weight display: integers stay integers, else 3 decimals
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "");
}

export default function ConvolutionViz() {
  /* ---- canvases ---- */
  const srcRef = useRef<HTMLCanvasElement>(null);
  const srcOverlayRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const outOverlayRef = useRef<HTMLCanvasElement>(null);

  /* ---- pixel data (refs, not state — never trigger re-render) ---- */
  const grayRef = useRef<Float32Array | null>(null); // source 0..255
  const darkRef = useRef<Float32Array | null>(null); // dimmed source preview
  const outDataRef = useRef<Float32Array>(new Float32Array(TOTAL)); // conv output
  const backImg = useRef<ImageData | null>(null); // GW×GH scratch
  const backCanvas = useRef<HTMLCanvasElement | null>(null);

  /* ---- animation refs ---- */
  const posRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(30);
  const kernelRef = useRef<number[]>(PRESETS[3].k.slice());
  const biasRef = useRef(0);
  const dirtyRef = useRef(true);

  /* ---- react state (UI) ---- */
  const [loaded, setLoaded] = useState(false);
  const [kernel, setKernel] = useState<number[]>(PRESETS[3].k.slice());
  const [bias, setBias] = useState(0);
  const [presetName, setPresetName] = useState("Sharpen");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [pos, setPos] = useState(0);

  /* mirror state → refs for the raf loop */
  useEffect(() => {
    kernelRef.current = kernel;
    dirtyRef.current = true;
  }, [kernel]);
  useEffect(() => {
    biasRef.current = bias;
    dirtyRef.current = true;
  }, [bias]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  /* ---- load + downsample the image once ---- */
  useEffect(() => {
    const img = new Image();
    img.src = "/messi.jpg";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = GW;
      c.height = GH;
      const cx = c.getContext("2d")!;
      cx.drawImage(img, 0, 0, GW, GH);
      const { data } = cx.getImageData(0, 0, GW, GH);
      const gray = new Float32Array(TOTAL);
      const dark = new Float32Array(TOTAL);
      for (let i = 0; i < TOTAL; i++) {
        const o = i * 4;
        const g =
          0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
        gray[i] = g;
        dark[i] = g * 0.28;
      }
      grayRef.current = gray;
      darkRef.current = dark;

      // back scratch canvas
      const bc = document.createElement("canvas");
      bc.width = GW;
      bc.height = GH;
      backCanvas.current = bc;
      backImg.current = bc.getContext("2d")!.createImageData(GW, GH);

      // paint source once (crisp pixels)
      const sctx = srcRef.current!.getContext("2d")!;
      const simg = bc.getContext("2d")!.createImageData(GW, GH);
      for (let i = 0; i < TOTAL; i++) {
        const o = i * 4;
        simg.data[o] = simg.data[o + 1] = simg.data[o + 2] = gray[i];
        simg.data[o + 3] = 255;
      }
      bc.getContext("2d")!.putImageData(simg, 0, 0);
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(bc, 0, 0, GW, GH, 0, 0, W, H);

      setLoaded(true);
    };
  }, []);

  /* ---- recompute the full convolved output ---- */
  const recompute = useCallback(() => {
    const gray = grayRef.current;
    if (!gray) return;
    const k = kernelRef.current;
    const b = biasRef.current;
    const out = outDataRef.current;
    for (let r = 0; r < GH; r++) {
      for (let c = 0; c < GW; c++) {
        let acc = 0;
        for (let di = -1; di <= 1; di++) {
          const rr = clamp(r + di, 0, GH - 1);
          for (let dj = -1; dj <= 1; dj++) {
            const cc = clamp(c + dj, 0, GW - 1);
            acc += gray[rr * GW + cc] * k[(di + 1) * 3 + (dj + 1)];
          }
        }
        out[r * GW + c] = clamp(acc + b, 0, 255);
      }
    }
  }, []);

  /* ---- render output up to a reveal position ---- */
  const blitOutput = useCallback((p: number) => {
    const out = outDataRef.current;
    const dark = darkRef.current;
    const img = backImg.current;
    const bc = backCanvas.current;
    if (!dark || !img || !bc) return;
    const d = img.data;
    for (let i = 0; i < TOTAL; i++) {
      const g = i <= p ? out[i] : dark[i];
      const o = i * 4;
      d[o] = d[o + 1] = d[o + 2] = g;
      d[o + 3] = 255;
    }
    bc.getContext("2d")!.putImageData(img, 0, 0);
    const octx = outRef.current!.getContext("2d")!;
    octx.imageSmoothingEnabled = false;
    octx.drawImage(bc, 0, 0, GW, GH, 0, 0, W, H);
  }, []);

  /* ---- draw the sliding 3×3 window + output marker ---- */
  const drawOverlays = useCallback((p: number) => {
    const r = Math.floor(p / GW);
    const c = p % GW;
    const x = (c - 1) * SCALE;
    const y = (r - 1) * SCALE;

    const so = srcOverlayRef.current!.getContext("2d")!;
    so.clearRect(0, 0, W, H);
    so.lineWidth = 2;
    so.strokeStyle = ACCENT;
    so.strokeRect(x + 0.5, y + 0.5, 3 * SCALE, 3 * SCALE);
    // inner grid lines
    so.lineWidth = 0.5;
    so.strokeStyle = "rgba(99,102,241,0.6)";
    for (let g = 1; g < 3; g++) {
      so.beginPath();
      so.moveTo(x + g * SCALE + 0.5, y);
      so.lineTo(x + g * SCALE + 0.5, y + 3 * SCALE);
      so.moveTo(x, y + g * SCALE + 0.5);
      so.lineTo(x + 3 * SCALE, y + g * SCALE + 0.5);
      so.stroke();
    }

    const oo = outOverlayRef.current!.getContext("2d")!;
    oo.clearRect(0, 0, W, H);
    oo.fillStyle = MARKER;
    oo.fillRect(c * SCALE, r * SCALE, SCALE, SCALE);
  }, []);

  /* ---- the snapshot readout for the loupe (throttled) ---- */
  const [readout, setReadout] = useState<{
    win: number[];
    val: number;
    r: number;
    c: number;
  }>({ win: Array(9).fill(0), val: 0, r: 1, c: 1 });

  const pushReadout = useCallback((p: number) => {
    const gray = grayRef.current;
    if (!gray) return;
    const r = Math.floor(p / GW);
    const c = p % GW;
    const win: number[] = [];
    for (let di = -1; di <= 1; di++) {
      const rr = clamp(r + di, 0, GH - 1);
      for (let dj = -1; dj <= 1; dj++) {
        const cc = clamp(c + dj, 0, GW - 1);
        win.push(gray[rr * GW + cc]);
      }
    }
    setReadout({ win, val: outDataRef.current[p], r, c });
  }, []);

  /* ---- the animation / draw loop ---- */
  useEffect(() => {
    if (!loaded) return;
    let raf = 0;
    let frame = 0;
    recompute();
    blitOutput(posRef.current);
    drawOverlays(posRef.current);
    pushReadout(posRef.current);

    const tick = () => {
      if (dirtyRef.current) {
        recompute();
        dirtyRef.current = false;
        blitOutput(posRef.current);
        pushReadout(posRef.current);
      }
      if (playingRef.current) {
        posRef.current = Math.min(
          TOTAL - 1,
          posRef.current + Math.max(1, Math.round(speedRef.current))
        );
        blitOutput(posRef.current);
        drawOverlays(posRef.current);
        if (frame % 3 === 0) {
          pushReadout(posRef.current);
          setPos(posRef.current);
        }
        if (posRef.current >= TOTAL - 1) {
          playingRef.current = false;
          setPlaying(false);
          setPos(TOTAL - 1);
          pushReadout(TOTAL - 1);
        }
      }
      frame++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, recompute, blitOutput, drawOverlays, pushReadout]);

  /* ---- imperative scrubbing ---- */
  const scrubTo = useCallback(
    (p: number) => {
      const np = clamp(Math.round(p), 0, TOTAL - 1);
      posRef.current = np;
      setPos(np);
      blitOutput(np);
      drawOverlays(np);
      pushReadout(np);
    },
    [blitOutput, drawOverlays, pushReadout]
  );

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = clamp(
      Math.floor(((e.clientX - rect.left) / rect.width) * GW),
      0,
      GW - 1
    );
    const r = clamp(
      Math.floor(((e.clientY - rect.top) / rect.height) * GH),
      0,
      GH - 1
    );
    setPlaying(false);
    scrubTo(r * GW + c);
  };

  /* ---- controls ---- */
  const applyPreset = (p: Preset) => {
    setPresetName(p.name);
    setKernel(p.k.slice());
    setBias(p.bias);
  };

  const setCell = (i: number, raw: string) => {
    const v = raw === "" || raw === "-" ? 0 : parseFloat(raw);
    if (Number.isNaN(v)) return;
    setKernel((k) => {
      const next = k.slice();
      next[i] = v;
      return next;
    });
    setPresetName("Custom");
  };

  const restart = () => {
    scrubTo(0);
    setPlaying(true);
  };
  const togglePlay = () => {
    if (posRef.current >= TOTAL - 1) {
      scrubTo(0);
    }
    setPlaying((p) => !p);
  };

  /* ---- styles ---- */
  const canvasBox: CSSProperties = {
    position: "relative",
    width: W,
    height: H,
  };
  const stacked: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: W,
    height: H,
    imageRendering: "pixelated",
  };

  return (
    <div className="not-prose my-8 rounded-2xl border border-border bg-background/40 p-5 shadow-sm">
      {/* images */}
      <div className="flex flex-wrap items-start justify-center gap-8">
        <figure className="flex flex-col items-center gap-2">
          <figcaption className="text-sm font-medium text-foreground/70">
            Input
          </figcaption>
          <div
            style={canvasBox}
            className="overflow-hidden rounded-lg border border-border"
          >
            <canvas ref={srcRef} width={W} height={H} style={stacked} />
            <canvas
              ref={srcOverlayRef}
              width={W}
              height={H}
              style={{ ...stacked, cursor: "crosshair" }}
              onClick={onCanvasClick}
              role="img"
              aria-label="Source image with sliding 3 by 3 convolution window. Click to move the window."
            />
          </div>
        </figure>

        <figure className="flex flex-col items-center gap-2">
          <figcaption className="text-sm font-medium text-foreground/70">
            Output
          </figcaption>
          <div
            style={canvasBox}
            className="overflow-hidden rounded-lg border border-border"
          >
            <canvas ref={outRef} width={W} height={H} style={stacked} />
            <canvas
              ref={outOverlayRef}
              width={W}
              height={H}
              style={stacked}
              role="img"
              aria-label="Convolved output image, filling in as the kernel sweeps."
            />
          </div>
        </figure>

        {/* loupe + kernel */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-medium text-foreground/70">
            window&nbsp;⊛&nbsp;kernel
          </span>
          <div className="flex items-center gap-3">
            <Grid9
              values={readout.win}
              fmt={(v) => String(Math.round(v))}
              bg={(v) => `rgb(${v},${v},${v})`}
              fg={(v) => (v > 130 ? "#111" : "#eee")}
              label="window"
            />
            <span className="text-lg text-foreground/50">⊛</span>
            <KernelGrid kernel={kernel} onChange={setCell} />
          </div>
          <div className="rounded-md bg-foreground/5 px-3 py-2 text-center text-sm">
            <span className="text-foreground/60">output pixel </span>
            <span className="font-mono text-foreground">
              ({readout.c}, {readout.r})
            </span>
            <span className="text-foreground/60"> = </span>
            <span
              className="rounded px-2 py-0.5 font-mono font-semibold"
              style={{
                background: `rgb(${Math.round(readout.val)},${Math.round(
                  readout.val
                )},${Math.round(readout.val)})`,
                color: readout.val > 130 ? "#111" : "#eee",
              }}
            >
              {Math.round(readout.val)}
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            bias
            <input
              type="number"
              value={bias}
              step={8}
              onChange={(e) => setBias(parseFloat(e.target.value) || 0)}
              className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-foreground"
            />
          </label>
        </div>
      </div>

      {/* presets */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => applyPreset(p)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              presetName === p.name
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-foreground/70 hover:border-accent/50 hover:text-foreground"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* transport */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={togglePlay}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={restart}
          className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground/80 transition hover:text-foreground"
        >
          Restart
        </button>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          position
          <input
            type="range"
            min={0}
            max={TOTAL - 1}
            value={pos}
            onChange={(e) => {
              setPlaying(false);
              scrubTo(parseInt(e.target.value, 10));
            }}
            className="w-48 accent-[var(--accent)]"
            aria-label="Kernel position"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          speed
          <input
            type="range"
            min={1}
            max={120}
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            className="w-32 accent-[var(--accent)]"
            aria-label="Sweep speed"
          />
        </label>
      </div>

      {!loaded && (
        <p className="mt-4 text-center text-sm text-foreground/50">
          loading image…
        </p>
      )}
    </div>
  );
}

/* ---- a read-only 3×3 numeric grid (the source window) ---- */
function Grid9({
  values,
  fmt: f,
  bg,
  fg,
  label,
}: {
  values: number[];
  fmt: (v: number) => string;
  bg: (v: number) => string;
  fg: (v: number) => string;
  label: string;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-0.5"
      role="group"
      aria-label={label}
    >
      {values.map((v, i) => (
        <div
          key={i}
          className="flex h-9 w-9 items-center justify-center rounded-sm font-mono text-[11px]"
          style={{ background: bg(v), color: fg(v) }}
        >
          {f(v)}
        </div>
      ))}
    </div>
  );
}

/* ---- the editable kernel ---- */
function KernelGrid({
  kernel,
  onChange,
}: {
  kernel: number[];
  onChange: (i: number, raw: string) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-0.5"
      role="group"
      aria-label="Editable 3 by 3 kernel weights"
    >
      {kernel.map((v, i) => (
        <input
          key={i}
          type="text"
          inputMode="decimal"
          value={fmt(v)}
          onChange={(e) => onChange(i, e.target.value)}
          aria-label={`kernel weight row ${Math.floor(i / 3) + 1} column ${
            (i % 3) + 1
          }`}
          className="h-9 w-12 rounded-sm border border-accent/40 bg-accent/5 text-center font-mono text-[11px] text-foreground focus:border-accent focus:outline-none"
        />
      ))}
    </div>
  );
}
