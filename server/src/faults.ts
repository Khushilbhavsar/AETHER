/**
 * faults.ts — the hostile environment.
 *
 * Creates the problems the rest of AETHER exists to solve. Faults are
 * per-node and ramp in over several ticks (a radiation spike builds, a crash
 * hits in two hard ticks) so a node visibly degrades rather than teleporting
 * to broken. Faults start two ways: a small ambient probability each tick
 * (space is hostile on its own) or an explicit trigger from the client's
 * demo buttons. Also owns the event-record factory (makeEvent) used by every
 * module that logs to the client.
 */

import { NodeState, FleetEvent, FaultKind } from "./types.js";

let eventCounter = 0;
function nextEventId(): string {
  eventCounter += 1;
  return `evt_${eventCounter}`;
}

export function makeEvent(kind: FleetEvent["kind"], message: string, nodeId?: string): FleetEvent {
  return { id: nextEventId(), timestamp: Date.now(), kind, nodeId, message };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const FAULT_DURATION_TICKS: Record<FaultKind, number> = {
  radiationSpike: 5,
  overheating: 5,
  packetLoss: 5,
  crash: 2,
};

const FAULT_LABEL: Record<FaultKind, string> = {
  radiationSpike: "Radiation spike",
  overheating: "Overheating",
  packetLoss: "Packet loss",
  crash: "Crash",
};

interface ActiveFault {
  kind: FaultKind;
  ticksRemaining: number;
}

// Faults ramp in over several ticks rather than applying instantly, so a node
// visibly degrades before healing (or the fault ending) settles it.
const activeFaults = new Map<string, ActiveFault>();

/** Applies one tick's worth of degradation for whatever fault is currently active on a node. */
function applyFaultTick(node: NodeState, kind: FaultKind): void {
  switch (kind) {
    case "radiationSpike":
      node.radiation = clamp(node.radiation + 0.15, 0, 1);
      if (node.radiation > 0.8) {
        node.memoryHealth = clamp(node.memoryHealth - 10, 0, 100);
      }
      break;
    case "overheating":
      node.temperature = clamp(node.temperature + 8, 20, 140);
      node.cpuUsage = clamp(node.cpuUsage - 6, 0, 100);
      break;
    case "packetLoss":
      node.networkHealth = clamp(node.networkHealth - 12, 0, 100);
      break;
    case "crash":
      // Severe by design: two ticks of this must drive health below the failure line.
      node.memoryHealth = clamp(node.memoryHealth - 40, 0, 100);
      node.networkHealth = clamp(node.networkHealth - 40, 0, 100);
      node.radiation = clamp(node.radiation + 0.2, 0, 1);
      node.temperature = clamp(node.temperature + 15, 20, 140);
      break;
  }
}

/** Advances every node's in-progress fault by one tick; clears faults that have run their course. */
export function progressFaults(fleet: NodeState[]): void {
  const byId = new Map(fleet.map((n) => [n.id, n]));
  for (const [nodeId, active] of activeFaults) {
    const node = byId.get(nodeId);
    if (!node) {
      activeFaults.delete(nodeId);
      continue;
    }
    applyFaultTick(node, active.kind);
    active.ticksRemaining -= 1;
    if (active.ticksRemaining <= 0) {
      activeFaults.delete(nodeId);
    }
  }
}

function pickEligibleNode(fleet: NodeState[]): NodeState | undefined {
  const candidates = fleet.filter(
    (n) => n.status !== "failed" && !n.isolated && !activeFaults.has(n.id)
  );
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Starts a fault of the given kind on one node (specific or, if omitted, a random eligible one). */
export function startFault(
  fleet: NodeState[],
  kind: FaultKind,
  nodeId?: string
): FleetEvent[] {
  const node = nodeId ? fleet.find((n) => n.id === nodeId) : pickEligibleNode(fleet);
  if (!node) return [];
  activeFaults.set(node.id, { kind, ticksRemaining: FAULT_DURATION_TICKS[kind] });
  return [makeEvent("fault", `${FAULT_LABEL[kind]} starting on ${node.id}`, node.id)];
}

const AMBIENT_FAULT_PROBABILITY = 0.04; // per tick, fleet-wide

/** Small ambient chance each tick that a random fault starts on a random eligible node. */
export function maybeStartAmbientFault(fleet: NodeState[]): FleetEvent[] {
  if (Math.random() >= AMBIENT_FAULT_PROBABILITY) return [];
  const kinds: FaultKind[] = ["radiationSpike", "overheating", "packetLoss", "crash"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  return startFault(fleet, kind);
}

/** Manual on-demand trigger (e.g. a demo button) — targets a random eligible node. */
export function triggerFault(fleet: NodeState[], kind: FaultKind): FleetEvent[] {
  return startFault(fleet, kind);
}

/** Cancels all in-progress faults (used by fleet reset). */
export function clearFaults(): void {
  activeFaults.clear();
}
