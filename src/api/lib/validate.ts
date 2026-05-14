import type { Context } from 'hono';

import { ApiHttpError } from '../middleware/errors.js';

/** Semver `MAJOR.MINOR.PATCH` → storage prefix `vMAJOR.MINOR` (data-schema.md §5). */
export function pathVersionFromSemver(semver: string): string {
  const t = semver.trim();
  const m = t.match(/^(\d+)\.(\d+)\.\d+$/);
  if (!m) {
    throw new ApiHttpError(400, 'validation-error', 'Invalid methodology semver', { semver: t });
  }
  return `v${m[1]}.${m[2]}`;
}

export function parseCountryParam(raw: string | undefined): string {
  const cc = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    throw new ApiHttpError(400, 'validation-error', 'Invalid country code', { country: raw });
  }
  return cc;
}

export function parseMonthPath(raw: string | undefined): string {
  const m = (raw ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) {
    throw new ApiHttpError(400, 'validation-error', 'month must be YYYY-MM', { month: raw });
  }
  return m;
}

export async function assertEmptyJsonBody(c: Context): Promise<void> {
  const cl = c.req.header('content-length');
  if (!cl || cl === '0') {
    return;
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(400, 'validation-error', 'Body must be a JSON object', {});
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiHttpError(400, 'validation-error', 'Body must be a JSON object', {});
  }
  if (Object.keys(body as Record<string, unknown>).length > 0) {
    throw new ApiHttpError(400, 'validation-error', 'Body must be {}', {});
  }
}
