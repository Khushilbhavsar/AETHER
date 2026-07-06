import { NodeState, FleetEvent } from "./types.js";
import { makeEvent } from "./faults.js";

// Tracks the last healing action applied per node so we only log on transitions,
// not every tick the condition remains true.
const lastAction = new Map<string, string>();

function logIfChanged(nodeId: string, action: string, message: string, events: FleetEvent[]): void {
  if (lastAction.get(nodeId) === action) return;
  lastAction.set(nodeId, action);
  events.push(makeEvent("heal", message, nodeId));
}

export function applyHealing(fleet: NodeState[]): FleetEvent[] {
  const events: FleetEvent[] = [];

  for (const node of fleet) {
    if (node.status === "failed") {
      // Node failure: restart / reset node. Recovery isn't instant — small chance per tick.
      logIfChanged(node.id, "restarting", `Restarting ${node.id} after failure`, events);
      if (Math.random() < 0.25) {
        node.status = "healthy";
        node.temperature = 65;
        node.radiation = 0.15;
        node.cpuUsage = 35;
        node.memoryHealth = 95;
        node.networkHealth = 95;
        node.workload = 3;
        lastAction.delete(node.id);
        events.push(makeEvent("heal", `${node.id} restarted and recovered`, node.id));
      }
      continue;
    }

    if (node.temperature > 100) {
      // Overheating: reduce workload to cut heat generation.
      node.workload = Math.max(0, node.workload - 1);
      node.temperature -= 4;
      logIfChanged(node.id, "cooling", `Reducing workload on ${node.id} to cool down`, events);
    } else if (node.radiation > 0.8) {
      // High radiation: migrate tasks off node.
      if (node.workload > 0) {
        migrateWorkload(fleet, node);
      }
      node.radiation -= 0.05;
      logIfChanged(node.id, "migrating", `Migrating workload off ${node.id} (radiation)`, events);
    } else if (node.networkHealth < 40) {
      // Packet loss: reroute traffic, let network recover.
      node.networkHealth = Math.min(100, node.networkHealth + 6);
      logIfChanged(node.id, "rerouting", `Rerouting traffic around ${node.id}`, events);
    } else if (node.memoryHealth < 40) {
      // Degraded memory: isolate node while it recovers.
      node.workload = Math.max(0, node.workload - 1);
      node.memoryHealth = Math.min(100, node.memoryHealth + 5);
      logIfChanged(node.id, "isolating", `Isolating ${node.id} to recover memory health`, events);
    } else {
      // Nothing acute — passive recovery back toward baseline.
      if (lastAction.has(node.id)) {
        lastAction.delete(node.id);
        events.push(makeEvent("heal", `${node.id} stabilized`, node.id));
      }
      if (node.temperature > 70) node.temperature -= 1;
      if (node.memoryHealth < 90) node.memoryHealth += 1;
      if (node.networkHealth < 90) node.networkHealth += 1;
    }
  }

  return events;
}

function migrateWorkload(fleet: NodeState[], from: NodeState): void {
  const target = fleet
    .filter((n) => n.id !== from.id && n.status === "healthy")
    .sort((a, b) => a.workload - b.workload)[0];
  if (target) {
    target.workload += from.workload;
  }
  from.workload = 0;
}
