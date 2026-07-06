PHASE 4 — Monitoring + History (the senses)

What it does

Tracks every node's metrics over time and stores a rolling history per node. This is the
quiet, unglamorous phase that makes prediction (Phase 7) possible. Skip it and prediction
becomes impossible later.

Why it matters

Prediction needs to see trends — "this node's radiation has been climbing for 10 ticks."
That requires stored history. No history = no trends = no prediction.

The prompt

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

Checkpoint (Phase 4 done)


Each node carries a rolling history of its recent metrics
History buffer is capped (last 100) so it never grows forever
Fleet stats (healthy/degraded/failed counts, average health) arrive at the client
You can see the numbers updating (console or tiny readout)


Cautions


Cap the history buffer — an uncapped array grows until it crashes. This is the one real trap here.
Don't build the dashboard yet. Resist. That's Phase 6.