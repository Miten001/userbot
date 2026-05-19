"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  Environment,
  MeshDistortMaterial,
  Stars,
  Icosahedron,
  Torus,
  Sphere,
} from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

/* Premium gold-metal distorted core */
function GoldCore() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.x = t * 0.18;
      ref.current.rotation.y = t * 0.28;
    }
  });
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <Icosahedron ref={ref} args={[1.45, 5]} position={[0, 0, 0]}>
        <MeshDistortMaterial
          color="#fbbf24"
          emissive="#b45309"
          emissiveIntensity={0.55}
          roughness={0.18}
          metalness={0.95}
          distort={0.45}
          speed={2.0}
        />
      </Icosahedron>
    </Float>
  );
}

/* Royal violet wireframe shell */
function WireShell() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.x = -t * 0.1;
      ref.current.rotation.y = t * 0.16;
    }
  });
  return (
    <Icosahedron ref={ref} args={[2.1, 1]}>
      <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.32} />
    </Icosahedron>
  );
}

/* Glowing inner sphere — adds depth */
function InnerHalo() {
  return (
    <Sphere args={[1.25, 48, 48]}>
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.08} />
    </Sphere>
  );
}

function OrbitRing({
  radius,
  tilt,
  color,
  speed,
  thickness = 0.012,
}: {
  radius: number;
  tilt: [number, number, number];
  color: string;
  speed: number;
  thickness?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) ref.current.rotation.z = t * speed;
  });
  return (
    <Torus ref={ref} args={[radius, thickness, 16, 220]} rotation={tilt}>
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </Torus>
  );
}

/* Tiny travelling planets on each orbit */
function OrbitPlanet({
  radius,
  tilt,
  color,
  speed,
  phase = 0,
  size = 0.08,
}: {
  radius: number;
  tilt: [number, number, number];
  color: string;
  speed: number;
  phase?: number;
  size?: number;
}) {
  const group = useRef<THREE.Group>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (group.current) group.current.rotation.z = t * speed + phase;
  });
  return (
    <group ref={group} rotation={tilt}>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

/* Gold sparkle particles around the core */
function GoldDust() {
  const ref = useRef<THREE.Points>(null!);
  const { positions, colors } = useMemo(() => {
    const count = 360;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#fde68a"),
      new THREE.Color("#fbbf24"),
      new THREE.Color("#a78bfa"),
      new THREE.Color("#34d399"),
      new THREE.Color("#f43f5e"),
    ];
    for (let i = 0; i < count; i++) {
      const r = 2.6 + Math.random() * 4.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.06;
      ref.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
      />
    </points>
  );
}

export default function Hero3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.4], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#02030a"]} />
      <fog attach="fog" args={["#02030a", 8, 14]} />

      {/* Cinematic 3-point lighting */}
      <ambientLight intensity={0.32} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} color="#fde68a" />
      <pointLight position={[-4, -2, -3]} intensity={1.6} color="#8b5cf6" />
      <pointLight position={[3, -3, 2]} intensity={1.0} color="#10b981" />
      <pointLight position={[0, 3, -2]} intensity={0.7} color="#f43f5e" />

      <Suspense fallback={null}>
        <Stars
          radius={55}
          depth={22}
          count={1800}
          factor={3}
          saturation={0}
          fade
          speed={0.5}
        />

        <InnerHalo />
        <GoldCore />
        <WireShell />

        {/* Orbit rings */}
        <OrbitRing
          radius={2.5}
          tilt={[Math.PI / 2.4, 0, 0]}
          color="#fbbf24"
          speed={0.4}
          thickness={0.014}
        />
        <OrbitRing
          radius={2.95}
          tilt={[Math.PI / 3, Math.PI / 6, 0]}
          color="#8b5cf6"
          speed={-0.3}
        />
        <OrbitRing
          radius={3.4}
          tilt={[Math.PI / 2, Math.PI / 3, 0]}
          color="#10b981"
          speed={0.22}
        />
        <OrbitRing
          radius={3.85}
          tilt={[Math.PI / 2.1, -Math.PI / 4, 0]}
          color="#f43f5e"
          speed={-0.16}
          thickness={0.008}
        />

        {/* Travelling planets on the rings */}
        <OrbitPlanet
          radius={2.5}
          tilt={[Math.PI / 2.4, 0, 0]}
          color="#fde68a"
          speed={0.4}
          size={0.09}
        />
        <OrbitPlanet
          radius={2.95}
          tilt={[Math.PI / 3, Math.PI / 6, 0]}
          color="#a78bfa"
          speed={-0.3}
          phase={1.2}
        />
        <OrbitPlanet
          radius={3.4}
          tilt={[Math.PI / 2, Math.PI / 3, 0]}
          color="#34d399"
          speed={0.22}
          phase={2.4}
        />

        <GoldDust />
        <Environment preset="warehouse" />
      </Suspense>
    </Canvas>
  );
}
