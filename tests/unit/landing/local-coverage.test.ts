import { describe, expect, test } from 'bun:test';
import {
  basketSectionTitle,
  coverageSummaryText,
  qualityLabel,
  qualityShortLabel,
} from '../../../landing/src/lib/localCoverage.js';
import {
  rankingFilterLabel,
  recordsForColorScale,
  splitRankingRecords,
} from '../../../landing/src/lib/rankingFilters.js';
import type { CountryData } from '../../../landing/src/types.js';

function country(
  quality: 'full' | 'degraded' | 'global_only',
  coverage?: Partial<CountryData['latest_snapshot']['local_coverage']>,
): CountryData {
  return {
    name: 'Test',
    currency: 'USD',
    region: 'oecd',
    basket_version: 'oecd-v1.0',
    alpha: 0.65,
    market_type: 'standard',
    records: {},
    latest_snapshot: {
      snapshot_date: '2026-04-15',
      prices: [],
      global_track: {
        fao_fpi_cereals: 100,
        fao_fpi_oils: 100,
        fao_fpi_sugar: 100,
        brent_crude_usd: 65,
        gold_xau_usd: 1200,
      },
      quality_flags: {
        missing_sources: [],
        interpolated: [],
        stale_gold: false,
        global_only: quality === 'global_only',
      },
      local_coverage: {
        items_expected: 5,
        items_priced: coverage?.items_priced ?? (quality === 'global_only' ? 0 : 5),
        weight_covered: coverage?.weight_covered ?? (quality === 'global_only' ? 0.09 : 1),
        threshold: 0.6,
        local_leg_accepted: quality !== 'global_only',
        missing_high_weight: coverage?.missing_high_weight ?? [],
      },
    },
  };
}

describe('landing localCoverage helpers', () => {
  test('quality labels are human-readable', () => {
    expect(qualityLabel('full')).toBe('Full local basket');
    expect(qualityLabel('degraded')).toBe('Partial local basket');
    expect(qualityLabel('global_only')).toBe('Global fallback only');
    expect(qualityShortLabel('global_only')).toBe('Global fallback');
  });

  test('coverage summary explains suppressed local leg', () => {
    const text = coverageSummaryText({
      items_expected: 5,
      items_priced: 2,
      weight_covered: 0.093,
      threshold: 0.6,
      local_leg_accepted: false,
      missing_high_weight: [],
    });
    expect(text).toContain('2 of 5');
    expect(text).toContain('9.3%');
    expect(text).toContain('60.0%');
    expect(text).toContain('suppressed');
  });

  test('basket section title changes for global_only', () => {
    expect(basketSectionTitle('global_only')).toBe('Available latest basket rows');
    expect(basketSectionTitle('full')).toBe('Latest observed basket breakdown');
  });
});

describe('landing rankingFilters helpers', () => {
  const records = {
    MA: {
      code: 'MA',
      name: 'Morocco',
      currency: 'MAD',
      kki_value: 13,
      kki_value_usd: 1.3,
      quality: 'full',
    },
    US: {
      code: 'US',
      name: 'United States',
      currency: 'USD',
      kki_value: 0.8,
      kki_value_usd: 0.8,
      quality: 'global_only',
    },
    LU: {
      code: 'LU',
      name: 'Luxembourg',
      currency: 'EUR',
      kki_value: 0.8,
      kki_value_usd: 0.8,
      quality: 'global_only',
    },
  };
  const countries = {
    MA: country('full'),
    US: country('global_only'),
    LU: country('global_only', { items_priced: 2, weight_covered: 0.09 }),
  };

  test('local_only splits global fallback to collapsed section', () => {
    const split = splitRankingRecords(records, 'local_only', countries);
    expect(split.primary.map((r) => r.code)).toEqual(['MA']);
    expect(split.fallback.map((r) => r.code).sort()).toEqual(['LU', 'US']);
  });

  test('include_partial promotes partial-local global_only rows', () => {
    const split = splitRankingRecords(records, 'include_partial', countries);
    expect(split.primary.map((r) => r.code).sort()).toEqual(['LU', 'MA']);
    expect(split.fallback.map((r) => r.code)).toEqual(['US']);
  });

  test('include_global keeps all rows in primary ranking', () => {
    const split = splitRankingRecords(records, 'include_global', countries);
    expect(split.primary).toHaveLength(3);
    expect(split.fallback).toHaveLength(0);
  });

  test('recordsForColorScale excludes global_only', () => {
    const scaled = recordsForColorScale(records);
    expect(Object.keys(scaled)).toEqual(['MA']);
  });

  test('ranking filter labels', () => {
    expect(rankingFilterLabel('local_only')).toBe('Local basket only');
    expect(rankingFilterLabel('include_global')).toBe('Include global fallback');
  });
});
