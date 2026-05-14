/**
 * Unauthenticated liveness + pipeline summary (api-contract.md §2.5, §3.5B.5).
 */

import type { Context } from 'hono';

import type { ApiVariables, Env } from '../types.js';

const PIPELINE_KV_KEY = 'pipeline:status';

type PipelineKvPayload = {
  last_successful_run_at: string;
  last_run_week_id: string;
  sources?: Record<string, 'up' | 'degraded' | 'unavailable'>;
};

const DEFAULT_SOURCES: Record<string, 'up' | 'degraded' | 'unavailable'> = {
  'fao-fpi': 'up',
  faostat: 'up',
  'wfp-vam': 'up',
  'wb-pink-sheet': 'up',
  'goldprice-dev': 'up',
  'metals-dev': 'up',
};

export async function getHealth(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): Promise<Response> {
  const raw = await c.env.KKI_KV.get(PIPELINE_KV_KEY);
  let pipe: PipelineKvPayload | null = null;
  if (raw) {
    try {
      pipe = JSON.parse(raw) as PipelineKvPayload;
    } catch {
      pipe = null;
    }
  }

  let pipelineStatus: 'healthy' | 'degraded' | 'unknown' = 'unknown';
  let lastSuccess: string | null = null;
  let weekId: string | null = null;

  if (pipe?.last_successful_run_at) {
    lastSuccess = pipe.last_successful_run_at;
    weekId = pipe.last_run_week_id ?? null;
    const t = Date.parse(pipe.last_successful_run_at);
    if (Number.isFinite(t)) {
      const ageMs = Date.now() - t;
      pipelineStatus = ageMs > 14 * 24 * 60 * 60 * 1000 ? 'degraded' : 'healthy';
    }
  }

  const sources = { ...DEFAULT_SOURCES, ...(pipe?.sources ?? {}) };

  return c.json({
    ok: true,
    service: 'khobz-index-api',
    time: new Date().toISOString(),
    pipeline: {
      status: pipelineStatus,
      last_successful_run_at: lastSuccess,
      last_run_week_id: weekId,
    },
    sources,
  });
}
