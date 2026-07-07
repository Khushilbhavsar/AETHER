import { useMemo, useRef } from "react";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import { NodeState } from "./types";

extend({ OrbitControls });

const STATUS_COLOR: Record<NodeState["status"], string> = {
  healthy: "#22c55e",
  degraded: "#eab308",
  failed: "#ef4444",
};

function Controls() {
  const { camera, gl } = useThree();
  return <orbitControls args={[camera, gl.domElement]} enableDamping enablePan={false} minDistance={4} maxDistance={14} />;
}

function Starfield() {
  const positions = useMemo(() => {
    const count = 1500;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 40 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = radius * Math.cos(phi);
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#94a3b8" size={0.15} sizeAttenuation />
    </points>
  );
}

/** Deterministic pseudo-random generator so the planet looks the same every load. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Procedural Earth-like texture drawn on a canvas — no external image needed. */
function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(42);

  // Ocean
  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#123a63");
  ocean.addColorStop(0.5, "#1d4f8f");
  ocean.addColorStop(1, "#123a63");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Continents: clusters of overlapping blobs in the mid-latitudes
  const landColors = ["#2f6b3a", "#3d7a44", "#6b7f3a", "#8a7a4a"];
  for (let c = 0; c < 9; c++) {
    const cx = rand() * canvas.width;
    const cy = canvas.height * (0.2 + rand() * 0.6);
    const blobs = 14 + Math.floor(rand() * 18);
    ctx.fillStyle = landColors[Math.floor(rand() * landColors.length)];
    for (let b = 0; b < blobs; b++) {
      const x = cx + (rand() - 0.5) * 190;
      const y = cy + (rand() - 0.5) * 110;
      const rx = 14 + rand() * 46;
      const ry = 10 + rand() * 30;
      ctx.beginPath();
      ctx.ellipse((x + canvas.width) % canvas.width, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Polar ice caps
  ctx.fillStyle = "#dbe7f0";
  ctx.fillRect(0, 0, canvas.width, 26);
  ctx.fillRect(0, canvas.height - 26, canvas.width, 26);
  for (let i = 0; i < 40; i++) {
    const x = rand() * canvas.width;
    ctx.beginPath();
    ctx.ellipse(x, rand() < 0.5 ? 30 : canvas.height - 30, 12 + rand() * 26, 6 + rand() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft cloud wisps
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.ellipse(rand() * canvas.width, rand() * canvas.height, 24 + rand() * 60, 5 + rand() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createEarthTexture(), []);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.5, 48, 48]} />
      <meshStandardMaterial map={texture} roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

function Satellite({
  node,
  index,
  total,
  selected,
}: {
  node: NodeState;
  index: number;
  total: number;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const riskRingRef = useRef<THREE.Mesh>(null);
  const baseAngle = (index / total) * Math.PI * 2;
  const radius = 2.6 + (index % 3) * 0.35;
  const tilt = (index % 2 === 0 ? 1 : -1) * (0.2 + (index % 3) * 0.1);
  const speed = 0.25 + (index % 4) * 0.05;

  const highRisk = node.riskLevel === "high" && node.status !== "failed";

  useFrame((state) => {
    if (groupRef.current) {
      const angle = baseAngle + state.clock.elapsedTime * speed;
      groupRef.current.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 0.6) * radius * tilt,
        Math.sin(angle) * radius
      );
      groupRef.current.lookAt(state.camera.position); // rings face the viewer
    }
    if (riskRingRef.current) {
      // Pulsing warning ring: prediction flagging trouble BEFORE failure.
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.25;
      riskRingRef.current.scale.setScalar(pulse);
    }
  });

  const color = STATUS_COLOR[node.status];

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={node.isolated ? 0.3 : 0.9}
          transparent
          opacity={node.isolated ? 0.55 : 1}
        />
      </mesh>
      {highRisk && (
        <mesh ref={riskRingRef}>
          <torusGeometry args={[0.22, 0.02, 8, 32]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      )}
      {selected && (
        <mesh>
          <torusGeometry args={[0.3, 0.015, 8, 32]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      )}
    </group>
  );
}

export function Scene({ nodes, selectedId }: { nodes: NodeState[]; selectedId: string | null }) {
  return (
    <Canvas camera={{ position: [0, 2.5, 7], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} />
      <Starfield />
      <Earth />
      {nodes.map((node, i) => (
        <Satellite
          key={node.id}
          node={node}
          index={i}
          total={nodes.length}
          selected={node.id === selectedId}
        />
      ))}
      <Controls />
    </Canvas>
  );
}
