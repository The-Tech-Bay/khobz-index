/**
 * Typed errors + JSON envelope (api-contract.md §6).
 */

import type { Context } from 'hono';

import type { ApiVariables, Env } from '../types.js';

export type ErrorCode =
  | 'unauthorized'
  | 'rate-limited'
  | 'not-found'
  | 'validation-error'
  | 'internal-error';

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown>;
    request_id?: string;
  };
};

/** 200-response warning object (api-contract.md §6.3). */
export type WarningBody = {
  code: 'source-degraded' | 'stale-data' | 'version-mismatch';
  message: string;
  details?: Record<string, unknown>;
};

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export function errorJson(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
  status: 400 | 401 | 404 | 429 | 500,
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): Response {
  const requestId = c.get('requestId');
  const body: ErrorBody = {
    error: {
      code,
      message,
      details,
      ...(requestId ? { request_id: requestId } : {}),
    },
  };
  return new Response(`${JSON.stringify(body)}\n`, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  });
}

export function onApiError(
  err: Error,
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): Response {
  const requestId = c.get('requestId') ?? crypto.randomUUID();
  if (!c.get('requestId')) {
    c.set('requestId', requestId);
  }

  if (err instanceof ApiHttpError) {
    return errorJson(
      c,
      err.status as 400 | 401 | 404 | 429 | 500,
      err.code,
      err.message,
      err.details,
    );
  }

  // biome-ignore lint/suspicious/noConsole: Cloudflare Workers diagnostics (architecture.md §6)
  console.error('[kki-api]', requestId, err);
  return errorJson(c, 500, 'internal-error', 'An unexpected error occurred', {
    type: err.name,
  });
}

export function requestIdMiddleware(): (
  c: Context<{ Variables: ApiVariables }>,
  next: () => Promise<void>,
) => Promise<void> {
  return async (c, next) => {
    const rid = c.req.header('x-request-id') ?? crypto.randomUUID();
    c.set('requestId', rid);
    c.header('x-request-id', rid);
    await next();
  };
}
