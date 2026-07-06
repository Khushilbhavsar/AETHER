import { useEffect, useRef, useState } from "react";
import { FaultKind, FleetSnapshot } from "./types";

const WS_URL = "ws://localhost:8080";
const RECONNECT_DELAY_MS = 1500;

export function useSocket() {
  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data) as FleetSnapshot;
        setSnapshot(data);
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  function trigger(fault: FaultKind) {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "trigger", fault }));
    }
  }

  return { snapshot, connected, trigger };
}
