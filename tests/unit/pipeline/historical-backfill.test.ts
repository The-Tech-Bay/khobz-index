import { describe, expect, test } from 'bun:test';
import type { HistoricalCpiEnvelope } from '../../../src/adapters/historical-cpi.js';
import {
  backfillHistoricalRecords,
  shouldCpiReplaceMonth,
} from '../../../src/pipeline/lib/historical-backfill.js';
import type { IndexRecord } from '../../../src/shared/schema.js';

const BASE_RECORD: IndexRecord = {
  country_code: 'MA',
  month: '2024-12',
  kki_value: 13,
  kki_value_usd: 1.3,
  currency: 'MAD',
  alpha: 0.65,
  local_basket_cost: 14,
  global_basket_cost: 11,
  basket_version: 'mena-v1.0',
  methodology_version: '1.0.0',
  computed_at: '2026-05-22T12:00:00.000Z',
  source_summary: [],
  quality: 'degraded',
  estimate_method: 'observed',
  estimate_confidence: 'observed',
  source_periodicity: 'monthly',
  base_month: null,
  estimate_source_ids: [],
  record_hash: '0'.repeat(64),
};

const GLOBAL_ONLY_RECORD: IndexRecord = {
  ...BASE_RECORD,
  month: '1995-12',
  kki_value: 0.8,
  kki_value_usd: 0.8,
  local_basket_cost: 0,
  global_basket_cost: 0.8,
  quality: 'global_only',
  alpha: 0,
};

const CPI_ENVELOPE: HistoricalCpiEnvelope = {
  observations: [
    {
      country_code: 'MA',
      period: '1995',
      value: 76.26,
      kind: 'headline_cpi',
      source_id: 'world-bank-wdi-cpi',
      periodicity: 'annual',
    },
    {
      country_code: 'MA',
      period: '2024',
      value: 129.6,
      kind: 'headline_cpi',
      source_id: 'world-bank-wdi-cpi',
      periodicity: 'annual',
    },
  ],
};

describe('historical backfill pipeline stage', () => {
  test('chains missing months from CPI envelope', async () => {
    const observed = new Map<string, IndexRecord>([[BASE_RECORD.month, BASE_RECORD]]);
    const result = await backfillHistoricalRecords({
      countryCode: 'MA',
      observedByMonth: observed,
      targetMonths: ['1995-12', '2024-12'],
      cpiEnvelope: CPI_ENVELOPE,
      computedAt: '2026-05-22T12:30:00.000Z',
    });

    expect(result.chainedCount).toBe(1);
    const chained = result.records.find((r) => r.month === '1995-12');
    expect(chained?.estimate_method).toBe('headline_cpi_chained');
    expect(chained?.estimate_confidence).toBe('low');
    expect(chained?.kki_value).toBeGreaterThan(0);
  });

  test('replaces pre-local global_only months', async () => {
    const observed = new Map<string, IndexRecord>([
      [GLOBAL_ONLY_RECORD.month, GLOBAL_ONLY_RECORD],
      [BASE_RECORD.month, BASE_RECORD],
    ]);
    const result = await backfillHistoricalRecords({
      countryCode: 'MA',
      observedByMonth: observed,
      targetMonths: ['1995-12', '2024-12'],
      cpiEnvelope: CPI_ENVELOPE,
      computedAt: '2026-05-22T12:30:00.000Z',
    });

    expect(result.replacedCount).toBe(1);
    const chained = result.records.find((r) => r.month === '1995-12');
    expect(chained?.estimate_method).toBe('headline_cpi_chained');
    expect(result.records.find((r) => r.month === '2024-12')?.quality).toBe('degraded');
  });

  test('uses latest CPI-covered local record when newest observed month is beyond CPI coverage', async () => {
    const futureRecord: IndexRecord = {
      ...BASE_RECORD,
      month: '2026-04',
      kki_value: 15,
      kki_value_usd: 1.5,
      local_basket_cost: 16,
    };
    const observed = new Map<string, IndexRecord>([
      [GLOBAL_ONLY_RECORD.month, GLOBAL_ONLY_RECORD],
      [BASE_RECORD.month, BASE_RECORD],
      [futureRecord.month, futureRecord],
    ]);

    const result = await backfillHistoricalRecords({
      countryCode: 'MA',
      observedByMonth: observed,
      targetMonths: ['1995-12', '2024-12', '2026-04'],
      cpiEnvelope: CPI_ENVELOPE,
      computedAt: '2026-05-22T12:30:00.000Z',
    });

    expect(result.replacedCount).toBe(1);
    const chained = result.records.find((r) => r.month === '1995-12');
    expect(chained?.estimate_method).toBe('headline_cpi_chained');
    expect(chained?.base_month).toBe('2024-12');
    expect(result.records.find((r) => r.month === '2026-04')?.quality).toBe('degraded');
  });

  test('replaces stale CPI-chained records before the first observed local month', async () => {
    const staleChained: IndexRecord = {
      ...GLOBAL_ONLY_RECORD,
      estimate_method: 'headline_cpi_chained',
      estimate_confidence: 'low',
      source_periodicity: 'annual',
      base_month: '2022-12',
      local_basket_cost: 99,
      kki_value: 99,
      kki_value_usd: 9.9,
    };
    const observed = new Map<string, IndexRecord>([
      [staleChained.month, staleChained],
      [BASE_RECORD.month, BASE_RECORD],
    ]);

    const result = await backfillHistoricalRecords({
      countryCode: 'MA',
      observedByMonth: observed,
      targetMonths: ['1995-12', '2024-12'],
      cpiEnvelope: CPI_ENVELOPE,
      computedAt: '2026-05-22T12:30:00.000Z',
    });

    expect(result.replacedCount).toBe(1);
    const chained = result.records.find((r) => r.month === '1995-12');
    expect(chained?.base_month).toBe('2024-12');
    expect(chained?.kki_value).not.toBe(99);
  });

  test('shouldCpiReplaceMonth keeps post-local observed rows', () => {
    expect(shouldCpiReplaceMonth('1995-12', GLOBAL_ONLY_RECORD, '2018-01')).toBe(true);
    expect(shouldCpiReplaceMonth('2024-12', BASE_RECORD, '2018-01')).toBe(false);
  });

  test('skips countries without CPI coverage', async () => {
    const observed = new Map<string, IndexRecord>([[BASE_RECORD.month, BASE_RECORD]]);
    const result = await backfillHistoricalRecords({
      countryCode: 'FR',
      observedByMonth: observed,
      targetMonths: ['1995-12'],
      cpiEnvelope: CPI_ENVELOPE,
    });
    expect(result.chainedCount).toBe(0);
  });
});
