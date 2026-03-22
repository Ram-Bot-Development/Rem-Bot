import WebSocket from 'ws';

import { gatewayClientLabel } from './meta.js';

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

export type GatewayDispatchPayload = {
  op: number;
  t?: string;
  s?: number | null;
  d?: unknown;
};

export type GatewayEventHandler = (event: GatewayDispatchPayload) => void;

/**
 * Minimal Discord Gateway v10 client: HELLO, IDENTIFY / RESUME, heartbeat, DISPATCH, reconnect.
 */
export class DiscordGateway {
  private readonly token: string;
  private readonly intents: number;
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private closed = false;
  private reconnectAttempt = 0;
  private readonly onDispatch: GatewayEventHandler;

  constructor(
    token: string,
    intents: number,
    onDispatch: GatewayEventHandler,
  ) {
    this.token = token;
    this.intents = intents;
    this.onDispatch = onDispatch;
  }

  connect(): void {
    this.closed = false;
    this.attachSocket(new WebSocket(GATEWAY_URL));
  }

  close(): void {
    this.closed = true;
    this.clearHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  private attachSocket(ws: WebSocket): void {
    this.ws = ws;

    ws.on('message', (data: WebSocket.RawData) => {
      let payload: GatewayDispatchPayload;
      try {
        payload = JSON.parse(data.toString()) as GatewayDispatchPayload;
      } catch {
        return;
      }
      this.handlePayload(payload);
    });

    ws.on('close', () => {
      this.clearHeartbeat();
      if (!this.closed) {
        this.scheduleReconnect();
      }
    });

    ws.on('error', (err) => {
      console.error('Gateway WebSocket error:', err.message);
    });

    ws.on('open', () => {
      this.reconnectAttempt = 0;
    });
  }

  private handlePayload(payload: GatewayDispatchPayload): void {
    const { op, t, s, d } = payload;

    if (s != null) this.sequence = s;

    switch (op) {
      case 10: {
        const hello = d as { heartbeat_interval: number };
        this.startHeartbeat(hello.heartbeat_interval);
        if (this.sessionId != null && this.sequence != null) {
          this.resume();
        } else {
          this.identify();
        }
        break;
      }
      case 11:
        break;
      case 9: {
        const resumable = d === true;
        if (!resumable) {
          this.sessionId = null;
          this.sequence = null;
        }
        this.ws?.close();
        break;
      }
      case 7:
        this.ws?.close();
        break;
      case 0:
        if (t === 'READY' && d && typeof d === 'object' && 'session_id' in d) {
          this.sessionId = String(
            (d as { session_id: string }).session_id,
          );
        }
        this.onDispatch(payload);
        break;
      default:
        break;
    }
  }

  private identify(): void {
    this.send({
      op: 2,
      d: {
        token: this.token,
        intents: this.intents,
        properties: {
          os: process.platform,
          browser: gatewayClientLabel(),
          device: gatewayClientLabel(),
        },
      },
    });
  }

  private resume(): void {
    if (this.sessionId == null || this.sequence == null) {
      this.identify();
      return;
    }
    this.send({
      op: 6,
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.sequence,
      },
    });
  }

  private startHeartbeat(intervalMs: number): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({
        op: 1,
        d: this.sequence,
      });
    }, intervalMs);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(payload: { op: number; d: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    setTimeout(() => {
      if (this.closed) return;
      this.attachSocket(new WebSocket(GATEWAY_URL));
    }, delay);
  }
}
