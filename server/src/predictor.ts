import { NodeState, HistoryPoint } from "./types.js";
import { getHistory } from "./monitor.js";

const MIN_HISTORY = 8;

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance) || 1e-6; // avoid divide-by-zero
}

/** z-score of the latest value against the trailing baseline (all points except the latest). */
function deviationScore(points: HistoryPoint[], pick: (p: HistoryPoint) => number): number {
  const baseline = points.slice(0, -1).map(pick);
  const latest = pick(points[points.length - 1]);
  const avg = mean(baseline);
  const sd = stddev(baseline, avg);
  return Math.abs(latest - avg) / sd;
}

/**
 * Lightweight statistical anomaly score: how far the node's latest metrics deviate
 * from its own recent history, squashed into a 0-1 failure-risk probability.
 */
export function predictFailureRisk(node: NodeState): number {
  if (node.status === "failed") return 1;

  const points = getHistory(node.id);
  if (points.length < MIN_HISTORY) return 0;

  const zScores = [
    deviationScore(points, (p) => p.temperature),
    deviationScore(points, (p) => p.radiation),
    deviationScore(points, (p) => 100 - p.memoryHealth),
    deviationScore(points, (p) => 100 - p.networkHealth),
  ];
  const maxZ = Math.max(...zScores);

  // Squash z-score into 0-1: z=0 -> 0, z=3 -> ~0.63, z=6 -> ~0.86.
  let risk = 1 - Math.exp(-maxZ / 3);

  // Absolute thresholds nudge risk up regardless of trend, since a node already
  // near failure is high-risk even if it's been degraded for a while (low variance).
  if (node.temperature > 100) risk = Math.max(risk, 0.6);
  if (node.radiation > 0.8) risk = Math.max(risk, 0.7);
  if (node.memoryHealth < 40) risk = Math.max(risk, 0.6);
  if (node.networkHealth < 40) risk = Math.max(risk, 0.55);

  return Math.min(1, risk);
}
