/**
 * Fixture-based tests for §3.2B.2–7 adapters (no network in CI).
 */
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createFaoFpiAdapter } from '../../../src/adapters/fao-fpi.js';
import { createFaostatAdapter } from '../../../src/adapters/faostat.js';
import { createGoldpriceDevAdapter } from '../../../src/adapters/goldprice-dev.js';
import { createMetalsDevAdapter } from '../../../src/adapters/metals-dev.js';
import { createWbPinkSheetAdapter } from '../../../src/adapters/wb-pink-sheet.js';
import { createWfpVamAdapter } from '../../../src/adapters/wfp-vam.js';
import { assertAdapterResultShape } from '../../helpers/adapter-contract.js';
import { createMockFetch } from '../../helpers/mock-fetch.js';

const fx = (name: string) => resolve(import.meta.dir, '../../fixtures', name);

describe('source adapters (fixtures)', () => {
  test('FAO FPI parses JSON fixture', async () => {
    const mock = createMockFetch([
      { test: (u) => u.includes('fao-fixture'), fixturePath: fx('fao-fpi-sample.json') },
    ]);
    const a = createFaoFpiAdapter({
      fetchImpl: mock,
      jsonUrl: 'https://example.test/fao-fixture',
    });
    await assertAdapterResultShape(a, { target_date: '2026-05-05' });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      const cereals = r.records.find((x) => x.commodity === 'fao_fpi_cereals');
      expect(cereals?.price_usd).toBeCloseTo(128.4);
    }
  });

  test('FAO FPI CSV fallback', async () => {
    const mock = createMockFetch([
      {
        test: (u) => u.includes('primary'),
        status: 500,
        fixturePath: fx('fao-fpi-sample.json'),
      },
      {
        test: (u) => u.includes('csv-fallback'),
        fixturePath: fx('fao-fpi-sample.csv'),
        contentType: 'text/csv',
      },
    ]);
    const a = createFaoFpiAdapter({
      fetchImpl: mock,
      jsonUrl: 'https://example.test/primary',
      csvUrl: 'https://example.test/csv-fallback',
    });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok && r.changed).toBe(true);
  });

  test('FAOSTAT parses ≥3 country rows', async () => {
    const mock = createMockFetch([
      { test: (u) => u.includes('faostat-fixture'), fixturePath: fx('faostat-sample.json') },
    ]);
    const a = createFaostatAdapter({
      fetchImpl: mock,
      jsonUrl: 'https://example.test/faostat-fixture',
    });
    const r = await a.fetch({
      target_date: '2026-05-05',
      /** Fixture rows quote LCU; pipeline supplies FX slice per FAOSTAT area ISO2 keys. */
      lcu_per_usd_by_country: { MA: 10, EG: 31, LK: 324 },
    });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      const countries = new Set(r.records.map((x) => x.country_code).filter(Boolean));
      expect(countries.size).toBeGreaterThanOrEqual(3);
    }
  });

  test('WFP VAM OAuth + items fixture', async () => {
    const mock = createMockFetch([
      {
        test: (u) => u.includes('wfp-token'),
        fixturePath: fx('wfp-token.json'),
        contentType: 'application/json',
      },
      {
        test: (u) => u.includes('wfp-data'),
        fixturePath: fx('wfp-vam-sample.json'),
      },
    ]);
    const a = createWfpVamAdapter({
      fetchImpl: mock,
      tokenUrl: 'https://example.test/wfp-token',
      dataUrl: 'https://example.test/wfp-data',
      clientId: 'fixture',
      clientSecret: 'fixture',
    });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      expect(r.records.some((x) => x.country_code === 'MA')).toBe(true);
    }
  });

  test('WB Pink Sheet JSON', async () => {
    const mockOk = createMockFetch([
      { test: (u) => u.includes('wb-json'), fixturePath: fx('wb-pink-sheet-sample.json') },
    ]);
    const a = createWbPinkSheetAdapter({
      fetchImpl: mockOk,
      indicatorsUrl: 'https://example.test/wb-json',
    });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      expect(r.records.some((x) => x.commodity === 'brent_crude_usd')).toBe(true);
    }
  });

  test('WB Pink Sheet CSV fallback when JSON not ok', async () => {
    const mockCsv = createMockFetch([
      {
        test: (u) => u.includes('wb-json-bad'),
        status: 404,
        fixturePath: fx('wb-pink-sheet-sample.json'),
      },
      {
        test: (u) => u.includes('wb-csv'),
        contentType: 'text/csv',
        fixturePath: fx('wb-pink-sheet-sample.csv'),
      },
    ]);
    const ac = createWbPinkSheetAdapter({
      fetchImpl: mockCsv,
      indicatorsUrl: 'https://example.test/wb-json-bad',
      csvUrl: 'https://example.test/wb-csv',
    });
    const rc = await ac.fetch({ target_date: '2026-05-05' });
    expect(rc.ok && rc.changed).toBe(true);
  });

  test('Goldprice.dev XAU', async () => {
    const mock = createMockFetch([
      { test: (u) => u.includes('gold-fixture'), fixturePath: fx('goldprice-dev-sample.json') },
    ]);
    const a = createGoldpriceDevAdapter({
      fetchImpl: mock,
      pricesUrl: 'https://example.test/gold-fixture',
      apiKey: 'fixture-key',
    });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      expect(r.records[0]?.price_usd).toBeCloseTo(2350.25);
    }
  });

  test('Goldprice.dev 429', async () => {
    const mock429 = createMockFetch([
      {
        test: (u) => u.includes('gold-429'),
        status: 429,
        fixturePath: fx('goldprice-dev-sample.json'),
        headers: { 'retry-after': '60' },
      },
    ]);
    const a = createGoldpriceDevAdapter({
      fetchImpl: mock429,
      pricesUrl: 'https://example.test/gold-429',
      apiKey: 'k',
    });
    const r = await a.fetch({ target_date: '2026-05-05' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('RATE_LIMITED');
      expect(r.error.http_status).toBe(429);
    }
  });

  test('Metals.dev gold + LBMA fields', async () => {
    const mock = createMockFetch([
      { test: (u) => u.includes('metals-fixture'), fixturePath: fx('metals-dev-sample.json') },
    ]);
    const a = createMetalsDevAdapter({
      fetchImpl: mock,
      url: 'https://example.test/metals-fixture',
      apiKey: 'fixture',
    });
    const r = await a.fetch({ target_date: '2026-05-10' });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      expect(r.records.some((x) => x.commodity === 'gold_xau_usd')).toBe(true);
      expect(r.records.some((x) => x.commodity === 'gold_lbma_am_usd')).toBe(true);
    }
  });
});
