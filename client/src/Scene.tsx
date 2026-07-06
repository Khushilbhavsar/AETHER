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

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.5, 48, 48]} />
      <meshStandardMaterial color="#1d4f8f" roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

function Satellite({ node, index, total }: { node: NodeState; index: number; total: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const baseAngle = (index / total) * Math.PI * 2;
  const radius = 2.6 + (index % 3) * 0.35;
  const tilt = (index % 2 === 0 ? 1 : -1) * (0.2 + (index % 3) * 0.1);
  const speed = 0.25 + (index % 4) * 0.05;

  useFrame((state) => {
    if (!groupRef.current) return;
    const angle = baseAngle + state.clock.elapsedTime * speed;
    groupRef.current.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 0.6) * radius * tilt,
      Math.sin(angle) * radius
    );
  });

  const color = STATUS_COLOR[node.status];
  const pulse = node.failureRisk > 0.5 ? 1 + Math.sin(Date.now() / 150) * 0.15 : 1;

  return (
    <group ref={groupRef}>
      <mesh scale={pulse}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

export function Scene({ nodes }: { nodes: NodeState[] }) {
  return (
    <Canvas camera={{ position: [0, 2.5, 7], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} />
      <Starfield />
      <Earth />
      {nodes.map((node, i) => (
        <Satellite key={node.id} node={node} index={i} total={nodes.length} />
      ))}
      <Controls />
    </Canvas>
  );
}
