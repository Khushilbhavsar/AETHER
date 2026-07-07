/**
 * predictor.ts — the foresight. Explainable statistical failure prediction.
 *
 * Deliberately NOT a trained model: pure statistics over the history buffer
 * from monitor.ts, so every score can be explained in one sentence. Two
 * signals combine into a 0-1 risk score per node:
 *
 *   - adverse trends: radiation rising / health falling / temperature climbing
 *     across the last TREND_WINDOW ticks (recent-half vs earlier-half average)
 *   - anomaly: latest value deviating sharply (z-score) from the node's own
 *     recent baseline, with a noise floor so ordinary drift doesn't register
 *
 * Absolute danger zones (radiation > 0.8 etc.) put a floor under the score,
 * because a node already at the edge is high-risk even if it's been sitting
 * there long enough for its variance to flatten. The healing engine reads the
 * resulting level: HIGH triggers preemptive workload migration BEFORE failure.
 */

import { NodeState, HistoryPoint, RiskLevel } from "./types.js";
import { getHistory } from "./monitor.js";

const MIN_HISTORY = 8;
const TREND_WINDOW = 8;

export interface Prediction {
  score: number; // 0-1
  level: RiskLevel;
  reason: string;
}

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

/** Recent-vs-earlier average difference over the trend window: positive = rising. */
function trend(points: HistoryPoint[], pick: (p: HistoryPoint) => number): number {
  const window = points.slice(-TREND_WINDOW);
  if (window.length < 4) return 0;
  const half = Math.floor(window.length / 2);
  const earlier = mean(window.slice(0, half).map(pick));
  const recent = mean(window.slice(half).map(pick));
  return recent - earlier;
}

/**
 * Lightweight, explainable failure prediction: adverse trends over the node's
 * recent history plus sharp deviation from its own baseline, combined into a
 * 0-1 risk score with a human-readable reason.
 */
export function predictFailureRisk(node: NodeState): Prediction {
  if (node.status === "failed") {
    return { score: 1, level: "high", reason: "node has failed" };
  }

  const points = getHistory(node.id);
  if (points.length < MIN_HISTORY) {
    return { score: 0, level: "low", reason: "collecting baseline data" };
  }

  const factors: string[] = [];

  // Adverse trends over the last N ticks.
  if (trend(points, (p) => p.radiation) > 0.06) factors.push("radiation trending up");
  if (trend(points, (p) => p.health) < -4) factors.push("health falling");
  if (trend(points, (p) => p.temperature) > 4) factors.push("temperature climbing");
  if (trend(points, (p) => p.networkHealth) < -5) factors.push("network degrading");

  // Sharp deviation from the node's own recent baseline.
  const zScores = [
    deviationScore(points, (p) => p.temperature),
    deviationScore(points, (p) => p.radiation),
    deviationScore(points, (p) => 100 - p.memoryHealth),
    deviationScore(points, (p) => 100 - p.networkHealth),
  ];
  const maxZ = Math.max(...zScores);
  if (maxZ > 2.5) factors.push("sharp deviation from baseline");

  // Absolute danger zones count regardless of trend, since a node already near
  // the edge is high-risk even if it's been sitting there a while (low variance).
  if (node.radiation > 0.8) factors.push(`radiation critical (${node.radiation.toFixed(2)})`);
  if (node.temperature > 100) factors.push(`overheating (${node.temperature.toFixed(0)}°)`);
  if (node.memoryHealth < 40) factors.push("memory degraded");

  // Squash z into 0-1 with a noise floor: ordinary drift sits around z 1-2 and
  // shouldn't register; only genuine departures (z > ~1.5) start scoring.
  let score = 1 - Math.exp(-Math.max(0, maxZ - 1.5) / 2.5);
  score += factors.length * 0.13;
  if (node.radiation > 0.8) score = Math.max(score, 0.72);
  if (node.temperature > 100) score = Math.max(score, 0.6);
  if (node.health < 45) score = Math.max(score, 0.6);
  score = Math.min(1, score);

  const level: RiskLevel = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";

  const reason =
    factors.length > 0
      ? `${factors.join(" + ")} over last ${TREND_WINDOW} ticks`
      : "metrics stable";

  return { score, level, reason };
}
