# AETHER — Autonomous Orbital Infrastructure Intelligence

A prototype of the "self-driving brain" for orbital data centers: a simulated
fleet of orbital server nodes, visualized as a rotating 3D Earth with
satellites, that **senses** its own health, **predicts** failures before they
happen, and **heals** itself — with zero human intervention.

## Run it

Two terminals:

```
cd server && npm install && npm run dev   # WebSocket backend, ws://localhost:8080
cd client && npm install && npm run dev   # React + R3F frontend, http://localhost:5173
```

Open `http://localhost:5173`. You should see the Earth with 6 satellites
(green/yellow/red = healthy/degraded/failed) and the mission-control dashboard.

## Features

- **Live simulation** — 6 nodes tick every second with drifting metrics
  (temperature, radiation, CPU, memory, network); overloaded nodes run hot.
- **Fault injection** — ambient random faults plus manual triggers (radiation
  spike, overheating, packet loss, crash) that ramp in over several ticks.
- **Monitoring + history** — rolling 100-tick history per node, fleet-wide
  stats, all streamed over WebSocket.
- **Failure prediction** — an explainable statistical risk score per node
  (low/medium/high) with a human-readable reason, e.g. *"radiation trending up
  + health falling over last 8 ticks."* High-risk satellites get a pulsing
  orange warning ring in the 3D view **before** they fail.
- **Self-healing** — rule-based: failed nodes are isolated and recover
  gradually, workloads migrate to the healthiest nodes with capacity, high-risk
  nodes are drained **preemptively**. Toggle **AUTO-HEAL** off to watch the
  fleet collapse without it — then back on to watch AETHER save it.
- **Scenario modes** — SOLAR STORM (fleet-wide radiation surge), thermal
  overload, network collapse, and a cascading-failure stress test. Each runs
  for a fixed duration, then subsides so recovery is visible. Reset Fleet
  restores a clean baseline (and re-enables auto-heal).

## The demo script

1. Reset Fleet — all green, dashboard live
2. Hit **SOLAR STORM** — radiation surges, banner appears
3. Predictor flags nodes high-risk (pulsing rings) before they fail
4. Healing migrates workloads preemptively; failed nodes are isolated and recover
5. Storm subsides — fleet returns to green
6. Toggle **AUTO-HEAL OFF**, storm again — the fleet collapses without AETHER
7. Toggle back ON — AETHER rescues it

## Architecture

- `server/src/simulator.ts` — fleet state, per-tick drift, composite health score
- `server/src/faults.ts` — ambient + on-demand fault injection (gradual, multi-tick)
- `server/src/monitor.ts` — rolling per-node history buffer + fleet stats
- `server/src/predictor.ts` — trend-based risk score, level, and readable reason
- `server/src/healing.ts` — rule-based recovery: isolate, migrate, reroute, cool down
- `server/src/scenarios.ts` — solar storm & friends, fleet reset
- `server/src/index.ts` — sense→think→act tick loop + WebSocket broadcast
- `client/src/Scene.tsx` — 3D Earth + satellites, risk rings (React Three Fiber)
- `client/src/Dashboard.tsx` — mission control: stat tiles, trend chart, node table, event log
