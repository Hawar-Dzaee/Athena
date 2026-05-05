"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Text } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

const A_COLOR = "#7c5cff";
const B_COLOR = "#ff5f6d";
const PROJ_COLOR = "#22c799";
const RES_COLOR = "#f59e0b";

type Vec3 = [number, number, number];

const RANGE = 4;

function dot3(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len3(v: Vec3) {
  return Math.sqrt(dot3(v, v));
}

export function ProjectionScene3D() {
  const [a, setA] = useState<Vec3>([2, 3, 1]);
  const [b, setB] = useState<Vec3>([3, 1, 0.5]);

  const proj = useMemo<Vec3>(() => {
    const bb = dot3(b, b);
    if (bb < 1e-9) return [0, 0, 0];
    const s = dot3(a, b) / bb;
    return [s * b[0], s * b[1], s * b[2]];
  }, [a, b]);

  const residual = useMemo<Vec3>(
    () => [a[0] - proj[0], a[1] - proj[1], a[2] - proj[2]],
    [a, proj],
  );

  const scalar = useMemo(() => {
    const bb = dot3(b, b);
    if (bb < 1e-9) return 0;
    return dot3(a, b) / bb;
  }, [a, b]);

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

            {/* Extended line through b */}
            <SubspaceLine b={b} />

            {/* Dashed drop line from a to proj */}
            <Line
              points={[a, proj]}
              color={RES_COLOR}
              lineWidth={1.5}
              dashed
              dashSize={0.15}
              gapSize={0.1}
              transparent
              opacity={0.5}
            />

            {/* Right-angle marker at projection point */}
            <RightAngle proj={proj} residual={residual} b={b} />

            <Arrow to={proj} color={PROJ_COLOR} label="proj" thickness={4} />
            <Arrow to={a} color={A_COLOR} label="a" />
            <Arrow to={b} color={B_COLOR} label="b" />
            <Arrow from={proj} to={a} color={RES_COLOR} label="r" thickness={2} />

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
              <span className="font-mono text-sm font-semibold" style={{ color: PROJ_COLOR }}>
                proj
              </span>
              <span className="font-mono text-xs text-foreground/60">
                ({proj[0].toFixed(1)}, {proj[1].toFixed(1)}, {proj[2].toFixed(1)})
              </span>
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-border/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/60">a · b</span>
              <span className="font-mono text-xs text-foreground/80">
                {dot3(a, b).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/60">scalar</span>
              <span className="font-mono text-xs text-foreground/80">
                {scalar.toFixed(3)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/60">|residual|</span>
              <span className="font-mono text-xs text-foreground/80">
                {len3(residual).toFixed(2)}
              </span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-foreground/50">
            Orbit the camera to see the right angle in 3D. The residual
            (amber) is always perpendicular to <strong>b</strong>.
          </p>
        </aside>
      </div>
    </div>
  );
}

function VecSliders({
  label, color, value, onChange,
}: {
  label: string; color: string; value: Vec3; onChange: (v: Vec3) => void;
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

function Arrow({
  from = [0, 0, 0] as Vec3,
  to,
  color,
  label,
  thickness = 3,
}: {
  from?: Vec3;
  to: Vec3;
  color: string;
  label: string;
  thickness?: number;
}) {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = dir.length();
  if (length < 1e-6) return null;
  const headLen = Math.min(0.35, length * 0.18);
  const headRadius = headLen * 0.45;
  const dirN = dir.clone().normalize();
  const headBase = new THREE.Vector3(...to).sub(dirN.clone().multiplyScalar(headLen));

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN);
    return q;
  }, [dirN.x, dirN.y, dirN.z]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      <Line
        points={[from, [headBase.x, headBase.y, headBase.z]]}
        color={color}
        lineWidth={thickness}
      />
      <mesh
        position={[
          (headBase.x + to[0]) / 2,
          (headBase.y + to[1]) / 2,
          (headBase.z + to[2]) / 2,
        ]}
        quaternion={quaternion}
      >
        <coneGeometry args={[headRadius, headLen, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[to[0] + 0.25, to[1] + 0.25, to[2] + 0.25]}
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

function SubspaceLine({ b }: { b: Vec3 }) {
  const bLen = len3(b);
  if (bLen < 1e-6) return null;
  const ext = 8;
  const d: Vec3 = [b[0] / bLen * ext, b[1] / bLen * ext, b[2] / bLen * ext];
  return (
    <Line
      points={[[-d[0], -d[1], -d[2]], d]}
      color={B_COLOR}
      lineWidth={1}
      transparent
      opacity={0.2}
    />
  );
}

function RightAngle({ proj, residual, b }: { proj: Vec3; residual: Vec3; b: Vec3 }) {
  const pLen = len3(proj);
  const rLen = len3(residual);
  if (pLen < 0.3 || rLen < 0.3) return null;

  const bLen = len3(b);
  if (bLen < 1e-6) return null;
  const bDir: Vec3 = [b[0] / bLen, b[1] / bLen, b[2] / bLen];
  const rDir: Vec3 = [residual[0] / rLen, residual[1] / rLen, residual[2] / rLen];

  const s = 0.25;
  const p0: Vec3 = [proj[0] - bDir[0] * s, proj[1] - bDir[1] * s, proj[2] - bDir[2] * s];
  const p1: Vec3 = [
    proj[0] - bDir[0] * s + rDir[0] * s,
    proj[1] - bDir[1] * s + rDir[1] * s,
    proj[2] - bDir[2] * s + rDir[2] * s,
  ];
  const p2: Vec3 = [proj[0] + rDir[0] * s, proj[1] + rDir[1] * s, proj[2] + rDir[2] * s];

  return (
    <Line
      points={[p0, p1, p2]}
      color="#ffffff"
      lineWidth={1.5}
      transparent
      opacity={0.4}
    />
  );
}

function AxisLines() {
  const l = 5;
  return (
    <>
      <Line points={[[-l, 0, 0], [l, 0, 0]]} color="#ff6b6b" lineWidth={1.5} />
      <Line points={[[0, -l, 0], [0, l, 0]]} color="#6bff8a" lineWidth={1.5} />
      <Line points={[[0, 0, -l], [0, 0, l]]} color="#6bb5ff" lineWidth={1.5} />
      <Text position={[l + 0.2, 0, 0]} fontSize={0.3} color="#ff6b6b">x</Text>
      <Text position={[0, l + 0.2, 0]} fontSize={0.3} color="#6bff8a">y</Text>
      <Text position={[0, 0, l + 0.2]} fontSize={0.3} color="#6bb5ff">z</Text>
    </>
  );
}
