/**
 * §3.2B.8 orchestrator — slot cascade, retries, parallel fetch, memoization.
 */
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createFrankfurterAdapter } from '../../../src/adapters/frankfurter.js';
import {
  DEFAULT_SLOT_CHAINS,
  fetchAdapterWithRetries,
  KkiAdapterOrchestrator,
} from '../../../src/adapters/orchestrator.js';
import type {
  AdapterResult,
  DataSlot,
  FetchMetadata,
  FetchParams,
  PriceRecord,
  SourceAdapter,
  SourceId,
  SourceTier,
} from '../../../src/shared/schema.js';
import { createMockFetch } from '../../helpers/mock-fetch.js';

function meta(id: SourceId, tier: SourceTier, count: number, target: string): FetchMetadata {
  return {
    source_id: id,
    tier,
    response_time_ms: 1,
    record_count: count,
    date_range: { from: target.slice(0, 10), to: target.slice(0, 10) },
    cache_hit: false,
  };
}

function stubAdapter(
  id: SourceId,
  tier: SourceTier,
  covers: DataSlot[],
  handler: (p: FetchParams) => Promise<AdapterResult>,
): SourceAdapter {
  return {
    id,
    tier,
    name: id,
    covers,
    native_cadence: 'monthly',
    fetch: handler,
  };
}

describe('orchestrator §3.2B.8', () => {
  test('global cereals: primary FAO succeeds', async () => {
    const orch = new KkiAdapterOrchestrator({
      'fao-fpi': stubAdapter('fao-fpi', 1, ['global_cereals_oils_sugar'], async (p) => ({
        ok: true,
        changed: true,
        records: [
          {
            commodity: 'fao_fpi_cereals',
            price_usd: 100,
            price_unit: 'index',
            date: '2026-04',
            source_id: 'fao-fpi',
            fetched_at: new Date().toISOString(),
          },
        ],
        metadata: meta('fao-fpi', 1, 1, p.target_date),
      })),
      'wb-pink-sheet': stubAdapter('wb-pink-sheet', 1, [], async () => ({
        ok: false,
        error: {
          source_id: 'wb-pink-sheet',
          code: 'UPSTREAM_ERROR',
          message: 'not needed',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
    });
    const r = await orch.fetchSlot({ target_date: '2026-05-05' }, 'global_cereals_oils_sugar');
    expect(r.ok && r.source_id).toBe('fao-fpi');
  });

  test('global cereals: FAO fails → WB', async () => {
    const orch = new KkiAdapterOrchestrator({
      'fao-fpi': stubAdapter('fao-fpi', 1, [], async () => ({
        ok: false,
        error: {
          source_id: 'fao-fpi',
          code: 'UPSTREAM_ERROR',
          message: 'down',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
      'wb-pink-sheet': stubAdapter('wb-pink-sheet', 1, [], async (p) => ({
        ok: true,
        changed: true,
        records: [
          {
            commodity: 'maize_world_usd_mt',
            price_usd: 165,
            price_unit: 'USD/mt',
            date: '2026-04',
            source_id: 'wb-pink-sheet',
            fetched_at: new Date().toISOString(),
          },
        ],
        metadata: meta('wb-pink-sheet', 1, 1, p.target_date),
      })),
    });
    const r = await orch.fetchSlot({ target_date: '2026-05-05' }, 'global_cereals_oils_sugar');
    expect(r.ok && r.source_id).toBe('wb-pink-sheet');
  });

  test('gold: Goldprice fails → Metals', async () => {
    const orch = new KkiAdapterOrchestrator({
      'goldprice-dev': stubAdapter('goldprice-dev', 3, [], async () => ({
        ok: false,
        error: {
          source_id: 'goldprice-dev',
          code: 'UPSTREAM_ERROR',
          message: 'down',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
      'metals-dev': stubAdapter('metals-dev', 3, [], async (p) => ({
        ok: true,
        changed: true,
        records: [
          {
            commodity: 'gold_xau_usd',
            price_usd: 2300,
            price_unit: 'USD/troy_oz',
            date: '2026-05',
            source_id: 'metals-dev',
            fetched_at: new Date().toISOString(),
          },
        ],
        metadata: meta('metals-dev', 3, 1, p.target_date),
      })),
    });
    const r = await orch.fetchSlot({ target_date: '2026-05-05' }, 'gold_spot');
    expect(r.ok && r.source_id).toBe('metals-dev');
  });

  test('slot-unavailable when chain exhausted', async () => {
    const orch = new KkiAdapterOrchestrator({
      'goldprice-dev': stubAdapter('goldprice-dev', 3, [], async () => ({
        ok: false,
        error: {
          source_id: 'goldprice-dev',
          code: 'NETWORK_ERROR',
          message: 'x',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
      'metals-dev': stubAdapter('metals-dev', 3, [], async () => ({
        ok: false,
        error: {
          source_id: 'metals-dev',
          code: 'NETWORK_ERROR',
          message: 'y',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
    });
    const r = await orch.fetchSlot({ target_date: '2026-05-05' }, 'gold_spot');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('slot-unavailable');
      expect(r.errors.length).toBe(2);
    }
  });

  test('fetchAllSlots runs all five slots in parallel', async () => {
    const mkOk = (
      id: SourceId,
      tier: SourceTier,
      commodity: string,
      extra?: Partial<PriceRecord>,
    ): SourceAdapter =>
      stubAdapter(id, tier, [], async (p) => ({
        ok: true,
        changed: true,
        records: [
          {
            commodity,
            price_usd: 1,
            price_unit: 'u',
            date: '2026-04',
            source_id: id,
            fetched_at: new Date().toISOString(),
            ...extra,
          },
        ],
        metadata: meta(id, tier, 1, p.target_date),
      }));

    const orch = new KkiAdapterOrchestrator({
      'fao-fpi': mkOk('fao-fpi', 1, 'fao_fpi_cereals'),
      faostat: mkOk('faostat', 1, '23112', { country_code: 'MA' }),
      'wfp-vam': stubAdapter('wfp-vam', 1, [], async () => ({
        ok: false,
        error: {
          source_id: 'wfp-vam',
          code: 'UPSTREAM_ERROR',
          message: 'skip',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
      'goldprice-dev': mkOk('goldprice-dev', 3, 'gold_xau_usd'),
      'wb-pink-sheet': mkOk('wb-pink-sheet', 1, 'brent_crude_usd'),
      'eia-steo': mkOk('eia-steo', 1, 'brent_crude_usd'),
      frankfurter: mkOk('frankfurter', 3, 'fx_USD_MAD'),
      'exchangerate-host': mkOk('exchangerate-host', 3, 'fx_USDEUR'),
    });

    const map = await orch.fetchAllSlots({ target_date: '2026-05-05', countries: ['MA'] });
    expect(map.size).toBe(5);
    for (const slot of Object.keys(DEFAULT_SLOT_CHAINS) as DataSlot[]) {
      const e = map.get(slot);
      expect(e?.ok).toBe(true);
    }
  });

  test('changed:false still fills slot from state.records', async () => {
    const stateRecords: PriceRecord[] = [
      {
        commodity: 'fao_fpi_cereals',
        price_usd: 99,
        price_unit: 'index',
        date: '2026-04',
        source_id: 'fao-fpi',
        fetched_at: new Date().toISOString(),
      },
    ];
    const orch = new KkiAdapterOrchestrator({
      'fao-fpi': stubAdapter('fao-fpi', 1, [], async () => ({
        ok: true,
        changed: false,
        state: {
          content_hash: 'a'.repeat(64),
          fetched_at: new Date().toISOString(),
          records: stateRecords,
        },
        metadata: meta('fao-fpi', 1, 1, '2026-05-05'),
      })),
    });
    const r = await orch.fetchSlot({ target_date: '2026-05-05' }, 'global_cereals_oils_sugar');
    expect(r.ok && !r.changed && r.records[0]?.price_usd).toBe(99);
  });

  test('fetchAdapterWithRetries uses backoff (0ms in test)', async () => {
    let attempts = 0;
    const a = stubAdapter('goldprice-dev', 3, [], async () => {
      attempts++;
      if (attempts < 3) {
        return {
          ok: false,
          error: {
            source_id: 'goldprice-dev',
            code: 'UPSTREAM_ERROR',
            message: `a${attempts}`,
            retryable: true,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return {
        ok: true,
        changed: true,
        records: [
          {
            commodity: 'gold_xau_usd',
            price_usd: 1,
            price_unit: 'oz',
            date: '2026-05',
            source_id: 'goldprice-dev',
            fetched_at: new Date().toISOString(),
          },
        ],
        metadata: meta('goldprice-dev', 3, 1, '2026-05-05'),
      };
    });
    const r = await fetchAdapterWithRetries(a, { target_date: '2026-05-05' }, [0, 0]);
    expect(r.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  test('WB adapter memoized when two slots need it (parallel)', async () => {
    let wbCalls = 0;
    const sharedRecords: PriceRecord[] = [
      {
        commodity: 'maize_world_usd_mt',
        price_usd: 160,
        price_unit: 'USD/mt',
        date: '2026-02',
        source_id: 'wb-pink-sheet',
        fetched_at: new Date().toISOString(),
      },
      {
        commodity: 'brent_crude_usd',
        price_usd: 77,
        price_unit: 'USD/barrel',
        date: '2026-02',
        source_id: 'wb-pink-sheet',
        fetched_at: new Date().toISOString(),
      },
    ];

    const orch = new KkiAdapterOrchestrator({
      'fao-fpi': stubAdapter('fao-fpi', 1, [], async () => ({
        ok: false,
        error: {
          source_id: 'fao-fpi',
          code: 'UPSTREAM_ERROR',
          message: 'x',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
      'wb-pink-sheet': stubAdapter('wb-pink-sheet', 1, [], async (p) => {
        wbCalls++;
        return {
          ok: true,
          changed: true,
          records: sharedRecords,
          metadata: meta('wb-pink-sheet', 1, sharedRecords.length, p.target_date),
        };
      }),
      'eia-steo': stubAdapter('eia-steo', 1, [], async () => ({
        ok: false,
        error: {
          source_id: 'eia-steo',
          code: 'UPSTREAM_ERROR',
          message: 'x',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
    });

    await Promise.all([
      orch.fetchSlot({ target_date: '2026-05-05' }, 'global_cereals_oils_sugar'),
      orch.fetchSlot({ target_date: '2026-05-05' }, 'crude_oil_energy'),
    ]);
    expect(wbCalls).toBe(1);
  });

  test('Frankfurter fixture via mock fetch', async () => {
    const fxPath = resolve(import.meta.dir, '../../fixtures/frankfurter-sample.json');
    const mock = createMockFetch([{ test: (u) => u.includes('frankfurter'), fixturePath: fxPath }]);
    const a = createFrankfurterAdapter({
      fetchImpl: mock,
      latestUrl: 'https://api.frankfurter.test/v2/latest',
    });
    const orch = new KkiAdapterOrchestrator({
      frankfurter: a,
      'exchangerate-host': stubAdapter('exchangerate-host', 3, [], async () => ({
        ok: false,
        error: {
          source_id: 'exchangerate-host',
          code: 'NOT_FOUND',
          message: 'n/a',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      })),
    });
    const r = await orch.fetchSlot({ target_date: '2026-05-10' }, 'fx_display');
    expect(r.ok && r.records.length).toBeGreaterThan(0);
  });
});
