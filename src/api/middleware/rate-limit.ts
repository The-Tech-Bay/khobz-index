/**
 * KV fixed-window rate limits (api-contract.md §4).
 */

import type { Context } from 'hono';
import type { ApiVariables, Env } from '../types.js';
import type { ErrorBody } from './errors.js';

const WINDOW_SEC = 60;

export type RateKind = 'data' | 'exchange' | 'health';

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export async function consumeRateLimit(
  kv: KVNamespace,
  kind: RateKind,
  identifier: string,
  maxPerWindow: number,
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(nowSec / WINDOW_SEC);
  const key = `rl:${kind}:${identifier}:${String(windowId)}`;
  const cur = await kv.get(key);
  const count = cur ? Number(cur) : 0;
  if (!Number.isFinite(count) || count < 0) {
    await kv.put(key, '1', { expirationTtl: WINDOW_SEC * 2 });
    return { ok: true };
  }
  if (count >= maxPerWindow) {
    const nextBoundary = (windowId + 1) * WINDOW_SEC;
    return { ok: false, retryAfterSec: Math.max(1, nextBoundary - nowSec) };
  }
  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SEC * 2 });
  return { ok: true };
}

export function rateLimitedResponse(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
  retryAfterSec: number,
): Response {
  const requestId = c.get('requestId');
  const payload: ErrorBody = {
    error: {
      code: 'rate-limited',
      message: 'Too many requests; retry later',
      details: {},
      ...(requestId ? { request_id: requestId } : {}),
    },
  };
  return new Response(`${JSON.stringify(payload)}\n`, {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'retry-after': String(retryAfterSec),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  });
}
