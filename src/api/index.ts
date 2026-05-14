/**
 * KKI closed API — Cloudflare Workers + Hono (stack.md §1.4, api-contract.md §2).
 */

import { Hono } from 'hono';
import {
  dataRateLimitMiddleware,
  healthRateLimitMiddleware,
  requireKkiAccessToken,
} from './middleware/bearer-auth.js';
import { onApiError, requestIdMiddleware } from './middleware/errors.js';
import { observabilityMiddleware } from './middleware/observability.js';
import { postAuthExchange } from './routes/auth.js';
import { getBasketByVersionHandler } from './routes/basket.js';
import { getHealth } from './routes/health.js';
import { getKkiLatestHandler, getKkiMonthHandler } from './routes/kki.js';
import type { ApiVariables, Env } from './types.js';

const app = new Hono<{ Bindings: Env; Variables: ApiVariables }>();

app.use('*', requestIdMiddleware());
app.use('*', observabilityMiddleware());
app.onError(onApiError);

app.get('/', (c) => c.notFound());

app.get('/health', healthRateLimitMiddleware, getHealth);

app.post('/auth/exchange', postAuthExchange);

const data = new Hono<{ Bindings: Env; Variables: ApiVariables }>();
data.use('*', requireKkiAccessToken);
data.use('*', dataRateLimitMiddleware);
data.get('/kki/latest/:country', getKkiLatestHandler);
data.get('/kki/:country/:month', getKkiMonthHandler);
data.get('/basket/:version', getBasketByVersionHandler);

app.route('/', data);

export default app;
