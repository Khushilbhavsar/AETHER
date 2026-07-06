import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { FaultKind, FleetEvent, FleetStats, NodeState } from "./types";

const STATUS_COLOR: Record<NodeState["status"], string> = {
  healthy: "#22c55e",
  degraded: "#eab308",
  failed: "#ef4444",
};

const EVENT_COLOR: Record<FleetEvent["kind"], string> = {
  fault: "#ef4444",
  heal: "#22c55e",
  prediction: "#eab308",
  info: "#94a3b8",
};

const FAULT_BUTTONS: { fault: FaultKind; label: string }[] = [
  { fault: "radiationSpike", label: "Radiation Spike" },
  { fault: "overheating", label: "Overheating" },
  { fault: "packetLoss", label: "Packet Loss" },
  { fault: "crash", label: "Node Crash" },
];

interface TrendPoint {
  time: string;
  avgHealth: number;
  avgRisk: number;
}

const TREND_LIMIT = 60;

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function Dashboard({
  nodes,
  events,
  stats,
  connected,
  onTrigger,
}: {
  nodes: NodeState[];
  events: FleetEvent[];
  stats: FleetStats | null;
  connected: boolean;
  onTrigger: (fault: FaultKind) => void;
}) {
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  useEffect(() => {
    if (stats) console.log("Fleet stats:", stats);
  }, [stats]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const avgHealth = average(nodes.map((n) => n.health));
    const avgRisk = average(nodes.map((n) => n.failureRisk)) * 100;
    setTrend((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString(undefined, { minute: "2-digit", second: "2-digit" }),
          avgHealth: Math.round(avgHealth),
          avgRisk: Math.round(avgRisk),
        },
      ];
      return next.length > TREND_LIMIT ? next.slice(-TREND_LIMIT) : next;
    });
  }, [nodes]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>AETHER — Mission Control</h1>
        <span className={`conn-badge ${connected ? "conn-up" : "conn-down"}`}>
          {connected ? "LINK ESTABLISHED" : "RECONNECTING…"}
        </span>
      </header>

      {stats && (
        <p className="fleet-stats-readout">
          Fleet health: {stats.avgHealth.toFixed(0)}% | Healthy {stats.healthy} / Degraded{" "}
          {stats.degraded} / Failed {stats.failed}
        </p>
      )}

      <section className="fault-buttons">
        {FAULT_BUTTONS.map((b) => (
          <button key={b.fault} onClick={() => onTrigger(b.fault)}>
            {b.label}
          </button>
        ))}
      </section>

      <section className="node-table">
        <table>
          <thead>
            <tr>
              <th>Node</th>
              <th>Status</th>
              <th>Health</th>
              <th>Temp</th>
              <th>Radiation</th>
              <th>CPU</th>
              <th>Mem</th>
              <th>Net</th>
              <th>Workload</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id}>
                <td>{n.id}</td>
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
                <td className={n.failureRisk > 0.5 ? "risk-high" : ""}>
                  {(n.failureRisk * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="trend-chart">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} width={30} stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Line type="monotone" dataKey="avgHealth" name="Fleet Health %" stroke="#22c55e" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="avgRisk" name="Failure Risk %" stroke="#eab308" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="event-log">
        <h2>Event Log</h2>
        <ul>
          {[...events].reverse().map((e) => (
            <li key={e.id} style={{ color: EVENT_COLOR[e.kind] }}>
              <span className="event-time">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>{" "}
              {e.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
