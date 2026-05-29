/**
 * Produce `landing/src/data/fixture-snapshot.json` shape from pipeline aggregates.
 * Types mirror `landing/src/types.ts` without importing outside `src/`.
 */

import { getBasketForCountry } from '../../engine/basket.js';
import { getAlpha, getCurrency, getMarketType } from '../../engine/hybrid.js';
import {
  computeLocalCoverageSummary,
  type LocalCoverageSummary,
} from '../../engine/local-coverage.js';
import { deriveLocalProvenanceFromCommodityPrices } from './local-provenance.js';
import { getRegionForCountry } from '../../shared/countries.js';
import type {
  CommodityPrice,
  IndexRecord,
  Region,
  GlobalTrack as SchemaGlobalTrack,
} from '../../shared/schema.js';

const DISPLAY_NAMES_EN =
  typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

export interface LandingFixtureCountryRecord {
  kki_value: number;
  kki_value_usd: number;
  local_basket_cost: number;
  global_basket_cost: number;
  quality: 'full' | 'degraded' | 'global_only';
  estimate_method: string;
  estimate_confidence: string;
  source_periodicity: string;
  base_month: string | null;
  estimate_source_ids: string[];
}

export interface LandingFixtureCommodityPrice {
  commodity_code: string;
  commodity_name: string;
  price_local: number;
  currency: string;
  price_usd: number;
  source_id: string;
  source_tier: 1 | 2 | 3;
  weight: number;
  fill_kind?: 'observed' | 'interpolated' | 'forward_filled';
  last_observation_month?: string;
}

export interface LandingFixtureGlobalTrackMini {
  fao_fpi_cereals: number;
  fao_fpi_oils: number;
  fao_fpi_sugar: number;
  brent_crude_usd: number;
  gold_xau_usd: number;
}

export interface LandingFixtureQualityFlags {
  missing_sources: string[];
  interpolated: string[];
  stale_gold: boolean;
  global_only: boolean;
}

export type LandingFixtureLocalCoverage = LocalCoverageSummary;

export interface LandingFixtureCountryData {
  name: string;
  currency: string;
  region: string;
  basket_version: string;
  alpha: number;
  market_type: string;
  diagnostics: LandingFixtureCountryDiagnostics;
  records: Record<string, LandingFixtureCountryRecord>;
  latest_snapshot: {
    snapshot_date: string;
    prices: LandingFixtureCommodityPrice[];
    global_track: LandingFixtureGlobalTrackMini;
    quality_flags: LandingFixtureQualityFlags;
    local_coverage: LandingFixtureLocalCoverage;
  };
}

export interface LandingFixtureCountryDiagnostics {
  first_observed_month: string | null;
  last_estimated_month_before_observed: string | null;
  splice_gap_pct: number | null;
  dominant_estimate_method: string | null;
  has_annual_cpi_history: boolean;
}

export interface LandingFixturePayload {
  schema_version: string;
  methodology_version: string;
  generated_at: string;
  months: string[];
  countries: Record<string, LandingFixtureCountryData>;
}

/** Landing fixture uses non-null globals for UI (baseline when adapter values are missing). */
function toLandingGlobalTrack(gt: SchemaGlobalTrack): LandingFixtureGlobalTrackMini {
  return {
    fao_fpi_cereals: gt.fao_fpi_cereals ?? 100,
    fao_fpi_oils: gt.fao_fpi_oils ?? 100,
    fao_fpi_sugar: gt.fao_fpi_sugar ?? 100,
    brent_crude_usd: gt.brent_crude_usd ?? 65,
    gold_xau_usd: gt.gold_xau_usd ?? 1200,
  };
}

export function countryDisplayName(code: string): string {
  const cc = code.toUpperCase().slice(0, 2);
  try {
    return DISPLAY_NAMES_EN?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

function slugRegion(r: Region | undefined): string {
  return r ?? 'unknown';
}

function isObservedLocal(record: IndexRecord): boolean {
  return record.estimate_method === 'observed' && record.local_basket_cost > 0;
}

function isEstimated(record: IndexRecord): boolean {
  return record.estimate_method !== 'observed';
}

export function buildCountryDiagnostics(
  recordsByMonth: ReadonlyMap<string, CountryMonthlyPipelineRow>,
): LandingFixtureCountryDiagnostics {
  const months = [...recordsByMonth.keys()].sort();
  const firstObservedMonth =
    months.find((m) => {
      const row = recordsByMonth.get(m);
      return row ? isObservedLocal(row.record) : false;
    }) ?? null;
  const lastEstimatedMonthBeforeObserved = firstObservedMonth
    ? ([...months]
        .filter((m) => {
          const row = recordsByMonth.get(m);
          return m < firstObservedMonth && row ? isEstimated(row.record) : false;
        })
        .pop() ?? null)
    : null;
  const observed = firstObservedMonth ? recordsByMonth.get(firstObservedMonth)?.record : undefined;
  const estimated = lastEstimatedMonthBeforeObserved
    ? recordsByMonth.get(lastEstimatedMonthBeforeObserved)?.record
    : undefined;
  const spliceGapPct =
    observed && estimated && estimated.kki_value > 0
      ? Number(
          (((observed.kki_value - estimated.kki_value) / estimated.kki_value) * 100).toFixed(1),
        )
      : null;

  const methodCounts = new Map<string, number>();
  let hasAnnualCpiHistory = false;
  for (const month of months) {
    const record = recordsByMonth.get(month)?.record;
    if (!record) continue;
    if (record.estimate_method !== 'observed') {
      methodCounts.set(record.estimate_method, (methodCounts.get(record.estimate_method) ?? 0) + 1);
    }
    if (
      record.source_periodicity === 'annual' &&
      (record.estimate_method === 'cpi_chained' ||
        record.estimate_method === 'headline_cpi_chained')
    ) {
      hasAnnualCpiHistory = true;
    }
  }
  const dominantEstimateMethod =
    [...methodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    first_observed_month: firstObservedMonth,
    last_estimated_month_before_observed: lastEstimatedMonthBeforeObserved,
    splice_gap_pct: spliceGapPct,
    dominant_estimate_method: dominantEstimateMethod,
    has_annual_cpi_history: hasAnnualCpiHistory,
  };
}

export type CountryMonthlyPipelineRow = {
  record: IndexRecord;
  commodityPrices: CommodityPrice[];
  schemaGlobalTrack: SchemaGlobalTrack;
  staleGold: boolean;
  staleEnergy: boolean;
};

export function buildLandingFixtureData(args: {
  schema_version: string;
  methodology_version: string;
  generated_at: string;
  fixtureMonths: readonly string[];
  byCountryMonth: ReadonlyMap<string, ReadonlyMap<string, CountryMonthlyPipelineRow>>;
}): LandingFixturePayload {
  const sortedMonths = [...args.fixtureMonths].sort();
  const countries: Record<string, LandingFixtureCountryData> = {};

  for (const [ccUpper, inner] of args.byCountryMonth) {
    if (sortedMonths.length === 0) continue;
    const lastMonth = sortedMonths[sortedMonths.length - 1]!;
    const lastRow = inner.get(lastMonth);
    const region = slugRegion(getRegionForCountry(ccUpper));

    let basket_version = '';
    try {
      basket_version = getBasketForCountry(ccUpper, args.methodology_version).basket_id;
    } catch {
      basket_version = 'unknown-v1';
    }

    const emptyCoverage = emptyLocalCoverage(ccUpper, args.methodology_version);
    const countryPayload: LandingFixtureCountryData = {
      name: countryDisplayName(ccUpper),
      currency: getCurrency(ccUpper),
      region,
      basket_version,
      alpha: getAlpha(ccUpper),
      market_type: getMarketType(ccUpper),
      diagnostics: buildCountryDiagnostics(inner),
      records: {},
      latest_snapshot: {
        snapshot_date: `${lastMonth}-15`,
        prices: [],
        global_track: toLandingGlobalTrack(lastRow?.schemaGlobalTrack ?? ({} as SchemaGlobalTrack)),
        quality_flags: {
          missing_sources: [],
          interpolated: [],
          stale_gold: Boolean(lastRow?.staleGold),
          global_only: lastRow?.record.quality === 'global_only',
        },
        local_coverage: emptyCoverage,
      },
    };

    for (const ym of sortedMonths) {
      const row = inner.get(ym);
      if (!row) continue;
      countryPayload.records[ym] = {
        kki_value: row.record.kki_value,
        kki_value_usd: row.record.kki_value_usd,
        local_basket_cost: row.record.local_basket_cost,
        global_basket_cost: row.record.global_basket_cost,
        quality: row.record.quality,
        estimate_method: row.record.estimate_method,
        estimate_confidence: row.record.estimate_confidence,
        source_periodicity: row.record.source_periodicity,
        base_month: row.record.base_month,
        estimate_source_ids: row.record.estimate_source_ids,
      };
    }

    if (lastRow) {
      const basket = getBasketForCountry(ccUpper, args.methodology_version);
      const basketItems = basket.items;
      const weightByCode = new Map(basketItems.map((it) => [it.commodity_code, it.weight]));
      countryPayload.latest_snapshot = {
        snapshot_date: `${lastMonth}-15`,
        prices: lastRow.commodityPrices.map((p) => ({
          commodity_code: p.commodity_code,
          commodity_name: p.commodity_name,
          price_local: p.price_local,
          currency: p.currency,
          price_usd: p.price_usd,
          source_id: p.source_id,
          source_tier: p.source_tier,
          weight: weightByCode.get(p.commodity_code) ?? 0,
          ...(p.fill_kind ? { fill_kind: p.fill_kind } : {}),
          ...(p.last_observation_month
            ? { last_observation_month: p.last_observation_month }
            : {}),
        })),
        global_track: toLandingGlobalTrack(lastRow.schemaGlobalTrack),
        quality_flags: {
          missing_sources: [],
          interpolated: staleInterpolated(lastRow),
          stale_gold: lastRow.staleGold,
          global_only: lastRow.record.quality === 'global_only',
        },
        local_coverage: computeLocalCoverageSummary(basket, lastRow.commodityPrices),
      };
    }

    countries[ccUpper] = countryPayload;
  }

  return {
    schema_version: args.schema_version,
    methodology_version: args.methodology_version,
    generated_at: args.generated_at,
    months: sortedMonths,
    countries,
  };
}

function emptyLocalCoverage(countryCode: string, methodologyVersion: string): LocalCoverageSummary {
  try {
    const basket = getBasketForCountry(countryCode, methodologyVersion);
    return computeLocalCoverageSummary(basket, []);
  } catch {
    return {
      items_expected: 0,
      items_priced: 0,
      weight_covered: 0,
      threshold: 0.6,
      local_leg_accepted: false,
      missing_high_weight: [],
    };
  }
}

function staleInterpolated(row: CountryMonthlyPipelineRow): string[] {
  const ips: string[] = [];
  if (row.staleGold) ips.push('gold_fallback');
  if (row.staleEnergy) ips.push('energy_fallback');
  const localProv = deriveLocalProvenanceFromCommodityPrices(row.commodityPrices);
  for (const code of localProv.interpolatedCommodityCodes) {
    ips.push(`local:${code}`);
  }
  return ips;
}
