"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Text } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

/**
 * 3D vector addition.
 *
 * Dragging in 3D with a mouse is fiddly and unreliable for new users, so this
 * uses sliders for each component. Orbit the camera with the mouse to see how
 * the parallelogram lives in 3-space.
 *
 * Three.js/WebGL can't consume CSS variables, so colors are hardcoded hex
 * values that match the --vec-* tokens in globals.css.
 */

const A_COLOR = "#7c5cff"; // indigo  (matches --vec-a)
const B_COLOR = "#ff5f6d"; // rose    (matches --vec-b)
const SUM_COLOR = "#22c799"; // emerald (matches --vec-sum)

type Vec3 = [number, number, number];

const RANGE = 4;

export function VectorAdditionScene3D() {
  const [a, setA] = useState<Vec3>([2, 1, 0.5]);
  const [b, setB] = useState<Vec3>([0.5, 2, 1.5]);

  const sum = useMemo<Vec3>(() => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [a, b]);

  return (
    <div className="not-prose my-8 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="grid gap-0 md:grid-cols-[1fr_240px]">
        <div className="aspect-square w-full md:aspect-auto md:min-h-[440px]">
          <Canvas
            camera={{ position: [6, 5, 7], fov: 45 }}
            gl={{ antialias: true }}
            dpr={[1, 2]}
          >
            <color attach="background" args={["#0b1020"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 8, 5]} intensity={0.7} />

            <Grid
              args={[20, 20]}
              cellSize={1}
              cellThickness={0.6}
              cellColor="#2a2f4a"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#3a4068"
              fadeDistance={25}
              fadeStrength={1}
              infiniteGrid
              position={[0, 0, 0]}
            />

            <AxisLines />
            <Parallelogram a={a} b={b} sum={sum} />
            <Vector to={a} color={A_COLOR} label="a" />
            <Vector to={b} color={B_COLOR} label="b" />
            <Vector to={sum} color={SUM_COLOR} label="a+b" thickness={4} />

            {/* Tip-to-tail ghosts */}
            <Line
              points={[a, sum]}
              color={B_COLOR}
              lineWidth={1.5}
              dashed
              dashSize={0.15}
              gapSize={0.1}
              transparent
              opacity={0.55}
            />
            <Line
              points={[b, sum]}
              color={A_COLOR}
              lineWidth={1.5}
              dashed
              dashSize={0.15}
              gapSize={0.1}
              transparent
              opacity={0.55}
            />

            <OrbitControls
              enablePan={false}
              maxDistance={20}
              minDistance={4}
              dampingFactor={0.08}
            />
          </Canvas>
        </div>

        <aside className="flex flex-col gap-5 border-t border-border/60 p-5 md:border-t-0 md:border-l">
          <VecSliders label="a" color={A_COLOR} value={a} onChange={setA} />
          <VecSliders label="b" color={B_COLOR} value={b} onChange={setB} />
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold" style={{ color: SUM_COLOR }}>
                a + b
              </span>
              <span className="font-mono text-xs text-foreground/60">
                ({sum[0].toFixed(1)}, {sum[1].toFixed(1)}, {sum[2].toFixed(1)})
              </span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-foreground/50">
            Drag inside the canvas to orbit. The dashed lines show the same vector translated
            tip-to-tail — that&apos;s what makes the parallelogram.
          </p>
        </aside>
      </div>
    </div>
  );
}

function VecSliders({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: Vec3;
  onChange: (v: Vec3) => void;
}) {
  const setComp = (i: 0 | 1 | 2) => (n: number) => {
    const next: Vec3 = [...value];
    next[i] = n;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="font-mono text-xs text-foreground/60">
          ({value[0].toFixed(1)}, {value[1].toFixed(1)}, {value[2].toFixed(1)})
        </span>
      </div>
      {(["x", "y", "z"] as const).map((axis, i) => (
        <div key={axis} className="flex items-center gap-2">
          <span className="w-3 font-mono text-[10px] text-foreground/50">{axis}</span>
          <input
            type="range"
            min={-RANGE}
            max={RANGE}
            step={0.1}
            value={value[i]}
            onChange={(e) => setComp(i as 0 | 1 | 2)(Number(e.target.value))}
            className="flex-1 accent-current"
            style={{ color }}
          />
        </div>
      ))}
    </div>
  );
}

function Vector({
  to,
  color,
  label,
  thickness = 3,
}: {
  to: Vec3;
  color: string;
  label: string;
  thickness?: number;
}) {
  const origin: Vec3 = [0, 0, 0];
  const tip = new THREE.Vector3(...to);
  const length = tip.length();
  // Place arrowhead cone slightly before the tip so the line meets it cleanly
  const headLen = Math.min(0.35, length * 0.18);
  const headRadius = headLen * 0.45;
  const dir = tip.clone().normalize();
  const headBase = tip.clone().sub(dir.clone().multiplyScalar(headLen));

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [dir.x, dir.y, dir.z]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      <Line
        points={[origin, [headBase.x, headBase.y, headBase.z]]}
        color={color}
        lineWidth={thickness}
      />
      <mesh
        position={[
          (headBase.x + tip.x) / 2,
          (headBase.y + tip.y) / 2,
          (headBase.z + tip.z) / 2,
        ]}
        quaternion={quaternion}
      >
        <coneGeometry args={[headRadius, headLen, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[tip.x + 0.25, tip.y + 0.25, tip.z + 0.25]}
        fontSize={0.32}
        color={color}
        anchorX="left"
        anchorY="bottom"
      >
        {label}
      </Text>
    </group>
  );
}

function Parallelogram({ a, b, sum }: { a: Vec3; b: Vec3; sum: Vec3 }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0, 0,
      a[0], a[1], a[2],
      sum[0], sum[1], sum[2],

      0, 0, 0,
      sum[0], sum[1], sum[2],
      b[0], b[1], b[2],
    ]);
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [a, b, sum]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={SUM_COLOR}
        side={THREE.DoubleSide}
        transparent
        opacity={0.12}
      />
    </mesh>
  );
}

function AxisLines() {
  const len = 5;
  return (
    <>
      <Line points={[[-len, 0, 0], [len, 0, 0]]} color="#ff6b6b" lineWidth={1.5} />
      <Line points={[[0, -len, 0], [0, len, 0]]} color="#6bff8a" lineWidth={1.5} />
      <Line points={[[0, 0, -len], [0, 0, len]]} color="#6bb5ff" lineWidth={1.5} />
      <Text position={[len + 0.2, 0, 0]} fontSize={0.3} color="#ff6b6b">
        x
      </Text>
      <Text position={[0, len + 0.2, 0]} fontSize={0.3} color="#6bff8a">
        y
      </Text>
      <Text position={[0, 0, len + 0.2]} fontSize={0.3} color="#6bb5ff">
        z
      </Text>
    </>
  );
}
