import type { MiddlewareHandler } from 'hono';

import { readTokenSession } from '../lib/token.js';
import type { ApiVariables, Env } from '../types.js';
import { ApiHttpError } from './errors.js';
import { consumeRateLimit, rateLimitedResponse, sha256Hex } from './rate-limit.js';

export const requireKkiAccessToken: MiddlewareHandler<{
  Bindings: Env;
  Variables: ApiVariables;
}> = async (c, next) => {
  const h = c.req.header('Authorization');
  if (!h?.startsWith('Bearer ')) {
    throw new ApiHttpError(401, 'unauthorized', 'Missing or invalid bearer token', {});
  }
  const token = h.slice(7).trim();
  if (!token) {
    throw new ApiHttpError(401, 'unauthorized', 'Missing or invalid bearer token', {});
  }
  c.set('kkiAccessToken', token);
  const session = await readTokenSession(c.env.KKI_KV, token);
  if (!session) {
    throw new ApiHttpError(401, 'unauthorized', 'Invalid or expired KKI access token', {});
  }
  c.set('kkiSession', session);
  await next();
};

export const dataRateLimitMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: ApiVariables;
}> = async (c, next) => {
  const token = c.get('kkiAccessToken');
  if (!token) {
    throw new ApiHttpError(401, 'unauthorized', 'Missing KKI access token', {});
  }
  const id = await sha256Hex(token);
  const rl = await consumeRateLimit(c.env.KKI_KV, 'data', id, 60);
  if (!rl.ok) {
    return rateLimitedResponse(c, rl.retryAfterSec);
  }
  await next();
};

export const healthRateLimitMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: ApiVariables;
}> = async (c, next) => {
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('CF-Connecting-IP') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const rl = await consumeRateLimit(c.env.KKI_KV, 'health', ip, 120);
  if (!rl.ok) {
    return rateLimitedResponse(c, rl.retryAfterSec);
  }
  await next();
};
