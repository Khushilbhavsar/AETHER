# AETHER — Prototype Build Roadmap (Free / Vibe-Coding Edition)

**Autonomous Orbital Infrastructure Intelligence**
Lightweight all-JavaScript stack · Zero cost · Built for vibe coding in Claude Code + VS Code

---

## The One Rule That Matters Most

> Build ONE small piece → run it → confirm it works → only then build the next piece.

Never build two features at once. This single habit is what separates a finished
prototype from an unfixable mess. Every phase below is one small, testable piece.

---

## The Stack (all free, one language)

| Layer          | Tech                              | Why |
| -------------- | --------------------------------- | --- |
| Backend brain  | Node.js + TypeScript              | Your language; runs the simulation, healing, prediction |
| Frontend twin  | React + Vite + React Three Fiber  | Your superpower; the 3D visual hook |
| Dashboard      | React + Recharts                  | Live metrics panel |
| Real-time link | WebSocket (`ws`)                  | Streams node state to the browser |
| State          | In-memory (plain objects)         | No database, no Docker, no Redis — deliberately |
| AI (added late)| Lightweight anomaly detection JS  | Only after everything else is stable |

**What we deliberately DROP from the original AETHER plan (and why):**
PostgreSQL, Redis, Docker, Docker Compose, multi-service, Python. All free in dollars,
but they cost you hours of setup pain and fight your beginner/vibe-coding constraint.
A demo needs none of them. If your hackathon specifically rewards containers/databases,
add them back AFTER the prototype works — never before.

---

## PHASE 0 — What NOT to Build

Do not build (now or maybe ever for the prototype):

- Real orbital mechanics / NASA-grade physics
- Reinforcement learning
- Real Kubernetes / real clusters
- Databases, caches, containers
- Large AI models or LLMs

**Mistake to avoid:** trying to make the simulation scientifically realistic.
Believable and abstract beats accurate. This is the #1 momentum killer.

---

## PHASE 1 — Setup + First Prototype

### The prototype target (nothing more than this)

> Backend simulates 6 nodes with health values, ticking every second, streaming over
> WebSocket. React app shows a rotating 3D Earth with 6 satellites glowing green/yellow/red.

No radiation, no healing, no AI yet. Just the living foundation.

### Software to install (in this order)

1. **Node.js (LTS version)** — from nodejs.org. Gives you `node` + `npm`.
   - CAUTION: get **LTS**, not "Current." LTS is stable.
2. **VS Code** — from code.visualstudio.com.
3. **Claude Code inside VS Code** — install the extension, sign in with your subscription.
4. A modern browser (Chrome/Firefox) — you have this.

### Verify before anything else

Open VS Code terminal (View → Terminal) and run:

```
node --version
npm --version
```

Both must print a version number. If not: reinstall Node, then fully close and reopen
the terminal (common trip-up: terminal opened before install can't see Node yet).

### Recommended VS Code extensions

| Extension   | Why |
| ----------- | --- |
| ESLint      | Catches JS/TS errors as you type |
| Error Lens  | Shows errors inline, instantly |
| Prettier    | Auto-formats code |
| GitLens     | Track your changes |

### First steps

1. Make and open the project folder:
   ```
   mkdir aether
   cd aether
   code .
   ```
2. In Claude Code, give the scaffold prompt (see "First Claude Code Prompt" below).
3. Run what it builds, open the localhost link, confirm you see the rotating Earth.
4. Report back: works, or the exact error.

### Best practices this phase

- Initialise Git immediately (`git init`) and commit after every working step.
  A working commit is a free undo button.
- Keep a clean folder structure from day 1 (see Project Structure below).
- Write a one-line README saying what AETHER is.

### Mistakes to avoid this phase

- Running commands in the wrong folder (your terminal should show `aether`). Use `pwd`/`ls` to check.
- Building the backend and frontend logic at once. Get the Earth rendering FIRST, with dummy data.
- Skipping the `node --version` check and wondering later why nothing runs.

---

## Project Structure (keep modules separate from day 1)

```
aether/
├── server/                 # Node + TS backend (the brain)
│   ├── src/
│   │   ├── index.ts        # entry: starts server + WebSocket
│   │   ├── simulator.ts    # generates node states
│   │   ├── faults.ts       # injects failures (Phase 3)
│   │   ├── monitor.ts      # tracks + stores metric history (Phase 4)
│   │   ├── healing.ts      # rule-based recovery (Phase 5)
│   │   ├── predictor.ts    # anomaly detection (Phase 7)
│   │   └── types.ts        # shared Node type
│   └── package.json
│
├── client/                 # React + R3F frontend (the twin)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── Scene.tsx       # 3D Earth + satellites
│   │   ├── Dashboard.tsx   # metrics panel (Phase 6)
│   │   └── useSocket.ts    # WebSocket hook
│   └── package.json
│
└── README.md
```

**Important note:** never mix simulation, healing, prediction, and UI logic in one file.
Separate modules = you can debug and explain each piece. Mixed logic = collapse later.

---

## PHASE 2 — The Core Simulator

**Goal:** simulate fake orbital servers ticking over time.

Each node has:

```
id, temperature, radiation, cpuUsage, memoryHealth, networkHealth, status, workload
```

Example node:

```
{ id: "node_1", temperature: 74, radiation: 0.32, cpuUsage: 56,
  memoryHealth: 91, networkHealth: 88, status: "healthy", workload: 3 }
```

The simulator ticks every second, nudging values with small random drift, and
broadcasts the whole fleet over WebSocket.

- BEST PRACTICE: use simple random drift + rules, not a physics engine.
- MISTAKE TO AVOID: realistic space physics. Kills momentum, adds nothing to the demo.
- QUICK NOTE: the simulator is the heart of the project — the training AND testing
  environment. Treat it like a product.

---

## PHASE 3 — Fault Injection

**Goal:** artificially create problems so there's something to heal.

| Fault           | Effect |
| --------------- | --- |
| Radiation spike | memoryHealth drops |
| Overheating     | cpuUsage throttles |
| Packet loss     | networkHealth drops |
| Node crash      | status → failed |

Rule example: `if radiation > 0.8 → memoryHealth -= 20`.

- BEST PRACTICE: use probabilities and timed events, not hardcoded chaos.
- QUICK NOTE: keep faults as their own module (`faults.ts`) so you can trigger them on demand.

---

## PHASE 4 — Monitoring + History

**Goal:** track every node's metrics continuously AND store timestamped history.

- HUGE MISTAKE TO AVOID: not storing history. Without a rolling history buffer there is
  no anomaly detection and no prediction later. Keep the last N ticks per node in memory.
- BEST PRACTICE: store `{ timestamp, ...metrics }` per node in a capped array (e.g. last 100 ticks).

---

## PHASE 5 — Self-Healing Engine (rule-based FIRST)

**Goal:** recover automatically from failures — no AI yet.

| Problem        | Action |
| -------------- | --- |
| Overheating    | reduce workload |
| High radiation | migrate tasks off node |
| Node failure   | restart / reset node |
| Packet loss    | reroute traffic |

Core logic: `if node.health < 40 → isolate node → migrate workload → attempt recovery`.

- IMPORTANT PRINCIPLE: self-healing is RULE-BASED first. Deterministic logic is easy to
  debug, validate, and explain. AI comes only after this is rock-solid.
- MASSIVE MISTAKE TO AVOID: reaching for reinforcement learning here. You need a stable
  environment and stable recovery rules before any learning is even meaningful.

---

## PHASE 6 — Dashboard (mission control, not landing page)

**Goal:** live panel showing fleet health, radiation levels, failures, recovery events,
workload migrations — alongside the 3D twin.

- Tools: React + Recharts for metrics.
- BEST PRACTICE: think "mission control." Visual clarity beats visual beauty.
- CAUTION — Frontend rabbit hole: do NOT spend days polishing UI. The infrastructure
  logic is the project. A clean, clear dashboard is enough.

---

## PHASE 7 — AI Failure Prediction (added LAST, kept simple)

**Goal:** predict failures before they happen. First and ONLY AI feature for the prototype.

- Not LLMs. Not generative AI. Use anomaly detection / predictive analytics.
- Start with the simplest thing that works: a lightweight statistical anomaly score
  (e.g. flag nodes whose recent metrics deviate sharply from their history). This is the
  JS equivalent of the "Isolation Forest first" advice — explainable and light.
- Output: a failure-probability score per node, shown in the twin + dashboard.
- IMPORTANT NOTE: the model does NOT need high accuracy or big datasets. It needs
  believable, useful, well-architected behavior. That's enough for a prototype.
- BEST PRACTICE: feed it the history buffer from Phase 4. That's why Phase 4 mattered.

---

## PHASE 8+ — Advanced (ONLY after the MVP works)

Solar-storm scenario mode, cascading failures, chaos-injector demo button, replay/time
controls, explainable decisions ("node isolated because: thermal spike + predicted
radiation instability"). These turn a "server monitor" into an "infrastructure
intelligence simulator" — but every one waits until the core loop is solid.

Defer indefinitely for the prototype: RL scheduler, distributed consensus (Raft/Paxos),
real multi-service/Docker, real databases.

---

## The Best First Demo (your target demo script)

```
1. Fleet of nodes orbiting Earth, all green, dashboard live
2. Trigger a radiation spike (button)
3. A few nodes destabilize → turn yellow/red
4. Predictor flags them as high-failure-risk
5. Workloads migrate off the failing nodes
6. Nodes recover → turn green again
7. Dashboard shows the whole event live
```

If this works, your prototype is already impressive.

---

## Cross-Cutting Best Practices

1. **Build iteratively.** Never design the whole system first. Small working features, tested continuously.
2. **Make everything observable.** Log events, failures, healing actions, predictions. You'll rely on these logs constantly.
3. **Use fake data from the start.** Don't wait for realistic datasets. Simulation-first is correct.
4. **Modularize everything.** Each system its own file/module.
5. **Avoid premature optimization.** No Rust rewrites, no concurrency tuning, no over-engineering. It kills prototypes.

---

## Critical Cautions

1. **Scope explosion — your biggest risk.** For every feature ask: *"Does this help
   autonomous infrastructure management?"* If no → skip it.
2. **AI overengineering.** Use AI only where useful (prediction). Don't force it everywhere.
3. **Simulation-complexity trap.** You're not building NASA sims. Keep it abstract.
4. **Frontend rabbit hole.** Logic matters more than pixel-perfect UI.

---

## Priority Order (if time is tight)

- **FIRST:** simulator → monitoring → rule-based healing
- **SECOND:** dashboard → anomaly detection
- **THIRD:** scenario modes → advanced orchestration

---

## First Claude Code Prompt (paste this once set up)

> Set up an all-JavaScript monorepo called AETHER with two folders.
>
> `/server`: Node.js + TypeScript. A WebSocket server (`ws`) that simulates 6 server
> nodes. Each node has id, temperature, radiation, cpuUsage, memoryHealth,
> networkHealth, status, and workload. Every second, nudge each node's values with
> small random drift, set status to "healthy" for now, and broadcast the full fleet
> array as JSON over WebSocket.
>
> `/client`: React + Vite + TypeScript + React Three Fiber. Connect to the WebSocket,
> render a rotating 3D Earth (a textured sphere), and render 6 satellites orbiting it —
> one per node — each colored by health (green healthy, yellow degraded, red failed).
>
> Give me every file with its full path, the exact terminal commands to create the
> projects and install dependencies, and clear instructions to run both. Keep it minimal
> and modular — separate files for the simulator, the WebSocket, the 3D scene, and the
> socket hook. Do not add databases, Docker, or extra features yet.

After it runs and you see the Earth with 6 green satellites, you've completed Phase 1.
Then move to Phase 3 (fault injection) as your next single step.

# AETHER — Phase 4 to 8 Prompt Pack

**How to use this file:** paste ONE phase prompt into Claude Code, run it, confirm the
checkpoint, THEN move to the next. Never paste two phases at once. Each phase assumes the
previous one is working.

---

## PHASE 4 — Monitoring + History (the senses)

### What it does
Tracks every node's metrics over time and stores a rolling history per node. This is the
quiet, unglamorous phase that makes prediction (Phase 7) possible. Skip it and prediction
becomes impossible later.

### Why it matters
Prediction needs to see *trends* — "this node's radiation has been climbing for 10 ticks."
That requires stored history. No history = no trends = no prediction.

### The prompt

```
We're adding Phase 4 to AETHER: monitoring and history. Phases 1 and 3 work
(nodes orbit Earth, faults degrade them, colors update). Build ONLY Phase 4 — no
healing, no AI yet.

On the /server backend:

1. Add a monitoring module `monitor.ts` that, every tick, records a snapshot of each
   node: { timestamp, temperature, radiation, cpuUsage, memoryHealth, networkHealth,
   health, status }.

2. Store these snapshots in a rolling per-node history buffer — keep only the last 100
   snapshots per node (drop the oldest when full) so memory stays bounded.

3. Include each node's recent history (or a trimmed version, e.g. last 30 points) in the
   data broadcast over WebSocket, so the client can chart trends.

4. Also compute and broadcast simple fleet-wide stats each tick: total nodes, count
   healthy/degraded/failed, average fleet health.

On the /client side:
- Don't build a full dashboard yet (that's Phase 6). Just confirm the history and fleet
  stats are arriving — log them to the browser console or show a tiny text readout
  (e.g. "Fleet health: 82% | Healthy 5 / Degraded 1 / Failed 0").

Give me every changed/new file in full with its path, and how to run and verify it.
Keep monitoring in its own module, separate from the simulator and faults.
```

### Checkpoint (Phase 4 done)
- Each node carries a rolling history of its recent metrics
- History buffer is capped (last 100) so it never grows forever
- Fleet stats (healthy/degraded/failed counts, average health) arrive at the client
- You can see the numbers updating (console or tiny readout)

### Cautions
- Cap the history buffer — an uncapped array grows until it crashes. This is the one real trap here.
- Don't build the dashboard yet. Resist. That's Phase 6.

---

## PHASE 5 — Self-Healing Engine (rule-based, the hands)

### What it does
Automatically recovers unhealthy nodes: isolates failing ones, migrates their workload to
healthy nodes, and attempts recovery — with NO AI and NO human. This is the heart of the
whole project's value.

### Why rule-based first
Deterministic rules are easy to debug, validate, and explain to judges. AI-based healing on
an unstable base is a nightmare. Rules first, always.

### The prompt

```
We're adding Phase 5 to AETHER: rule-based self-healing. Phases 1, 3, 4 work (nodes
orbit, faults degrade them, monitoring + history exist). Build ONLY Phase 5 — rule-based
only, NO AI/machine learning.

On the /server backend, add a healing module `healing.ts` that runs every tick AFTER
monitoring:

1. For each node, apply recovery rules based on its state:
   - If health < 33 (failed): isolate the node (mark it isolated, stop assigning it new
     workload), migrate its current workload to the healthiest available nodes, then begin
     a gradual recovery (health slowly climbs back over several ticks while isolated).
   - If overheating (high temperature): reduce that node's workload to cool it down.
   - If high radiation: migrate workload off the node preemptively.
   - If networkHealth low: reroute its traffic/workload to other nodes.
   - Once a recovering node's health passes ~66, bring it back into rotation (un-isolate).

2. Workload migration: when work moves off a node, distribute it to the healthiest nodes
   with capacity. Track workload per node so migrations are visible.

3. Log every healing action clearly: e.g. "node_3 isolated (health 28) → workload migrated
   to node_1, node_5 → recovering". Broadcast these events to the client.

4. Add an "auto-heal on/off" toggle (a WebSocket message) so I can turn healing off to show
   the fleet collapsing, then on to show it recovering — great for demos.

On the /client side:
- Show healing events as they happen (a simple scrolling log/text list is fine).
- The 3D view should now visibly show nodes recovering: red → yellow → green over time
  after a fault, once healing is on.

Give me every changed/new file in full with paths, and how to run and verify. Keep healing
in its own module, running after monitoring in the tick order.
```

### Checkpoint (Phase 5 done)
- Trigger a fault → node degrades → healing isolates it, migrates workload, node recovers to green
- Healing events are logged and visible
- Auto-heal toggle works (off = fleet degrades and stays broken; on = fleet recovers)
- Workload visibly moves between nodes

### Cautions
- Do NOT add AI here. Healing is 100% rules this phase.
- Watch tick order: monitor first, then heal. If healing runs before monitoring updates health, decisions use stale data.
- Make recovery gradual, not instant — instant recovery looks fake and gives prediction nothing to work with later.

---

## PHASE 6 — Dashboard (mission control, the eyes)

### What it does
A live metrics panel beside the 3D twin: fleet health, node counts, per-node metrics,
radiation levels, healing events, workload distribution. Turns raw data into a readable
operations view.

### The prompt

```
We're adding Phase 6 to AETHER: a mission-control dashboard. Phases 1, 3, 4, 5 work
(nodes orbit, faults, monitoring+history, self-healing). Build ONLY Phase 6 — visualization
only, no new backend logic.

On the /client side, add a dashboard panel (component `Dashboard.tsx`) laid out beside or
below the 3D scene, showing live:

1. Fleet summary: total nodes, counts of healthy/degraded/failed, average fleet health
   (big clear numbers).
2. A line chart (use Recharts) of average fleet health over recent time, using the history
   data already arriving from the backend.
3. A per-node list/table: each node's id, health, status (color-coded), temperature,
   radiation, cpuUsage, memoryHealth, networkHealth, and current workload.
4. A live event log of healing actions (isolations, migrations, recoveries) — the events
   already broadcast in Phase 5.
5. Clicking a node in the list highlights/selects it (and if easy, focuses it in the 3D view).

Style it like MISSION CONTROL, not a marketing landing page — dark background, clear
monospace-ish readouts, color-coded status (green/yellow/red). Clarity over beauty.

Do not change backend logic — only consume data already being sent. Give me every
changed/new file in full with paths, and how to run and verify.
```

### Checkpoint (Phase 6 done)
- Live fleet summary numbers update every tick
- A health-over-time chart is drawing
- Per-node table shows all metrics, color-coded by status
- Healing event log scrolls as events happen

### Cautions
- FRONTEND RABBIT HOLE — the biggest risk here. Do not spend days on styling. Clear and functional beats beautiful. Timebox it.
- Reuse data already sent from the backend. Don't add new backend endpoints just for the dashboard.

---

## PHASE 7 — AI Failure Prediction (foresight, added LAST)

### What it does
Predicts which nodes are about to fail *before* they do, using the metric history, and
outputs a failure-probability score per node. The self-healing engine then acts on
predictions preemptively — moving work off a node before it actually fails.

### Keep it simple
This is the ONLY AI in the prototype. Start with a lightweight statistical anomaly score,
not a heavy trained model. It doesn't need high accuracy — it needs believable, explainable,
useful behavior.

### The prompt

```
We're adding Phase 7 to AETHER: failure prediction. Phases 1, 3, 4, 5, 6 work. Build ONLY
Phase 7. Keep the AI lightweight and explainable — NO large models, NO LLMs, NO external
ML services. Pure JS/TS statistics is fine.

On the /server backend, add a prediction module `predictor.ts`:

1. For each node, use its metric history (from Phase 4) to compute a failure-probability
   score (0–100%). Simple, explainable approach: detect adverse trends — e.g. radiation
   rising over recent ticks, health declining, temperature climbing, metrics deviating
   sharply from the node's own recent baseline. Combine these into one risk score.

2. Classify each node's risk: low / medium / high based on the score.

3. Include a short human-readable reason with each prediction, e.g. "high risk: radiation
   trending up + health falling over last 8 ticks." (Explainability matters for the demo.)

4. Broadcast each node's risk score + reason to the client every tick.

Then connect prediction to healing (light touch):
5. In the healing engine, add PREEMPTIVE action: if a node is HIGH risk but hasn't failed
   yet, start migrating workload off it early — before it crosses the failure threshold.
   Log this as "preemptive migration (predicted failure)".

On the /client side:
- Show each node's risk score + reason in the dashboard node list.
- In the 3D view, visually flag high-risk nodes (e.g. a pulsing ring/glow) BEFORE they turn
  red, so you can see prediction working ahead of failure.

Give me every changed/new file in full with paths, and how to run and verify. Keep
prediction in its own module.
```

### Checkpoint (Phase 7 done)
- Each node has a failure-probability score + a readable reason
- High-risk nodes are flagged in both dashboard and 3D view BEFORE they fail
- Healing now acts preemptively on high-risk nodes (migrates work early)
- You can watch: node flagged high-risk → work migrates → failure avoided

### Cautions
- Keep it statistical and explainable. A pulsing "about to fail" ring that then gets saved by preemptive migration is a fantastic demo moment — the fancy-model version isn't worth it for a prototype.
- The reason string matters — judges love seeing *why* the system acted.
- Don't let prediction replace the rule-based healing; it *feeds* it. Rules still run.

---

## PHASE 8 — Scenario Modes / Chaos Injector (the demo climax)

### What it does
Adds big scripted scenarios you trigger with a button — the "solar storm" being the star.
This transforms AETHER from "server monitor" into "infrastructure intelligence simulator"
and gives you your demo money-shot: hit the storm, watch the fleet nearly collapse, watch
AETHER predict, heal, and recover it live.

### The prompt

```
We're adding Phase 8 to AETHER: scenario modes / chaos injector. Phases 1,3,4,5,6,7 all
work. Build ONLY Phase 8.

On the /server backend, add a scenarios module `scenarios.ts` with triggerable scenarios:

1. SOLAR STORM: fleet-wide radiation surge for a sustained period — radiation spikes across
   most/all nodes at once, stressing memory and pushing many toward failure simultaneously.
2. THERMAL OVERLOAD: several nodes overheat at once.
3. NETWORK COLLAPSE: widespread packet loss / networkHealth drop.
4. CASCADING FAILURE: fail one node hard, let its migrated workload overload neighbors to
   create a chain reaction (a real stress test of the healing engine).

Each scenario should be triggerable via a WebSocket message from the client, run for a set
duration, then subside so the fleet can recover.

On the /client side:
- Add a "SCENARIOS" control panel with a button per scenario (make SOLAR STORM prominent).
- When a scenario runs, show a clear banner/indicator (e.g. "⚠ SOLAR STORM ACTIVE").
- Ensure the whole response is visible: nodes surge red, predictor flags them, healing
  migrates and recovers, dashboard charts spike then recover.

Optional if quick: a "reset fleet" button to return all nodes to healthy for a clean demo restart.

Give me every changed/new file in full with paths, and how to run and verify. Keep
scenarios in their own module.
```

### Checkpoint (Phase 8 done)
- A "Solar Storm" button spikes radiation fleet-wide
- Nodes surge toward failure, predictor flags them, healing responds, fleet recovers
- A clear on-screen indicator shows when a scenario is active
- (Optional) reset button returns the fleet to healthy

### Cautions
- This is your demo climax — make the solar storm the most prominent, polished button.
- Make sure scenarios SUBSIDE so recovery is visible. A storm that never ends just shows collapse, not resilience.
- Keep a clean restart path (reset button) so you can re-run the demo smoothly for judges.

---

## Your Full Demo Script (once all phases are done)

```
1. Fleet orbiting Earth, all green, dashboard live, fleet health ~100%
2. Hit "SOLAR STORM" → radiation surges fleet-wide, banner appears
3. Nodes start climbing in risk → predictor flags them (pulsing rings) BEFORE they fail
4. Healing migrates workloads off high-risk nodes preemptively
5. Some nodes still fail → get isolated → workload migrates → they recover
6. Storm subsides → fleet heals back to green → dashboard charts recover
7. Toggle auto-heal OFF, hit storm again → show fleet collapsing WITHOUT AETHER
8. Toggle auto-heal ON → show it saving the fleet
```

That contrast in steps 7–8 (with vs without AETHER) is the single most convincing thing you
can show a judge — it proves your system is what makes the difference.

---

## The One Rule (again, because it's everything)

One phase → paste prompt → run → confirm checkpoint → next phase. Never two at once.
Commit to Git after each working phase. A working commit is a free undo button.