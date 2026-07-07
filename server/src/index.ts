/**
 * index.ts — the conductor. Owns the tick loop and the WebSocket server.
 *
 * Once per second it runs the sense -> think -> act cycle across the modules:
 *
 *   drift metrics (simulator) -> apply scenario/fault pressure -> derive
 *   health/status -> record history (monitor) -> score risk (predictor) ->
 *   heal (healing, acting on those fresh scores) -> derive again -> broadcast
 *
 * Order matters: healing must run after monitoring and prediction, or it
 * would decide on stale data. Everything the client sees arrives as one
 * FleetSnapshot per tick; everything the client can do arrives here as a
 * small ClientCommand (trigger fault / start scenario / toggle heal / reset).
 */

import { WebSocketServer, WebSocket } from "ws";
import { createFleet, tickNode, deriveStatus } from "./simulator.js";
import { progressFaults, maybeStartAmbientFault, triggerFault, makeEvent } from "./faults.js";
import { recordTick, getBroadcastHistory, computeFleetStats } from "./monitor.js";
import { applyHealing, setAutoHeal, isAutoHealEnabled } from "./healing.js";
import { predictFailureRisk } from "./predictor.js";
import { startScenario, progressScenario, getActiveScenario, resetFleet } from "./scenarios.js";
import { ClientCommand, FleetEvent, FleetSnapshot, RiskLevel } from "./types.js";

const PORT = 8080;
const TICK_MS = 1000;
const EVENT_LOG_LIMIT = 50;

const fleet = createFleet();
let eventLog: FleetEvent[] = [];

// Last known risk level per node, for detecting the low/medium -> high transition.
const prevRiskLevels = new Map<string, RiskLevel>();

function pushEvents(events: FleetEvent[]): void {
  if (events.length === 0) return;
  eventLog.push(...events);
  if (eventLog.length > EVENT_LOG_LIMIT) {
    eventLog = eventLog.slice(-EVENT_LOG_LIMIT);
  }
}

function tick(): void {
  // SENSE-THINK-ACT loop, in order: drift -> scenario/fault pressure -> derive
  // health -> record history -> predict -> heal (acts on fresh predictions) -> derive again.
  for (const node of fleet) {
    if (!node.isolated) tickNode(node);
  }

  pushEvents(progressScenario(fleet));
  progressFaults(fleet);
  pushEvents(maybeStartAmbientFault(fleet));

  for (const node of fleet) deriveStatus(node);

  recordTick(fleet);

  for (const node of fleet) {
    const prediction = predictFailureRisk(node);
    node.failureRisk = prediction.score;
    node.riskLevel = prediction.level;
    node.riskReason = prediction.reason;

    // Log the moment a node ENTERS high risk (not every tick it stays there),
    // with the predictor's explanation — foresight the operator can read.
    const previous = prevRiskLevels.get(node.id) ?? "low";
    if (prediction.level === "high" && previous !== "high" && prediction.reason !== "node has failed") {
      pushEvents([
        makeEvent("prediction", `${node.id} flagged HIGH RISK because: ${prediction.reason}`, node.id),
      ]);
    }
    prevRiskLevels.set(node.id, prediction.level);
  }

  pushEvents(applyHealing(fleet));

  for (const node of fleet) deriveStatus(node);

  broadcast();
}

const wss = new WebSocketServer({ port: PORT });

function broadcast(): void {
  const snapshot: FleetSnapshot = {
    type: "snapshot",
    timestamp: Date.now(),
    nodes: fleet,
    events: eventLog.slice(-20),
    history: getBroadcastHistory(fleet),
    stats: computeFleetStats(fleet),
    autoHeal: isAutoHealEnabled(),
    activeScenario: getActiveScenario(),
  };
  const payload = JSON.stringify(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function handleCommand(command: ClientCommand): void {
  switch (command.type) {
    case "trigger":
      pushEvents(triggerFault(fleet, command.fault));
      break;
    case "setAutoHeal":
      pushEvents(setAutoHeal(command.enabled));
      break;
    case "scenario":
      pushEvents(startScenario(fleet, command.scenario));
      break;
    case "reset":
      pushEvents(resetFleet(fleet));
      break;
  }
  broadcast();
}

wss.on("connection", (socket) => {
  console.log("Client connected");
  socket.on("message", (raw) => {
    try {
      handleCommand(JSON.parse(raw.toString()) as ClientCommand);
    } catch (err) {
      console.error("Bad client message", err);
    }
  });
  socket.on("close", () => console.log("Client disconnected"));
});

setInterval(tick, TICK_MS);

console.log(`AETHER server listening on ws://localhost:${PORT}`);
