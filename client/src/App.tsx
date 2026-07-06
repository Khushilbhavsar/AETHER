import "./App.css";
import { Scene } from "./Scene";
import { Dashboard } from "./Dashboard";
import { useSocket } from "./useSocket";

function App() {
  const { snapshot, connected, trigger } = useSocket();
  const nodes = snapshot?.nodes ?? [];
  const events = snapshot?.events ?? [];
  const stats = snapshot?.stats ?? null;

  return (
    <div className="app-layout">
      <div className="scene-panel">
        <Scene nodes={nodes} />
      </div>
      <Dashboard nodes={nodes} events={events} stats={stats} connected={connected} onTrigger={trigger} />
    </div>
  );
}

export default App;
