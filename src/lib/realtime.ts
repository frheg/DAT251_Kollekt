import { API_BASE } from './api';

export interface RealtimeEvent {
  type: string;
  collectiveCode?: string;
  timestamp?: string;
  payload?: unknown;
}

interface RealtimeOptions {
  onConnected?: () => void;
}

function buildWsUrl(memberName: string): string {
  // Support both absolute and relative API bases (for example "/api" in production).
  const apiUrl = new URL(API_BASE, window.location.origin);
  const wsUrl = new URL('/ws/collective', apiUrl.origin);
  wsUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  wsUrl.searchParams.set('memberName', memberName);
  return wsUrl.toString();
}

export function connectCollectiveRealtime(
  memberName: string,
  onEvent: (event: RealtimeEvent) => void,
  options?: RealtimeOptions,
): () => void {
  let socket: WebSocket | null = null;
  let closedManually = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closedManually) return;
    socket = new WebSocket(buildWsUrl(memberName));
    socket.onopen = () => {
      options?.onConnected?.();
    };

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

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return () => {
    closedManually = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
