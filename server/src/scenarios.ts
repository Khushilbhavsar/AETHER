import { NodeState, FleetEvent, ScenarioKind } from "./types.js";
import { makeEvent, clearFaults } from "./faults.js";
import { baselineNode } from "./simulator.js";
import { resetHealing } from "./healing.js";
import { clearHistory } from "./monitor.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const SCENARIO_LABEL: Record<ScenarioKind, string> = {
  solarStorm: "SOLAR STORM",
  thermalOverload: "THERMAL OVERLOAD",
  networkCollapse: "NETWORK COLLAPSE",
  cascadingFailure: "CASCADING FAILURE",
};

const SCENARIO_DURATION: Record<ScenarioKind, number> = {
  solarStorm: 15,
  thermalOverload: 12,
  networkCollapse: 12,
  cascadingFailure: 10,
};

interface ActiveScenario {
  kind: ScenarioKind;
  ticksRemaining: number;
}

let active: ActiveScenario | null = null;

export function getActiveScenario(): ScenarioKind | null {
  return active?.kind ?? null;
}

export function startScenario(fleet: NodeState[], kind: ScenarioKind): FleetEvent[] {
  if (active) return [makeEvent("scenario", `${SCENARIO_LABEL[active.kind]} already active — wait for it to subside`)];
  active = { kind, ticksRemaining: SCENARIO_DURATION[kind] };

  const events = [makeEvent("scenario", `⚠ ${SCENARIO_LABEL[kind]} — event begins`)];

  if (kind === "cascadingFailure") {
    // Tighten fleet capacity, then hard-kill the busiest node. Its migrated
    // workload overloads neighbors (overload -> heat, see simulator), chaining.
    for (const node of fleet) {
      node.workload = clamp(node.workload + 3, 0, 10);
    }
    const victim = [...fleet]
      .filter((n) => !n.isolated)
      .sort((a, b) => b.workload - a.workload)[0];
    if (victim) {
      victim.memoryHealth = 10;
      victim.networkHealth = 10;
      victim.temperature = 110;
      events.push(makeEvent("scenario", `${victim.id} suffers catastrophic failure under load`, victim.id));
    }
  }

  return events;
}

/** Applies one tick of scenario pressure; announces when the event subsides. */
export function progressScenario(fleet: NodeState[]): FleetEvent[] {
  if (!active) return [];

  switch (active.kind) {
    case "solarStorm":
      // Fleet-wide radiation surge; sustained exposure chews through memory,
      // disrupts comms, and heats the fleet. Unhealed, this fails nodes.
      for (const node of fleet) {
        if (node.isolated) continue;
        node.radiation = clamp(node.radiation + 0.08 + Math.random() * 0.06, 0, 1);
        node.networkHealth = clamp(node.networkHealth - 3, 0, 100);
        node.temperature = clamp(node.temperature + 2, 20, 140);
        if (node.radiation > 0.8) {
          node.memoryHealth = clamp(node.memoryHealth - 10, 0, 100);
        }
      }
      break;
    case "thermalOverload":
      for (const node of fleet.slice(0, 4)) {
        if (node.isolated) continue;
        node.temperature = clamp(node.temperature + 7, 20, 140);
      }
      break;
    case "networkCollapse":
      for (const node of fleet) {
        if (node.isolated) continue;
        node.networkHealth = clamp(node.networkHealth - 7 - Math.random() * 4, 0, 100);
      }
      break;
    case "cascadingFailure":
      // No sustained pressure — the initial shove plus overload heating carries the chain.
      break;
  }

  active.ticksRemaining -= 1;
  if (active.ticksRemaining <= 0) {
    const label = SCENARIO_LABEL[active.kind];
    active = null;
    return [makeEvent("scenario", `${label} subsiding — fleet recovering`)];
  }
  return [];
}

/** Returns every node to a healthy baseline for a clean demo restart. */
export function resetFleet(fleet: NodeState[]): FleetEvent[] {
  active = null;
  clearFaults();
  resetHealing();
  clearHistory();
  for (const node of fleet) {
    Object.assign(node, baselineNode(node.id));
  }
  return [makeEvent("info", "Fleet reset — all nodes restored to baseline")];
}
