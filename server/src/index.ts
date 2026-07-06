import { WebSocketServer, WebSocket } from "ws";
import { createFleet, tickNode, deriveStatus } from "./simulator.js";
import { progressFaults, maybeStartAmbientFault, triggerFault } from "./faults.js";
import { recordTick, getBroadcastHistory, computeFleetStats } from "./monitor.js";
import { applyHealing } from "./healing.js";
import { predictFailureRisk } from "./predictor.js";
import { ClientCommand, FleetEvent, FleetSnapshot } from "./types.js";

const PORT = 8080;
const TICK_MS = 1000;
const EVENT_LOG_LIMIT = 50;

const fleet = createFleet();
let eventLog: FleetEvent[] = [];

function pushEvents(events: FleetEvent[]): void {
  if (events.length === 0) return;
  eventLog.push(...events);
  if (eventLog.length > EVENT_LOG_LIMIT) {
    eventLog = eventLog.slice(-EVENT_LOG_LIMIT);
  }
}

function tick(): void {
  for (const node of fleet) {
    if (node.status !== "failed") tickNode(node);
  }

  progressFaults(fleet);
  pushEvents(maybeStartAmbientFault(fleet));

  for (const node of fleet) deriveStatus(node);

  recordTick(fleet);

  for (const node of fleet) {
    node.failureRisk = predictFailureRisk(node);
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
  };
  const payload = JSON.stringify(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on("connection", (socket) => {
  console.log("Client connected");
  socket.on("message", (raw) => {
    try {
      const command = JSON.parse(raw.toString()) as ClientCommand;
      if (command.type === "trigger") {
        pushEvents(triggerFault(fleet, command.fault));
        broadcast();
      }
    } catch (err) {
      console.error("Bad client message", err);
    }
  });
  socket.on("close", () => console.log("Client disconnected"));
});

setInterval(tick, TICK_MS);

console.log(`AETHER server listening on ws://localhost:${PORT}`);
