"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const RANGE = 4;
const PEAK_HEIGHT = 5;

interface BarData {
  x: number;
  z: number;
  density: number;
  t: number;
}

interface BinResult {
  bars: BarData[];
  binWidth: number;
  maxDensity: number;
}

function bin2D(samples: [number, number][], numBins: number): BinResult {
  const binWidth = (2 * RANGE) / numBins;
  const counts: number[][] = Array.from({ length: numBins }, () =>
    new Array(numBins).fill(0)
  );

  for (const [sx, sy] of samples) {
    if (sx >= -RANGE && sx < RANGE && sy >= -RANGE && sy < RANGE) {
      const ix = Math.min(Math.floor((sx + RANGE) / binWidth), numBins - 1);
      const iy = Math.min(Math.floor((sy + RANGE) / binWidth), numBins - 1);
      counts[ix][iy]++;
    }
  }

  const area = samples.length * binWidth * binWidth;
  const densities = counts.map((row) => row.map((c) => c / area));
  const maxDensity = Math.max(...densities.flat(), 0.001);

  const bars: BarData[] = [];
  for (let ix = 0; ix < numBins; ix++) {
    for (let iz = 0; iz < numBins; iz++) {
      const d = densities[ix][iz];
      if (d > 0) {
        bars.push({
          x: -RANGE + (ix + 0.5) * binWidth,
          z: -RANGE + (iz + 0.5) * binWidth,
          density: d,
          t: d / maxDensity,
        });
      }
    }
  }

  return { bars, binWidth, maxDensity };
}

const _obj = new THREE.Object3D();
const _col = new THREE.Color();

function Bars({
  binResult,
  heightScale,
}: {
  binResult: BinResult;
  heightScale: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { bars, binWidth } = binResult;

  useEffect(() => {
    const mesh = meshRef.current;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const h = bar.density * heightScale;
      _obj.position.set(bar.x, h / 2, bar.z);
      _obj.scale.set(binWidth * 0.88, Math.max(h, 0.005), binWidth * 0.88);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
      _col.setHSL(0.55 + bar.t * 0.08, 0.7, 0.32 + bar.t * 0.38);
      mesh.setColorAt(i, _col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bars, binWidth, heightScale]);

  if (bars.length === 0) return null;

  return (
    <instancedMesh
      key={bars.length}
      ref={meshRef}
      args={[undefined, undefined, bars.length]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial transparent opacity={0.85} />
    </instancedMesh>
  );
}

function PDFSurface({ heightScale }: { heightScale: number }) {
  const geometry = useMemo(() => {
    const res = 80;
    const step = (2 * RANGE) / res;
    const coeff = 1 / (2 * Math.PI);
    const c = new THREE.Color();

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= res; i++) {
      for (let j = 0; j <= res; j++) {
        const x = -RANGE + i * step;
        const z = -RANGE + j * step;
        const pdf = coeff * Math.exp(-0.5 * (x * x + z * z));
        positions.push(x, pdf * heightScale, z);

        const t = pdf / coeff;
        c.setHSL(0.42 - t * 0.12, 0.75, 0.35 + t * 0.35);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        const a = i * (res + 1) + j;
        const b = a + 1;
        const cc = (i + 1) * (res + 1) + j;
        const d = cc + 1;
        indices.push(a, b, cc, b, d, cc);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [heightScale]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function HistogramOrigin3D({
  samples,
  numBins,
  showCurve,
}: {
  samples: [number, number][];
  numBins: number;
  showCurve: boolean;
}) {
  const binResult = useMemo(() => bin2D(samples, numBins), [samples, numBins]);

  const pdfPeak = 1 / (2 * Math.PI);
  const yMax =
    Math.max(binResult.maxDensity, showCurve ? pdfPeak : 0) * 1.1;
  const heightScale = yMax > 0 ? PEAK_HEIGHT / yMax : 1;

  return (
    <Canvas
      camera={{ position: [7, 5.5, 7], fov: 45 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      style={{ background: "#0b1020" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-3, 8, -3]} intensity={0.3} />
      <Grid
        args={[2 * RANGE, 2 * RANGE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a2a4a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#2a3a5a"
        fadeDistance={20}
        fadeStrength={1}
      />
      <Bars binResult={binResult} heightScale={heightScale} />
      {showCurve && <PDFSurface heightScale={heightScale} />}
      <OrbitControls
        enablePan={false}
        maxDistance={20}
        minDistance={4}
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
