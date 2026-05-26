import { describe, expect, test } from 'bun:test';
import { calculatePurchasingPower } from '../../../landing/src/lib/purchasingPower.js';
import { normalizeMapAlpha2 } from '../../../landing/src/lib/moroccoMapNormalization.js';
import {
  computeRecordDiagnostics,
  confidenceLabel,
  displayCurrency,
  methodLabel,
} from '../../../landing/src/lib/countryChartSemantics.js';
import type { CountryRecord } from '../../../landing/src/types.js';

const records: Record<string, CountryRecord> = {
  '1995-12': {
    kki_value: 7.2,
    kki_value_usd: 0.78,
    local_basket_cost: 6.5,
    global_basket_cost: 0.8,
    quality: 'degraded',
    estimate_method: 'headline_cpi_chained',
    estimate_confidence: 'low',
    source_periodicity: 'annual',
  },
  '2026-04': {
    kki_value: 12.967,
    kki_value_usd: 1.403,
    local_basket_cost: 14.234,
    global_basket_cost: 10.615,
    quality: 'degraded',
    estimate_method: 'observed',
    estimate_confidence: 'observed',
    source_periodicity: 'monthly',
  },
};

describe('landing purchasing power calculator', () => {
  test('calculates Morocco 1995 old-money estimate from fixture CPI-chained archive', () => {
    const result = calculatePurchasingPower({
      amount: 5000,
      countryCode: 'MA',
      records,
      originMonth: '1995',
      comparisonMonth: '2026-04',
    });

    expect(result).not.toBeNull();
    expect(result?.origin.method).toBe('headline_cpi_chained');
    expect(result?.origin.confidence).toBe('low');
    expect(result?.kkEquivalent).toBeGreaterThan(600);
    expect(result?.equivalentAmount).toBeGreaterThan(8000);
  });

  test('normalizes Western Sahara map features to Morocco', () => {
    expect(normalizeMapAlpha2('EH')).toBe('MA');
    expect(normalizeMapAlpha2('ESH')).toBe('MA');
    expect(normalizeMapAlpha2('732')).toBe('MA');
    expect(normalizeMapAlpha2('MA')).toBe('MA');
  });

  test('labels historical chart provenance without raw enum copy', () => {
    expect(methodLabel('headline_cpi_chained', 'annual')).toBe(
      'Annual headline CPI estimate',
    );
    expect(confidenceLabel('low')).toBe('Low-confidence estimate');
    expect(displayCurrency('LCU', 'MAD')).toBe('MAD');
  });

  test('derives chart splice diagnostics from country records', () => {
    const diagnostics = computeRecordDiagnostics({
      ...records,
      '2018-01': {
        ...records['2026-04']!,
        kki_value: 9,
      },
    });
    expect(diagnostics.first_observed_month).toBe('2018-01');
    expect(diagnostics.has_annual_cpi_history).toBe(true);
    expect(diagnostics.splice_gap_pct).not.toBeNull();
  });
});
