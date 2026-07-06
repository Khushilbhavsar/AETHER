import { NodeState, HistoryPoint, FleetStats } from "./types.js";

const HISTORY_LIMIT = 100;
const BROADCAST_LIMIT = 30;

const history = new Map<string, HistoryPoint[]>();

export function recordTick(fleet: NodeState[]): void {
  const timestamp = Date.now();
  for (const node of fleet) {
    const point: HistoryPoint = {
      timestamp,
      temperature: node.temperature,
      radiation: node.radiation,
      cpuUsage: node.cpuUsage,
      memoryHealth: node.memoryHealth,
      networkHealth: node.networkHealth,
      health: node.health,
      status: node.status,
    };
    const buffer = history.get(node.id) ?? [];
    buffer.push(point);
    if (buffer.length > HISTORY_LIMIT) buffer.shift();
    history.set(node.id, buffer);
  }
}

export function getHistory(nodeId: string): HistoryPoint[] {
  return history.get(nodeId) ?? [];
}

/** Trimmed history for every node, suitable for broadcasting over WebSocket each tick. */
export function getBroadcastHistory(fleet: NodeState[]): Record<string, HistoryPoint[]> {
  const out: Record<string, HistoryPoint[]> = {};
  for (const node of fleet) {
    out[node.id] = (history.get(node.id) ?? []).slice(-BROADCAST_LIMIT);
  }
  return out;
}

export function computeFleetStats(fleet: NodeState[]): FleetStats {
  const total = fleet.length;
  const healthy = fleet.filter((n) => n.status === "healthy").length;
  const degraded = fleet.filter((n) => n.status === "degraded").length;
  const failed = fleet.filter((n) => n.status === "failed").length;
  const avgHealth = total === 0 ? 0 : fleet.reduce((sum, n) => sum + n.health, 0) / total;
  return { total, healthy, degraded, failed, avgHealth };
}
