"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

const RANGE = 5;
const RESOLUTION = 100;
const PEAK_HEIGHT = 5;

function bivarGaussianPdf(
  x: number,
  z: number,
  muX: number,
  muZ: number,
  sigmaX: number,
  sigmaZ: number
): number {
  const coeff = 1 / (2 * Math.PI * sigmaX * sigmaZ);
  const expTerm =
    ((x - muX) ** 2) / (2 * sigmaX ** 2) +
    ((z - muZ) ** 2) / (2 * sigmaZ ** 2);
  return coeff * Math.exp(-expTerm);
}

function Surface({
  muX,
  muZ,
  sigmaX,
  sigmaZ,
}: {
  muX: number;
  muZ: number;
  sigmaX: number;
  sigmaZ: number;
}) {
  const geometry = useMemo(() => {
    const step = (2 * RANGE) / RESOLUTION;
    const peak = 1 / (2 * Math.PI * sigmaX * sigmaZ);
    const hScale = peak > 0 ? PEAK_HEIGHT / peak : 1;
    const c = new THREE.Color();

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= RESOLUTION; i++) {
      for (let j = 0; j <= RESOLUTION; j++) {
        const x = -RANGE + i * step;
        const z = -RANGE + j * step;
        const pdf = bivarGaussianPdf(x, z, muX, muZ, sigmaX, sigmaZ);
        positions.push(x, pdf * hScale, z);

        const t = Math.min(pdf / peak, 1);
        c.setHSL(0.42 - t * 0.15, 0.8, 0.3 + t * 0.45);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < RESOLUTION; i++) {
      for (let j = 0; j < RESOLUTION; j++) {
        const a = i * (RESOLUTION + 1) + j;
        const b = a + 1;
        const cc = (i + 1) * (RESOLUTION + 1) + j;
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
  }, [muX, muZ, sigmaX, sigmaZ]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

function MeanIndicator({
  muX,
  muZ,
}: {
  muX: number;
  muZ: number;
}) {
  return (
    <group>
      <mesh position={[muX, PEAK_HEIGHT / 2, muZ]}>
        <cylinderGeometry args={[0.03, 0.03, PEAK_HEIGHT, 8]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
      </mesh>
      <mesh position={[muX, PEAK_HEIGHT, muZ]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}

export default function GaussianPlot3D({
  muX,
  muZ,
  sigmaX,
  sigmaZ,
}: {
  muX: number;
  muZ: number;
  sigmaX: number;
  sigmaZ: number;
}) {
  return (
    <Canvas
      camera={{ position: [9, 7, 9], fov: 45 }}
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
        fadeDistance={25}
        fadeStrength={1}
      />
      <Surface muX={muX} muZ={muZ} sigmaX={sigmaX} sigmaZ={sigmaZ} />
      <MeanIndicator muX={muX} muZ={muZ} />
      <OrbitControls
        enablePan={false}
        maxDistance={22}
        minDistance={5}
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
