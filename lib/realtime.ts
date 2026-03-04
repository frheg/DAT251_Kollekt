import { API_BASE } from './api';

export interface RealtimeEvent {
  type: string;
  collectiveCode?: string;
  timestamp?: string;
  payload?: unknown;
}

function buildWsUrl(memberName: string): string {
  const base = API_BASE.replace(/\/api\/?$/, '');
  const wsBase = base.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
  return `${wsBase}/ws/collective?memberName=${encodeURIComponent(memberName)}`;
}

export function connectCollectiveRealtime(
  memberName: string,
  onEvent: (event: RealtimeEvent) => void,
): () => void {
  let socket: WebSocket | null = null;
  let closedManually = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closedManually) return;
    socket = new WebSocket(buildWsUrl(memberName));

    socket.onmessage = (raw) => {
      try {
        onEvent(JSON.parse(raw.data as string) as RealtimeEvent);
      } catch {
        // Ignore malformed events to keep the stream resilient.
      }
    };

    socket.onclose = () => {
      if (closedManually) return;
      reconnectTimer = setTimeout(connect, 2000);
    };
  };

  connect();

  return () => {
    closedManually = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
