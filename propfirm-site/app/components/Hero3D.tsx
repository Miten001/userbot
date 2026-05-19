"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  Environment,
  MeshDistortMaterial,
  Stars,
  Icosahedron,
  Torus,
} from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";

function CoreBlob() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.x = t * 0.15;
      ref.current.rotation.y = t * 0.25;
    }
  });
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <Icosahedron ref={ref} args={[1.4, 6]} position={[0, 0, 0]}>
        <MeshDistortMaterial
          color="#22d3ee"
          emissive="#0e7490"
          emissiveIntensity={0.6}
          roughness={0.15}
          metalness={0.7}
          distort={0.45}
          speed={2.2}
        />
      </Icosahedron>
    </Float>
  );
}

function Wireframe() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.x = -t * 0.1;
      ref.current.rotation.y = t * 0.18;
    }
  });
  return (
    <Icosahedron ref={ref} args={[2.05, 1]}>
      <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.35} />
    </Icosahedron>
  );
}

function OrbitRing({
  radius,
  tilt,
  color,
  speed,
}: {
  radius: number;
  tilt: [number, number, number];
  color: string;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) ref.current.rotation.z = t * speed;
  });
  return (
    <Torus ref={ref} args={[radius, 0.012, 16, 200]} rotation={tilt}>
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </Torus>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null!);
  const count = 280;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 3 + Math.random() * 3.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) ref.current.rotation.y = t * 0.05;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#67e8f9"
        sizeAttenuation
        transparent
        opacity={0.85}
      />
    </points>
  );
}

export default function Hero3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#04060b"]} />
      <fog attach="fog" args={["#04060b", 8, 14]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 5, 5]} intensity={1.1} color="#22d3ee" />
      <pointLight position={[-4, -2, -3]} intensity={1.4} color="#a78bfa" />
      <pointLight position={[3, -3, 2]} intensity={0.8} color="#34d399" />

      <Suspense fallback={null}>
        <Stars
          radius={50}
          depth={20}
          count={1500}
          factor={3}
          saturation={0}
          fade
          speed={0.6}
        />
        <CoreBlob />
        <Wireframe />
        <OrbitRing
          radius={2.5}
          tilt={[Math.PI / 2.4, 0, 0]}
          color="#22d3ee"
          speed={0.4}
        />
        <OrbitRing
          radius={2.9}
          tilt={[Math.PI / 3, Math.PI / 6, 0]}
          color="#a78bfa"
          speed={-0.3}
        />
        <OrbitRing
          radius={3.3}
          tilt={[Math.PI / 2, Math.PI / 3, 0]}
          color="#34d399"
          speed={0.22}
        />
        <Particles />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
