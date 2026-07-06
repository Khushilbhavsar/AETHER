import { NodeState } from "./types.js";

const NODE_COUNT = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function drift(value: number, amount: number, min: number, max: number): number {
  return clamp(value + (Math.random() - 0.5) * amount, min, max);
}

export function createFleet(): NodeState[] {
  const fleet: NodeState[] = [];
  for (let i = 1; i <= NODE_COUNT; i++) {
    fleet.push({
      id: `node_${i}`,
      temperature: 60 + Math.random() * 15,
      radiation: 0.1 + Math.random() * 0.15,
      cpuUsage: 30 + Math.random() * 20,
      memoryHealth: 90 + Math.random() * 10,
      networkHealth: 90 + Math.random() * 10,
      health: 100,
      status: "healthy",
      workload: 3 + Math.floor(Math.random() * 3),
      failureRisk: 0,
    });
  }
  return fleet;
}

/** Nudges one node's raw metrics with small random drift. Faults/healing adjust further. */
export function tickNode(node: NodeState): void {
  node.temperature = drift(node.temperature, 3, 20, 120);
  node.radiation = drift(node.radiation, 0.03, 0, 1);
  node.cpuUsage = drift(node.cpuUsage, 5, 0, 100);
  node.memoryHealth = drift(node.memoryHealth, 2, 0, 100);
  node.networkHealth = drift(node.networkHealth, 2, 0, 100);
}

/** Composite 0-100 health score: higher metric stress (heat, radiation) pulls it down. */
function computeHealth(node: NodeState): number {
  const radiationScore = 100 - node.radiation * 100;
  const temperatureScore = 100 - Math.max(0, node.temperature - 60);
  const score =
    0.25 * node.memoryHealth +
    0.25 * node.networkHealth +
    0.25 * radiationScore +
    0.15 * temperatureScore +
    0.1 * node.cpuUsage;
  return clamp(score, 0, 100);
}

/** Derives health + status from current metrics (faults/healing already applied). */
export function deriveStatus(node: NodeState): void {
  if (node.status === "failed") {
    node.health = Math.min(node.health, 32);
    return; // only healing can bring a failed node back
  }
  node.health = computeHealth(node);
  if (node.health < 33) {
    node.status = "failed";
  } else if (node.health <= 66) {
    node.status = "degraded";
  } else {
    node.status = "healthy";
  }
}
