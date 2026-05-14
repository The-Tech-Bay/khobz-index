/**
 * Produce `landing/src/data/fixture-snapshot.json` shape from pipeline aggregates.
 * Types mirror `landing/src/types.ts` without importing outside `src/`.
 */

import { getBasketForCountry } from '../../engine/basket.js';
import { getAlpha, getCurrency, getMarketType } from '../../engine/hybrid.js';
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

export interface LandingFixtureCountryData {
  name: string;
  currency: string;
  region: string;
  basket_version: string;
  alpha: number;
  market_type: string;
  records: Record<string, LandingFixtureCountryRecord>;
  latest_snapshot: {
    snapshot_date: string;
    prices: LandingFixtureCommodityPrice[];
    global_track: LandingFixtureGlobalTrackMini;
    quality_flags: LandingFixtureQualityFlags;
  };
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

    const countryPayload: LandingFixtureCountryData = {
      name: countryDisplayName(ccUpper),
      currency: getCurrency(ccUpper),
      region,
      basket_version,
      alpha: getAlpha(ccUpper),
      market_type: getMarketType(ccUpper),
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
      };
    }

    if (lastRow) {
      const basketItems = getBasketForCountry(ccUpper, args.methodology_version).items;
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
        })),
        global_track: toLandingGlobalTrack(lastRow.schemaGlobalTrack),
        quality_flags: {
          missing_sources: [],
          interpolated: staleInterpolated(lastRow),
          stale_gold: lastRow.staleGold,
          global_only: lastRow.record.quality === 'global_only',
        },
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

function staleInterpolated(row: CountryMonthlyPipelineRow): string[] {
  const ips: string[] = [];
  if (row.staleGold) ips.push('gold_fallback');
  if (row.staleEnergy) ips.push('energy_fallback');
  return ips;
}
