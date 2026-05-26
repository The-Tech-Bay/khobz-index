import { describe, expect, test } from 'bun:test';
import {
  calculatePurchasingPowerEquivalent,
  chainKkiValue,
  chainObservedRecordWithCpi,
  confidenceForChain,
} from '../../../src/engine/historical.js';
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

describe('historical CPI chaining', () => {
  test('chains KKI values by CPI ratio', () => {
    expect(chainKkiValue(13, 76.26, 129.6)).toBeCloseTo(7.65, 2);
  });

  test('classifies confidence by CPI source and cadence', () => {
    expect(confidenceForChain('cpi_chained', 'monthly')).toBe('high');
    expect(confidenceForChain('headline_cpi_chained', 'annual')).toBe('low');
  });

  test('creates additive provenance for a chained record', async () => {
    const record = await chainObservedRecordWithCpi({
      base: BASE_RECORD,
      targetMonth: '1995-12',
      targetCpi: 76.26,
      baseCpi: 129.6,
      method: 'headline_cpi_chained',
      sourcePeriodicity: 'annual',
      sourceIds: ['world-bank-wdi-cpi'],
      computedAt: '2026-05-22T12:30:00.000Z',
    });

    expect(record.month).toBe('1995-12');
    expect(record.estimate_method).toBe('headline_cpi_chained');
    expect(record.estimate_confidence).toBe('low');
    expect(record.base_month).toBe('2024-12');
    expect(record.estimate_source_ids).toEqual(['world-bank-wdi-cpi']);
    expect(record.record_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('chains the local basket with CPI while preserving target-month global track', async () => {
    const target: IndexRecord = {
      ...BASE_RECORD,
      month: '1995-12',
      kki_value: 6.445,
      kki_value_usd: 0.6445,
      local_basket_cost: 0,
      global_basket_cost: 6.445,
      quality: 'global_only',
      alpha: 0,
    };
    const record = await chainObservedRecordWithCpi({
      base: BASE_RECORD,
      existingTarget: target,
      targetMonth: '1995-12',
      targetCpi: 76.26,
      baseCpi: 129.6,
      method: 'headline_cpi_chained',
      sourcePeriodicity: 'annual',
      sourceIds: ['world-bank-wdi-cpi'],
    });

    expect(record.local_basket_cost).toBeCloseTo(8.24, 2);
    expect(record.global_basket_cost).toBe(6.445);
    expect(record.kki_value).toBeCloseTo(7.61, 3);
  });

  test('does not trust non-USD placeholder target FX when local and USD values are equal', async () => {
    const target: IndexRecord = {
      ...BASE_RECORD,
      month: '1990-01',
      kki_value: 0.8,
      kki_value_usd: 0.8,
      local_basket_cost: 0,
      global_basket_cost: 0.8,
      quality: 'global_only',
      alpha: 0,
    };
    const record = await chainObservedRecordWithCpi({
      base: BASE_RECORD,
      existingTarget: target,
      targetMonth: '1990-01',
      targetCpi: 64.8,
      baseCpi: 129.6,
      method: 'headline_cpi_chained',
      sourcePeriodicity: 'annual',
      sourceIds: ['world-bank-wdi-cpi'],
    });

    expect(record.kki_value).toBeCloseTo(4.83, 3);
    expect(record.kki_value_usd).toBeCloseTo(0.483, 3);
  });

  test('computes old-money equivalent in KK terms', () => {
    const result = calculatePurchasingPowerEquivalent({
      amount: 5000,
      originKkiValue: 7.65,
      comparisonKkiValue: 13,
    });

    expect(result.originKk).toBeCloseTo(653.59, 2);
    expect(result.equivalentAmount).toBeCloseTo(8496.73, 2);
  });
});
