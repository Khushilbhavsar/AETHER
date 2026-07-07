/**
 * App.tsx — the root layout: 3D twin on the left, mission control on the right.
 *
 * Pulls the live snapshot from useSocket, holds the one piece of pure-UI state
 * (which node is selected), and fans data + command callbacks out to Scene and
 * Dashboard.
 */

import { useState } from "react";
import "./App.css";
import { Scene } from "./Scene";
import { Dashboard } from "./Dashboard";
import { useSocket } from "./useSocket";

function App() {
  const { snapshot, connected, trigger, setAutoHeal, startScenario, resetFleet } = useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = snapshot?.nodes ?? [];
  const events = snapshot?.events ?? [];
  const stats = snapshot?.stats ?? null;
  const history = snapshot?.history ?? null;
  const autoHeal = snapshot?.autoHeal ?? true;
  const activeScenario = snapshot?.activeScenario ?? null;

  return (
    <div className="app-layout">
      <div className="scene-panel">
        <Scene nodes={nodes} selectedId={selectedId} />
      </div>
      <Dashboard
        nodes={nodes}
        events={events}
        stats={stats}
        history={history}
        autoHeal={autoHeal}
        activeScenario={activeScenario}
        connected={connected}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onTrigger={trigger}
        onSetAutoHeal={setAutoHeal}
        onScenario={startScenario}
        onReset={resetFleet}
      />
    </div>
  );
}

export default App;
