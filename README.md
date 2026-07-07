# AETHER — Autonomous Orbital Infrastructure Intelligence

*A self-healing management brain for data centers in space, demonstrated on a live simulated fleet with a real-time 3D digital twin.*

---

## The Problem

As AI compute demand outgrows Earth's power and land, companies are seriously exploring orbital data centers — continuous solar power, natural cooling, no land use. But space is a brutally hostile place to run servers: constant radiation flips bits and degrades chips, temperature swings between sunlight and shadow stress the hardware, and when a node fails there is **no technician who can reach it** — a dead server is either permanently lost or a multi-million-dollar repair mission. Worse, failures cascade: one dying node dumps its workload onto its neighbors, which overload and fail in turn. Keeping a fleet of servers alive, healthy, and doing useful work in an unreachable environment — **with zero human intervention** — is a genuine unsolved infrastructure problem.

## The Solution

AETHER is the autonomous intelligence layer such a fleet would need. It runs a continuous **sense → think → act** loop:

| Capability | What it does |
|---|---|
| **Monitoring** (sense) | Tracks every node's temperature, radiation, CPU, memory, and network health each second; keeps a rolling history per node |
| **Prediction** (think) | An explainable statistical model scores each node's failure risk from its trends — *before* it fails — with a human-readable reason for every score |
| **Self-healing** (act) | Rule-based recovery with no human in the loop: isolates failing nodes, migrates workloads to the healthiest nodes, drains high-risk nodes preemptively, and brings recovered nodes back into rotation |
| **Digital twin** (see) | A live 3D view of the fleet orbiting Earth plus a mission-control dashboard, so an operator can watch the system save itself |

Every action the system takes is logged with a plain-English explanation, e.g.
`node_4 isolated because: health 32 fell below 33 → workload migrated to node_1, node_5 → recovering`.

## Architecture

```
┌─────────────────────────── server · Node.js + TypeScript ───────────────────────────┐
│                                                                                      │
│   scenarios.ts ─┐  (solar storm, cascading failure, …)                              │
│   faults.ts ────┤  hostile-environment pressure                                     │
│                 ▼                                                                    │
│   simulator.ts ──► monitor.ts ──► predictor.ts ──► healing.ts                        │
│   fleet state      rolling         risk score       isolate · migrate ·             │
│   + health         history         + reason         recover · preempt               │
│                                                                                      │
│      SENSE ─────────► THINK ─────────► ACT      (index.ts runs the loop every 1s)   │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │  WebSocket — one fleet snapshot per second
┌──────────────────────────────────────▼───────────────────────────────────────────────┐
│  client · React + Vite                                                               │
│                                                                                      │
│   useSocket.ts ──► App.tsx ──┬──► Scene.tsx      3D digital twin (React Three Fiber)│
│                              └──► Dashboard.tsx  mission control (Recharts)         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Each module has a single responsibility and a header comment explaining its role — the codebase is written to be read.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, TypeScript, `ws` (WebSocket) |
| Simulation & AI | Pure TypeScript — statistical anomaly detection (explainable, no black-box model) |
| Frontend | React 18, Vite, TypeScript |
| 3D visualization | Three.js via React Three Fiber |
| Charts | Recharts |
| State | In-memory, by design — no database or containers needed to run the demo |

## Key Features

- **Live fleet simulation** — 6 orbital nodes tick every second with drifting metrics; overloaded nodes genuinely run hot, which is what makes failures cascade
- **Fault injection** — ambient random faults plus on-demand triggers (radiation spike, overheating, packet loss, crash) that ramp in over several ticks
- **Explainable failure prediction** — per-node risk level (low/medium/high) with reasons like *"radiation trending up + health falling over last 8 ticks"*; high-risk satellites get a pulsing warning ring in 3D **before** they turn red
- **Autonomous self-healing** — isolation, gradual recovery, capacity-aware workload migration, and preemptive draining of predicted-to-fail nodes; every action logged with its cause and the actual metric values
- **Scenario modes** — SOLAR STORM (fleet-wide radiation surge), thermal overload, network collapse, and a cascading-failure stress test; each subsides so recovery is visible
- **The killer demo** — toggle **AUTO-HEAL OFF** and watch a storm destroy the fleet; toggle it back **ON** and watch AETHER rescue it
- **Mission-control dashboard** — fleet stat tiles, health/risk trend chart (survives page refresh), per-node table with click-to-inspect, live event log

## Demo

> 📸 *Placeholder — add a demo GIF here:*
> `![AETHER demo](docs/demo.gif)`

| Fleet healthy | Solar storm hits | Fleet recovered |
|---|---|---|
| *screenshot placeholder* | *screenshot placeholder* | *screenshot placeholder* |

> Suggested captures: the all-green fleet, the storm at its peak (red/yellow satellites with warning rings), and the recovered fleet with the event log showing the isolation → recovery arc.

## Getting Started

### Prerequisites

- [Node.js LTS](https://nodejs.org) (v20+) — check with `node --version`

### 1. Clone and install

```bash
git clone https://github.com/Khushilbhavsar/AETHER.git
cd AETHER

# backend dependencies
cd server && npm install

# frontend dependencies
cd ../client && npm install
```

### 2. Run (two terminals)

**Terminal 1 — backend:**
```bash
cd server
npm run dev
# → AETHER server listening on ws://localhost:8080
```

**Terminal 2 — frontend:**
```bash
cd client
npm run dev
# → Local: http://localhost:5173/
```

### 3. Open the app

Go to **http://localhost:5173**. You should see the Earth with six green satellites and the badge **LINK ESTABLISHED**.

### 4. Run the demo script

1. Click **Reset Fleet** — clean baseline, all green
2. Click **☀ SOLAR STORM** — radiation surges, the warning banner appears
3. Watch the predictor flag nodes **HIGH RISK** (pulsing rings + reasons under the node table) *before* they fail
4. Watch healing act: preemptive migrations, isolations, and recoveries — every action explained in the event log
5. The storm subsides; the fleet returns to green
6. Now toggle **AUTO-HEAL: OFF** and run the storm again — the fleet collapses with no one to save it
7. Toggle auto-heal back **ON** — AETHER rescues the fleet in seconds

That contrast — the same disaster with and without AETHER — is the whole thesis in one demo.

## Project Structure

```
aether/
├── server/src/
│   ├── index.ts        # tick loop + WebSocket broadcast (the conductor)
│   ├── types.ts        # shared wire contract
│   ├── simulator.ts    # fleet state, metric drift, composite health score
│   ├── faults.ts       # hostile environment: gradual per-node fault injection
│   ├── monitor.ts      # rolling history buffer + fleet stats (the senses)
│   ├── predictor.ts    # explainable statistical failure prediction (the foresight)
│   ├── healing.ts      # rule-based autonomous recovery (the hands)
│   └── scenarios.ts    # solar storm & friends, fleet reset (the demo climax)
└── client/src/
    ├── useSocket.ts    # WebSocket hook with auto-reconnect + command senders
    ├── App.tsx         # layout: twin left, mission control right
    ├── Scene.tsx       # 3D Earth + satellites + risk/selection rings
    └── Dashboard.tsx   # stat tiles, trend chart, node table, event log
```

## Design Decisions

- **Rule-based healing before AI** — deterministic recovery logic is debuggable, validatable, and explainable; the statistical predictor *feeds* the rules rather than replacing them
- **Explainability everywhere** — every prediction and every healing action carries a human-readable "because:" with real metric values; an autonomous system you can't interrogate is one you can't trust
- **Simulation-first** — this is how real space systems are developed on the ground before launch; the management software is the contribution, the simulator is its test range
- **Deliberately no database/containers** — in-memory state keeps the demo a two-command setup; persistence is an integration detail, not the hard problem
