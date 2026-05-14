/**
 * §3.2B.1 — Adapter test harness: mock fetch, contract checks, trivial adapter.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchWithTimeout, mkMeta } from '../../../src/adapters/utils.js';
import type { SourceAdapter } from '../../../src/shared/schema.js';
import { PriceRecordSchema } from '../../../src/shared/schema.js';
import { assertAdapterResultShape } from '../../helpers/adapter-contract.js';
import { createMockFetch } from '../../helpers/mock-fetch.js';

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
});

function trivialAdapter(): SourceAdapter {
  return {
    id: 'frankfurter',
    tier: 3,
    name: 'Trivial contract adapter',
    covers: ['fx_display'],
    native_cadence: 'daily',
    async fetch(params) {
      const start = Date.now();
      const at = new Date().toISOString();
      const m = params.target_date.slice(0, 7);
      const records = [
        PriceRecordSchema.parse({
          commodity: 'fx_EUR_per_USD',
          price_usd: 1.08,
          price_unit: 'ratio',
          date: `${m}-01`,
          source_id: 'frankfurter',
          fetched_at: at,
        }),
      ];
      return {
        ok: true,
        changed: true,
        records,
        metadata: mkMeta('frankfurter', 3, records.length, params.target_date, Date.now() - start),
      };
    },
  };
}

describe('§3.2B.1 adapter harness', () => {
  test('trivial adapter satisfies SourceAdapter contract', async () => {
    const a = trivialAdapter();
    await assertAdapterResultShape(a, { target_date: '2026-05-05' });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok && r.changed && r.records[0]?.commodity).toBe('fx_EUR_per_USD');
  });

  test('mock-fetch returns fixture by URL pattern', async () => {
    const fixture = resolve(import.meta.dir, '../../fixtures/fao-fpi-sample.json');
    const mock = createMockFetch([{ test: (u) => u.includes('fao.test'), fixturePath: fixture }]);
    const res = await mock('https://fao.test/sdmx');
    expect(res.ok).toBe(true);
    const j = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(j.data)).toBe(true);
  });

  test('fixture JSON files exist for six sources', () => {
    const names = [
      'fao-fpi-sample.json',
      'faostat-sample.json',
      'wfp-vam-sample.json',
      'wb-pink-sheet-sample.json',
      'goldprice-dev-sample.json',
      'metals-dev-sample.json',
    ];
    for (const n of names) {
      const p = resolve(import.meta.dir, '../../fixtures', n);
      expect(() => readFileSync(p, 'utf8')).not.toThrow();
    }
  });

  test('fetchWithTimeout aborts slow upstream (timeout path)', async () => {
    const hangingFetch = (async (_url: Request | string | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const s = init?.signal;
        if (!s) {
          reject(new Error('expected signal'));
          return;
        }
        s.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      })) as typeof fetch;
    await expect(
      fetchWithTimeout(hangingFetch, 'https://example.com', { timeout_ms: 30 }),
    ).rejects.toThrow();
  });
});
