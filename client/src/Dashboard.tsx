import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { FaultKind, FleetEvent, FleetStats, HistoryPoint, NodeState, ScenarioKind } from "./types";

const STATUS_COLOR: Record<NodeState["status"], string> = {
  healthy: "#22c55e",
  degraded: "#eab308",
  failed: "#ef4444",
};

const EVENT_COLOR: Record<FleetEvent["kind"], string> = {
  fault: "#ef4444",
  heal: "#22c55e",
  prediction: "#eab308",
  scenario: "#c084fc",
  info: "#94a3b8",
};

// Chart-line colors validated against the dark surface (lightness band, CVD, contrast).
const CHART_HEALTH = "#16a34a";
const CHART_RISK = "#b45309";

const FAULT_BUTTONS: { fault: FaultKind; label: string }[] = [
  { fault: "radiationSpike", label: "Radiation Spike" },
  { fault: "overheating", label: "Overheating" },
  { fault: "packetLoss", label: "Packet Loss" },
  { fault: "crash", label: "Node Crash" },
];

const SCENARIO_LABEL: Record<ScenarioKind, string> = {
  solarStorm: "SOLAR STORM",
  thermalOverload: "Thermal Overload",
  networkCollapse: "Network Collapse",
  cascadingFailure: "Cascading Failure",
};

interface TrendPoint {
  time: string;
  avgHealth: number;
  avgRisk: number | null; // null on points seeded from history (risk isn't stored there)
}

const TREND_LIMIT = 60;

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { minute: "2-digit", second: "2-digit" });
}

/** Rebuilds fleet-average health per tick from the broadcast per-node history. */
function seedFromHistory(history: Record<string, HistoryPoint[]>): TrendPoint[] {
  const buffers = Object.values(history).filter((b) => b.length > 0);
  if (buffers.length === 0) return [];
  // Align node buffers from the end — they can differ in length briefly.
  const length = Math.min(...buffers.map((b) => b.length));
  const points: TrendPoint[] = [];
  for (let i = 0; i < length; i++) {
    const slice = buffers.map((b) => b[b.length - length + i]);
    points.push({
      time: timeLabel(slice[0].timestamp),
      avgHealth: Math.round(average(slice.map((p) => p.health))),
      avgRisk: null,
    });
  }
  return points;
}

export function Dashboard({
  nodes,
  events,
  stats,
  history,
  autoHeal,
  activeScenario,
  connected,
  selectedId,
  onSelect,
  onTrigger,
  onSetAutoHeal,
  onScenario,
  onReset,
}: {
  nodes: NodeState[];
  events: FleetEvent[];
  stats: FleetStats | null;
  history: Record<string, HistoryPoint[]> | null;
  autoHeal: boolean;
  activeScenario: ScenarioKind | null;
  connected: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onTrigger: (fault: FaultKind) => void;
  onSetAutoHeal: (enabled: boolean) => void;
  onScenario: (scenario: ScenarioKind) => void;
  onReset: () => void;
}) {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const seededRef = useRef(false);

  useEffect(() => {
    if (nodes.length === 0 || !stats) return;
    const avgRisk = average(nodes.map((n) => n.failureRisk)) * 100;
    // First snapshot after load: backfill the chart from broadcast history so a
    // page refresh doesn't wipe the trend. Decided OUTSIDE the state updater —
    // updaters must stay pure (StrictMode double-invokes them).
    const seedPoints = !seededRef.current && history ? seedFromHistory(history) : null;
    seededRef.current = true;
    const point: TrendPoint = {
      time: timeLabel(Date.now()),
      avgHealth: Math.round(stats.avgHealth),
      avgRisk: Math.round(avgRisk),
    };
    setTrend((prev) => {
      const next = [...(seedPoints ?? prev), point];
      return next.length > TREND_LIMIT ? next.slice(-TREND_LIMIT) : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>AETHER — Mission Control</h1>
        <span className={`conn-badge ${connected ? "conn-up" : "conn-down"}`}>
          {connected ? "LINK ESTABLISHED" : "RECONNECTING…"}
        </span>
      </header>

      {activeScenario && (
        <div className="scenario-banner">⚠ {SCENARIO_LABEL[activeScenario].toUpperCase()} ACTIVE</div>
      )}

      {!autoHeal && (
        <div className="healoff-banner">⚠ AUTO-HEAL DISABLED — FLEET IS UNPROTECTED</div>
      )}

      {stats && (
        <section className="stat-tiles">
          <div className="stat-tile stat-hero">
            <span className="stat-value">{stats.avgHealth.toFixed(0)}%</span>
            <span className="stat-label">Fleet Health</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">
              <span className="status-dot" style={{ background: STATUS_COLOR.healthy }} />
              {stats.healthy}
            </span>
            <span className="stat-label">Healthy</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">
              <span className="status-dot" style={{ background: STATUS_COLOR.degraded }} />
              {stats.degraded}
            </span>
            <span className="stat-label">Degraded</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">
              <span className="status-dot" style={{ background: STATUS_COLOR.failed }} />
              {stats.failed}
            </span>
            <span className="stat-label">Failed</span>
          </div>
        </section>
      )}

      <section className="control-row">
        <button
          className={`autoheal-toggle ${autoHeal ? "autoheal-on" : "autoheal-off"}`}
          onClick={() => onSetAutoHeal(!autoHeal)}
        >
          AUTO-HEAL: {autoHeal ? "ON" : "OFF"}
        </button>
        <button className="reset-button" onClick={onReset}>
          Reset Fleet
        </button>
      </section>

      <section className="scenario-panel">
        <h2>Scenarios</h2>
        <button className="storm-button" onClick={() => onScenario("solarStorm")}>
          ☀ SOLAR STORM
        </button>
        <div className="scenario-buttons">
          <button onClick={() => onScenario("thermalOverload")}>Thermal Overload</button>
          <button onClick={() => onScenario("networkCollapse")}>Network Collapse</button>
          <button onClick={() => onScenario("cascadingFailure")}>Cascading Failure</button>
        </div>
      </section>

      <section className="fault-buttons">
        <h2>Single-Node Faults</h2>
        <div className="fault-grid">
          {FAULT_BUTTONS.map((b) => (
            <button key={b.fault} onClick={() => onTrigger(b.fault)}>
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="node-table">
        <table>
          <thead>
            <tr>
              <th>Node</th>
              <th>Status</th>
              <th>Health</th>
              <th>Temp</th>
              <th>Rad</th>
              <th>CPU</th>
              <th>Mem</th>
              <th>Net</th>
              <th>Load</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr
                key={n.id}
                className={n.id === selectedId ? "row-selected" : ""}
                title={n.riskReason}
                onClick={() => onSelect(n.id === selectedId ? null : n.id)}
              >
                <td>
                  {n.id}
                  {n.isolated && <span className="isolated-tag">ISO</span>}
                </td>
                <td>
                  <span className="status-dot" style={{ background: STATUS_COLOR[n.status] }} />
                  {n.status}
                </td>
                <td>{n.health.toFixed(0)}</td>
                <td>{n.temperature.toFixed(0)}°</td>
                <td>{n.radiation.toFixed(2)}</td>
                <td>{n.cpuUsage.toFixed(0)}%</td>
                <td>{n.memoryHealth.toFixed(0)}%</td>
                <td>{n.networkHealth.toFixed(0)}%</td>
                <td>{n.workload.toFixed(0)}</td>
                <td className={`risk-${n.riskLevel}`}>
                  {n.riskLevel.toUpperCase()} {(n.failureRisk * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected && (
          <p className="risk-reason">
            <strong>{selected.id}</strong> — {selected.riskLevel} risk: {selected.riskReason}
          </p>
        )}
      </section>

      <section className="trend-chart">
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} width={30} stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
            <Line type="monotone" dataKey="avgHealth" name="Fleet Health %" stroke={CHART_HEALTH} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="avgRisk" name="Failure Risk %" stroke={CHART_RISK} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="event-log">
        <h2>Event Log</h2>
        <ul>
          {[...events].reverse().map((e) => (
            <li key={e.id} style={{ color: EVENT_COLOR[e.kind] }}>
              <span className="event-time">{new Date(e.timestamp).toLocaleTimeString()}</span>{" "}
              {e.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
