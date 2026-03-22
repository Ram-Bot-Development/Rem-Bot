import WebSocket from 'ws';

import { gatewayClientLabel } from './meta.js';

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

export type GatewayDispatchPayload = {
  op: number;
  t?: string;
  s?: number | null;
  d?: unknown;
};

export type GatewayEventHandler = (
  event: GatewayDispatchPayload,
) => void | Promise<void>;

/** Optional presence on IDENTIFY (activity + status). */
export type BotPresenceConfig = {
  status?: 'online' | 'idle' | 'dnd' | 'invisible';
  activities?: Array<{ name: string; type: number }>;
};

/**
 * Minimal Discord Gateway v10 client: HELLO, IDENTIFY / RESUME, heartbeat, DISPATCH, reconnect.
 */
export class DiscordGateway {
  private readonly token: string;
  private readonly intents: number;
  private readonly presence?: BotPresenceConfig;
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
    presence?: BotPresenceConfig,
  ) {
    this.token = token;
    this.intents = intents;
    this.onDispatch = onDispatch;
    this.presence = presence;
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

    ws.on('close', (code: number) => {
      if (code === 4014) {
        console.error(
          'Discord closed the Gateway (4014 Disallowed intents). Open the Developer Portal → your app → Bot → Privileged Gateway Intents and enable every intent your code requests (e.g. Server Members if member events are enabled). See https://discord.com/developers/docs/topics/gateway#list-of-intents',
        );
      }
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
        void Promise.resolve(this.onDispatch(payload)).catch((err: unknown) => {
          console.error('Gateway dispatch handler error:', err);
        });
        break;
      default:
        break;
    }
  }

  private identify(): void {
    const d: Record<string, unknown> = {
      token: this.token,
      intents: this.intents,
      properties: {
        os: process.platform,
        browser: gatewayClientLabel(),
        device: gatewayClientLabel(),
      },
    };
    if (this.presence != null) {
      const { status = 'online', activities = [] } = this.presence;
      d.presence = {
        since: null,
        activities,
        status,
        afk: false,
      };
    }
    this.send({
      op: 2,
      d,
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
