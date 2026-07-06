export type NodeStatus = "healthy" | "degraded" | "failed";

export type FaultKind = "radiationSpike" | "overheating" | "packetLoss" | "crash";

export type ScenarioKind = "solarStorm" | "thermalOverload" | "networkCollapse" | "cascadingFailure";

export type RiskLevel = "low" | "medium" | "high";

export interface NodeState {
  id: string;
  temperature: number; // abstract degrees, ~40-100 nominal
  radiation: number; // 0-1
  cpuUsage: number; // 0-100
  memoryHealth: number; // 0-100 (higher is better)
  networkHealth: number; // 0-100 (higher is better)
  health: number; // 0-100, composite derived each tick from the metrics above
  status: NodeStatus;
  workload: number; // 0-10 task units
  isolated: boolean; // healing pulled it out of rotation while it recovers
  failureRisk: number; // 0-1, predicted probability of failure (Phase 7)
  riskLevel: RiskLevel;
  riskReason: string; // human-readable explanation of the risk score
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

export type EventKind =
  | "fault"
  | "heal"
  | "prediction"
  | "scenario"
  | "info";

export interface FleetEvent {
  id: string;
  timestamp: number;
  kind: EventKind;
  nodeId?: string;
  message: string;
}

export interface FleetSnapshot {
  type: "snapshot";
  timestamp: number;
  nodes: NodeState[];
  events: FleetEvent[];
  history: Record<string, HistoryPoint[]>; // trimmed to last 30 points per node
  stats: FleetStats;
  autoHeal: boolean;
  activeScenario: ScenarioKind | null;
}

export type ClientCommand =
  | { type: "trigger"; fault: FaultKind }
  | { type: "setAutoHeal"; enabled: boolean }
  | { type: "scenario"; scenario: ScenarioKind }
  | { type: "reset" };
