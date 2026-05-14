export interface CountryRecord {
  kki_value: number;
  kki_value_usd: number;
  local_basket_cost: number;
  global_basket_cost: number;
  quality: 'full' | 'degraded' | 'global_only';
}

export interface CommodityPrice {
  commodity_code: string;
  commodity_name: string;
  price_local: number;
  currency: string;
  price_usd: number;
  source_id: string;
  source_tier: 1 | 2 | 3;
  weight: number;
}

export interface GlobalTrack {
  fao_fpi_cereals: number;
  fao_fpi_oils: number;
  fao_fpi_sugar: number;
  brent_crude_usd: number;
  gold_xau_usd: number;
}

export interface QualityFlags {
  missing_sources: string[];
  interpolated: string[];
  stale_gold: boolean;
  global_only: boolean;
}

export interface CountrySnapshot {
  snapshot_date: string;
  prices: CommodityPrice[];
  global_track: GlobalTrack;
  quality_flags: QualityFlags;
}

export interface CountryData {
  name: string;
  currency: string;
  region: string;
  basket_version: string;
  alpha: number;
  market_type: string;
  records: Record<string, CountryRecord>;
  latest_snapshot: CountrySnapshot;
}

export interface FixtureData {
  schema_version: string;
  methodology_version: string;
  generated_at: string;
  months: string[];
  countries: Record<string, CountryData>;
}
