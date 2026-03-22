import { discordUserAgent } from './meta.js';

const API_BASE = 'https://discord.com/api/v10';

const MAX_429_RETRIES = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseHeaderFloat(headers: Headers, name: string): number | undefined {
  const v = headers.get(name);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseHeaderInt(headers: Headers, name: string): number | undefined {
  const v = headers.get(name);
  if (v == null || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export class DiscordRest {
  private readonly token: string;
  private chain: Promise<void> = Promise.resolve();
  private globalPauseUntil = 0;
  /** bucket id -> unix ms when requests may resume */
  private readonly bucketResetAt = new Map<string, number>();
  /** route key (METHOD:path) -> Discord bucket hash from X-RateLimit-Bucket */
  private readonly routeToBucket = new Map<string, string>();

  constructor(token: string) {
    this.token = token;
  }

  /** Serialize REST calls and respect Discord rate limit headers + 429/global scope. */
  request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 0,
  ): Promise<T> {
    const run = () => this.executeRequest<T>(method, path, body, attempt);
    const next = this.chain.then(run, run);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async waitGlobalPause(): Promise<void> {
    const now = Date.now();
    if (this.globalPauseUntil > now) {
      await sleep(this.globalPauseUntil - now);
    }
  }

  private async waitBucket(bucketKey: string): Promise<void> {
    const until = this.bucketResetAt.get(bucketKey);
    if (until == null) return;
    const now = Date.now();
    if (until > now) await sleep(until - now);
  }

  private bucketKeyForRoute(method: string, path: string): string {
    const routeKey = `${method}:${path}`;
    return this.routeToBucket.get(routeKey) ?? routeKey;
  }

  private updateBucketFromHeaders(headers: Headers, bucketKey: string): void {
    const remaining = parseHeaderInt(headers, 'X-RateLimit-Remaining');
    const resetAfter = parseHeaderFloat(headers, 'X-RateLimit-Reset-After');
    if (remaining === 0 && resetAfter != null && resetAfter > 0) {
      this.bucketResetAt.set(bucketKey, Date.now() + resetAfter * 1000);
    } else if (remaining != null && remaining > 0) {
      this.bucketResetAt.delete(bucketKey);
    }
  }

  private async executeRequest<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    attempt: number,
  ): Promise<T> {
    await this.waitGlobalPause();

    const routeKey = `${method}:${path}`;
    await this.waitBucket(this.bucketKeyForRoute(method, path));

    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bot ${this.token}`,
        'User-Agent': discordUserAgent(),
      },
    };
    if (body !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const bucketId =
      res.headers.get('X-RateLimit-Bucket') ?? routeKey;
    this.routeToBucket.set(routeKey, bucketId);

    if (res.status === 429) {
      const retryAfterSec =
        parseHeaderFloat(res.headers, 'Retry-After') ??
        (await parse429BodyRetry(res));
      const scope = res.headers.get('X-RateLimit-Scope');
      const isGlobal =
        scope === 'global' || res.headers.get('X-RateLimit-Global') === 'true';
      const waitMs = Math.max(0, (retryAfterSec ?? 1) * 1000);

      if (isGlobal) {
        this.globalPauseUntil = Date.now() + waitMs;
      }
      this.bucketResetAt.set(bucketId, Date.now() + waitMs);

      if (attempt >= MAX_429_RETRIES) {
        throw new Error(
          `Discord API rate limited (429) too many times for ${method} ${path}`,
        );
      }
      await sleep(waitMs);
      return this.executeRequest<T>(method, path, body, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Discord API ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`,
      );
    }

    this.updateBucketFromHeaders(res.headers, bucketId);

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }
}

async function parse429BodyRetry(res: Response): Promise<number | undefined> {
  try {
    const data = (await res.json()) as { retry_after?: number };
    if (typeof data.retry_after === 'number') return data.retry_after;
  } catch {
    /* ignore */
  }
  return undefined;
}
