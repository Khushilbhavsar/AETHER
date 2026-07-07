/**
 * types.ts — client-side mirror of server/src/types.ts.
 *
 * The wire contract: one FleetSnapshot arrives per tick over the WebSocket;
 * user actions go back as small ClientCommand messages. Keep this file in
 * lockstep with the server's copy when either side changes.
 */

export type NodeStatus = "healthy" | "degraded" | "failed";

export type FaultKind = "radiationSpike" | "overheating" | "packetLoss" | "crash";

export type ScenarioKind = "solarStorm" | "thermalOverload" | "networkCollapse" | "cascadingFailure";

export type RiskLevel = "low" | "medium" | "high";

export interface NodeState {
  id: string;
  temperature: number;
  radiation: number;
  cpuUsage: number;
  memoryHealth: number;
  networkHealth: number;
  health: number;
  status: NodeStatus;
  workload: number;
  isolated: boolean;
  failureRisk: number;
  riskLevel: RiskLevel;
  riskReason: string;
}

export type EventKind = "fault" | "heal" | "prediction" | "scenario" | "info";

export interface FleetEvent {
  id: string;
  timestamp: number;
  kind: EventKind;
  nodeId?: string;
  message: string;
}

export interface HistoryPoint {
  timestamp: number;
  temperature: number;
  radiation: number;
  cpuUsage: number;
  memoryHealth: number;
  networkHealth: number;
  health: number;
  status: NodeStatus;
}

export interface FleetStats {
  total: number;
  healthy: number;
  degraded: number;
  failed: number;
  avgHealth: number;
}

export interface FleetSnapshot {
  type: "snapshot";
  timestamp: number;
  nodes: NodeState[];
  events: FleetEvent[];
  history: Record<string, HistoryPoint[]>;
  stats: FleetStats;
  autoHeal: boolean;
  activeScenario: ScenarioKind | null;
}

export type ClientCommand =
  | { type: "trigger"; fault: FaultKind }
  | { type: "setAutoHeal"; enabled: boolean }
  | { type: "scenario"; scenario: ScenarioKind }
  | { type: "reset" };
