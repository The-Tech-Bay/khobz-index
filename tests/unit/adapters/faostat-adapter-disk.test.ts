/**
 * FAOSTAT adapter reading bundled JSON from disk (`FAOSTAT_CP_JSON_PATH`).
 */

import { describe, expect, test } from 'bun:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaostatAdapter } from '../../../src/adapters/faostat.js';
import { recordsFromAdapterResult } from '../../../src/adapters/orchestrator.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

describe('createFaostatAdapter jsonPath', () => {
  test('loads CP envelope from absolute jsonPath without HTTP', async () => {
    const adaptor = createFaostatAdapter({
      jsonPath: resolve(fixturesDir, 'faostat-sample.json'),
    });
    const res = await adaptor.fetch({
      target_date: '2025-12-15',
      lcu_per_usd_by_country: { MA: 10, EG: 30, LK: 300 },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    const ma = recordsFromAdapterResult(res).filter((r) => r.country_code === 'MA');
    expect(ma.length >= 1).toBe(true);
  });

  test('returns NOT_FOUND when jsonPath targets missing file', async () => {
    const adaptor = createFaostatAdapter({
      jsonPath: resolve(fixturesDir, 'no-such-file-faostat.json'),
    });
    const res = await adaptor.fetch({
      target_date: '2025-12-15',
      lcu_per_usd_by_country: { MA: 10 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error?.code).toBe('NOT_FOUND');
  });
});
