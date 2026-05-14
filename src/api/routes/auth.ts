import type { Context } from 'hono';

import { verifySupabaseJwt } from '../lib/jwks.js';
import { mintOpaqueToken, storeTokenSession } from '../lib/token.js';
import { assertEmptyJsonBody } from '../lib/validate.js';
import { ApiHttpError } from '../middleware/errors.js';
import { consumeRateLimit, rateLimitedResponse } from '../middleware/rate-limit.js';
import type { ApiVariables, Env } from '../types.js';

export async function postAuthExchange(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): Promise<Response> {
  await assertEmptyJsonBody(c);

  const authz = c.req.header('Authorization');
  if (!authz?.startsWith('Bearer ')) {
    throw new ApiHttpError(401, 'unauthorized', 'Missing Supabase bearer token', {});
  }
  const supabaseJwt = authz.slice(7).trim();
  if (!supabaseJwt) {
    throw new ApiHttpError(401, 'unauthorized', 'Missing Supabase bearer token', {});
  }

  let sub: string;
  try {
    const fetcher = c.env.TEST_JWKS_FETCH ?? fetch;
    const v = await verifySupabaseJwt(supabaseJwt, c.env, c.env.KKI_KV, fetcher);
    sub = v.sub;
  } catch {
    throw new ApiHttpError(401, 'unauthorized', 'Invalid or expired Supabase session', {});
  }

  const rl = await consumeRateLimit(c.env.KKI_KV, 'exchange', sub, 10);
  if (!rl.ok) {
    return rateLimitedResponse(c, rl.retryAfterSec);
  }

  const token = mintOpaqueToken();
  const nowSec = Math.floor(Date.now() / 1000);
  await storeTokenSession(c.env.KKI_KV, token, { sub, scope: 'kki:read', exp: nowSec + 900 });

  return c.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 900,
    scope: 'kki:read',
  });
}
