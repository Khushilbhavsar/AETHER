export type NodeStatus = "healthy" | "degraded" | "failed";

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
  failureRisk: number;
}

export type EventKind = "fault" | "heal" | "prediction" | "info";

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
}

export type FaultKind = "radiationSpike" | "overheating" | "packetLoss" | "crash";
