import { NodeState, FleetEvent } from "./types.js";
import { makeEvent } from "./faults.js";

const FAIL_HEALTH = 33; // below this a node gets isolated
const RECOVER_HEALTH = 66; // isolated node rejoins rotation above this
const MAX_WORKLOAD = 10;

let autoHeal = true;

export function setAutoHeal(enabled: boolean): FleetEvent[] {
  if (autoHeal === enabled) return [];
  autoHeal = enabled;
  return [makeEvent("heal", enabled ? "Auto-heal ENABLED" : "Auto-heal DISABLED — fleet is on its own")];
}

export function isAutoHealEnabled(): boolean {
  return autoHeal;
}

// Tracks the last healing action applied per node so we only log on transitions,
// not every tick the condition remains true.
const lastAction = new Map<string, string>();

function logIfChanged(nodeId: string, action: string, message: string, events: FleetEvent[]): void {
  if (lastAction.get(nodeId) === action) return;
  lastAction.set(nodeId, action);
  events.push(makeEvent("heal", message, nodeId));
}

/**
 * Distributes a node's workload across the healthiest nodes with spare capacity.
 * Returns the ids that received work (for the log message).
 */
function migrateWorkload(fleet: NodeState[], from: NodeState): string[] {
  const targets = fleet
    .filter((n) => n.id !== from.id && !n.isolated && n.status === "healthy")
    .sort((a, b) => b.health - a.health);

  const receivers: string[] = [];
  for (const target of targets) {
    if (from.workload <= 0) break;
    const capacity = MAX_WORKLOAD - target.workload;
    if (capacity <= 0) continue;
    const moved = Math.min(capacity, from.workload);
    target.workload += moved;
    from.workload -= moved;
    receivers.push(target.id);
  }
  from.workload = Math.max(0, from.workload); // any remainder is shed (work lost)
  return receivers;
}

export function applyHealing(fleet: NodeState[]): FleetEvent[] {
  if (!autoHeal) return []; // healing off: the fleet degrades with no one to save it

  const events: FleetEvent[] = [];

  for (const node of fleet) {
    if (node.isolated) {
      // Gradual recovery while isolated — metrics repair over several ticks,
      // so the node visibly climbs red -> yellow -> green.
      node.temperature += (65 - node.temperature) * 0.25;
      node.radiation = Math.max(0.1, node.radiation - 0.12);
      node.memoryHealth = Math.min(100, node.memoryHealth + 8);
      node.networkHealth = Math.min(100, node.networkHealth + 8);
      node.cpuUsage = Math.min(100, Math.max(node.cpuUsage, 25));

      if (node.health > RECOVER_HEALTH) {
        node.isolated = false;
        node.workload = 2; // eases back into rotation with a light load
        lastAction.delete(node.id);
        events.push(
          makeEvent("heal", `${node.id} recovered (health ${node.health.toFixed(0)}) → back in rotation`, node.id)
        );
      }
      continue;
    }

    if (node.health < FAIL_HEALTH) {
      // Failed: isolate, migrate its workload to the healthiest nodes, begin recovery.
      node.isolated = true;
      const hadWork = node.workload > 0;
      const receivers = migrateWorkload(fleet, node);
      const migrationNote = hadWork
        ? receivers.length > 0
          ? ` → workload migrated to ${receivers.join(", ")}`
          : " → no capacity available, workload shed"
        : "";
      lastAction.set(node.id, "isolated");
      events.push(
        makeEvent(
          "heal",
          `${node.id} isolated (health ${node.health.toFixed(0)})${migrationNote} → recovering`,
          node.id
        )
      );
      continue;
    }

    // Preemptive action (Phase 7 tie-in): high predicted risk -> move work off
    // the node BEFORE it fails.
    if (node.riskLevel === "high" && node.workload > 0) {
      const receivers = migrateWorkload(fleet, node);
      if (receivers.length > 0) {
        logIfChanged(
          node.id,
          "preemptive",
          `Preemptive migration off ${node.id} (predicted failure: ${node.riskReason}) → ${receivers.join(", ")}`,
          events
        );
        continue;
      }
    }

    if (node.temperature > 100) {
      // Overheating: reduce workload to cut heat generation.
      node.workload = Math.max(0, node.workload - 1);
      node.temperature -= 4;
      logIfChanged(node.id, "cooling", `Reducing workload on ${node.id} to cool down`, events);
    } else if (node.radiation > 0.8) {
      // High radiation: migrate tasks off node preemptively.
      if (node.workload > 0) migrateWorkload(fleet, node);
      node.radiation -= 0.08;
      logIfChanged(node.id, "migrating", `Migrating workload off ${node.id} (radiation)`, events);
    } else if (node.networkHealth < 40) {
      // Packet loss: reroute traffic, let network recover.
      node.networkHealth = Math.min(100, node.networkHealth + 6);
      logIfChanged(node.id, "rerouting", `Rerouting traffic around ${node.id}`, events);
    } else if (node.memoryHealth < 40) {
      // Degraded memory: shed load while it recovers.
      node.workload = Math.max(0, node.workload - 1);
      node.memoryHealth = Math.min(100, node.memoryHealth + 5);
      logIfChanged(node.id, "mem-recovery", `Shedding load on ${node.id} to recover memory`, events);
    } else {
      // Nothing acute — passive recovery back toward baseline.
      if (lastAction.has(node.id)) {
        lastAction.delete(node.id);
        events.push(makeEvent("heal", `${node.id} stabilized`, node.id));
      }
      if (node.temperature > 70) node.temperature -= 1;
      if (node.memoryHealth < 90) node.memoryHealth += 1;
      if (node.networkHealth < 90) node.networkHealth += 1;
      // Residual radiation decays too — otherwise a fleet-wide surge leaves
      // health permanently depressed and nodes never return to green.
      if (node.radiation > 0.2) node.radiation = Math.max(0.2, node.radiation - 0.05);
    }
  }

  return events;
}

/** Clears healing bookkeeping (used by fleet reset). */
export function resetHealing(): void {
  lastAction.clear();
}
