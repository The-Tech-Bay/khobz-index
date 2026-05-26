import { describe, expect, test } from 'bun:test';
import { buildCountryDiagnostics, type CountryMonthlyPipelineRow } from '../../../src/pipeline/lib/fixture-builder.js';
import type { IndexRecord } from '../../../src/shared/schema.js';

const baseRecord: IndexRecord = {
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

function row(record: IndexRecord): CountryMonthlyPipelineRow {
  return {
    record,
    commodityPrices: [],
    schemaGlobalTrack: {
      fao_fpi_cereals: 100,
      fao_fpi_oils: 100,
      fao_fpi_sugar: 100,
      brent_crude_usd: 65,
      gold_xau_usd: 1200,
      source_ids: [],
    },
    staleGold: false,
    staleEnergy: false,
  };
}

describe('landing fixture diagnostics', () => {
  test('detects observed boundary and splice gap', () => {
    const diagnostics = buildCountryDiagnostics(
      new Map([
        [
          '1995-12',
          row({
            ...baseRecord,
            month: '1995-12',
            kki_value: 8,
            local_basket_cost: 8,
            estimate_method: 'headline_cpi_chained',
            estimate_confidence: 'low',
            source_periodicity: 'annual',
            base_month: '2024-12',
          }),
        ],
        [
          '2018-01',
          row({
            ...baseRecord,
            month: '2018-01',
            kki_value: 10,
            local_basket_cost: 10,
            estimate_method: 'observed',
            estimate_confidence: 'observed',
            source_periodicity: 'monthly',
          }),
        ],
      ]),
    );

    expect(diagnostics.first_observed_month).toBe('2018-01');
    expect(diagnostics.last_estimated_month_before_observed).toBe('1995-12');
    expect(diagnostics.splice_gap_pct).toBe(25);
    expect(diagnostics.dominant_estimate_method).toBe('headline_cpi_chained');
    expect(diagnostics.has_annual_cpi_history).toBe(true);
  });
});
