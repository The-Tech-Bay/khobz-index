/**
 * Structured request log for Workers observability (architecture.md §6, §3.8B.4).
 * Cloudflare dashboard → Workers → Logs / Analytics (free tier).
 */

import type { MiddlewareHandler } from 'hono';

import type { ApiVariables, Env } from '../types.js';

export function observabilityMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: ApiVariables;
}> {
  return async (c, next) => {
    const t0 = Date.now();
    try {
      await next();
    } finally {
      const ms = Date.now() - t0;
      const status = typeof c.res?.status === 'number' ? c.res.status : 0;
      const path = c.req.path;
      const method = c.req.method;
      const requestId = c.get('requestId');
      // biome-ignore lint/suspicious/noConsole: Workers Real-time Logs (§3.8B)
      console.log(
        JSON.stringify({
          kki_observability: true,
          service: 'khobz-index-api',
          request_id: requestId,
          method,
          path,
          status,
          latency_ms: ms,
        }),
      );
    }
  };
}
