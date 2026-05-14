/**
 * Index record reads (api-contract.md §2.2–§2.3).
 */

import type { Context } from 'hono';

import type { IndexRecord } from '../../shared/schema.js';
import type { StorageBackend } from '../../storage/backend.js';
import { getLatestMonth, getSnapshot, loadManifest } from '../../storage/index.js';
import { getStorageBackend } from '../lib/storage-binding.js';
import { parseCountryParam, parseMonthPath } from '../lib/validate.js';
import { buildIndexWarnings } from '../lib/warnings.js';
import { ApiHttpError } from '../middleware/errors.js';
import type { ApiVariables, Env } from '../types.js';

function methodologyPathPrefix(record: IndexRecord): string {
  const parts = record.methodology_version.trim().split('.');
  if (parts.length < 2) return 'v1.0';
  return `v${parts[0]}.${parts[1]}`;
}

export async function getKkiLatestHandler(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): Promise<Response> {
  const country = parseCountryParam(c.req.param('country'));
  const methodologyQ = c.req.query('methodology_version');
  const backend = getStorageBackend(c);

  const latestMonth = await getLatestMonth(backend, country);
  if (!latestMonth) {
    throw new ApiHttpError(404, 'not-found', 'No KKI data for country', { country });
  }

  const record = await getSnapshot(backend, country, latestMonth);
  if (!record) {
    throw new ApiHttpError(404, 'not-found', 'No KKI record for latest month', {
      country,
      month: latestMonth,
    });
  }

  return await respondKkiRecord(c, record, methodologyQ, backend);
}

export async function getKkiMonthHandler(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): Promise<Response> {
  const country = parseCountryParam(c.req.param('country'));
  const month = parseMonthPath(c.req.param('month'));
  const methodologyQ = c.req.query('methodology_version');
  const backend = getStorageBackend(c);

  const record = await getSnapshot(backend, country, month);
  if (!record) {
    throw new ApiHttpError(404, 'not-found', 'No KKI record for country/month', { country, month });
  }

  return await respondKkiRecord(c, record, methodologyQ, backend);
}

async function respondKkiRecord(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
  record: IndexRecord,
  methodologyQ: string | undefined,
  backend: StorageBackend,
): Promise<Response> {
  const manifest = await loadManifest(backend, methodologyPathPrefix(record));
  const warnings = buildIndexWarnings(record, {
    requestedMethodology: methodologyQ,
    manifestGeneratedAt: manifest.generated_at,
  });
  const payload: { data: IndexRecord; warnings?: typeof warnings } = { data: record };
  if (warnings.length) {
    payload.warnings = warnings;
  }
  return c.json(payload);
}
