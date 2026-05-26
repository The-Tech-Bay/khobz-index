/**
 * Shared Zod schemas and adapter contracts (stack.md §2.1, data-schema.md §1–§3).
 */

import { z } from 'zod';

/** ISO 3166-1 alpha-2 country code */
export type CountryCode = string;

/** Unique identifier for a data source (stack.md §2.1) */
export type SourceId =
  | 'fao-fpi'
  | 'faostat'
  | 'wfp-vam'
  | 'wb-pink-sheet'
  | 'goldprice-dev'
  | 'metals-dev'
  | 'frankfurter'
  | 'eia-steo'
  | 'exchangerate-host';

/** Reliability tier per kki_research.md §4.2 */
export type SourceTier = 1 | 2 | 3;

/** The data slots adapters cover (stack.md §2.1); index records only use four formula slots (data-schema.md §3.1). */
export type DataSlot =
  | 'global_cereals_oils_sugar'
  | 'local_market_prices'
  | 'gold_spot'
  | 'crude_oil_energy'
  | 'fx_display';

/** A single normalized price observation */
export const PriceRecordSchema = z.object({
  commodity: z.string(),
  price_usd: z.number().positive(),
  price_local: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  price_unit: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  source_id: z.string(),
  fetched_at: z.string().datetime(),
  /** When set, observation applies to this ISO 3166-1 alpha-2 market (local sources). */
  country_code: z.string().length(2).optional(),
});

export type PriceRecord = z.infer<typeof PriceRecordSchema>;

/** Metadata about a successful fetch */
export interface FetchMetadata {
  source_id: SourceId;
  tier: SourceTier;
  response_time_ms: number;
  record_count: number;
  date_range: { from: string; to: string };
  cache_hit: boolean;
}

/** Structured error for a failed fetch */
export interface AdapterError {
  source_id: SourceId;
  code:
    | 'NETWORK_ERROR'
    | 'AUTH_FAILURE'
    | 'RATE_LIMITED'
    | 'PARSE_ERROR'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'UPSTREAM_ERROR';
  message: string;
  retryable: boolean;
  timestamp: string;
  /** HTTP status from upstream when the failure was an HTTP response */
  http_status?: number;
}

/** Parameters passed to every adapter's fetch method */
export interface FetchParams {
  /** Target week start date in YYYY-MM-DD (Monday) or YYYY-MM for monthly-only sources */
  target_date: string;
  /** Country codes to fetch (adapter may ignore if source is global) */
  countries?: CountryCode[];
  /**
   * ISO2 → local currency units per 1 USD (e.g. MAD=10 means 10 MAD = 1 USD).
   * Used by FAOSTAT rows to derive `price_usd` when the feed is in LCU.
   */
  lcu_per_usd_by_country?: Record<string, number>;
  /** WB Indicators API: optional monthly date window (yyyyMmm:yyyyMmm). */
  wb_date_range?: string;
  /** Timeout in milliseconds */
  timeout_ms?: number;
  /** Previous fetch state — adapter uses this to detect staleness and short-circuit */
  previous?: FetchState;
}

/** Cached state from the last successful fetch, used for staleness detection */
export interface FetchState {
  /** Content hash (SHA-256 of normalized records) from last successful fetch */
  content_hash: string;
  /** ETag or Last-Modified header from last response (if source supports it) */
  etag?: string;
  last_modified?: string;
  /** Timestamp of last successful fetch */
  fetched_at: string;
  /** The records from last fetch (used as cache when source hasn't changed) */
  records: PriceRecord[];
}

/** Discriminated union result type — includes UNCHANGED for skip-when-stale */
export type AdapterResult =
  | { ok: true; changed: true; records: PriceRecord[]; metadata: FetchMetadata }
  | { ok: true; changed: false; state: FetchState; metadata: FetchMetadata }
  | { ok: false; error: AdapterError };

/** The contract every source adapter must implement */
export interface SourceAdapter {
  readonly id: SourceId;
  readonly tier: SourceTier;
  readonly name: string;
  readonly covers: DataSlot[];
  readonly native_cadence: 'realtime' | 'daily' | 'weekly' | 'monthly';
  fetch(params: FetchParams): Promise<AdapterResult>;
}

// --- data-schema.md §1 ---

export const RegionSchema = z.enum([
  'mena',
  'south_asia',
  'east_southern_africa',
  'west_africa',
  'east_asia',
  'latin_america',
  'oecd',
]);

export type Region = z.infer<typeof RegionSchema>;

export const BasketItemSchema = z.object({
  commodity_code: z.string().min(3),
  commodity_name: z.string().min(1),
  faostat_item_code: z.number().int().positive(),
  unit: z.enum(['kg', 'L', 'ct']),
  quantity: z.number().positive(),
  kcal_per_unit: z.number().positive(),
  weight: z.number().min(0).max(1),
});

export type BasketItem = z.infer<typeof BasketItemSchema>;

export const BasketVersionSchema = z
  .object({
    basket_id: z.string().min(1),
    region: RegionSchema,
    basket_name: z.string().min(1),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    superseded_by: z.string().nullable(),
    items: z.array(BasketItemSchema).min(3).max(8),
    target_kcal: z.number().int().min(14000).max(17000),
    methodology_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .refine(
    (basket) => {
      const sum = basket.items.reduce((s, item) => s + item.weight, 0);
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: 'Item weights must sum to 1.0' },
  );

export type BasketVersion = z.infer<typeof BasketVersionSchema>;

// --- data-schema.md §2 ---

export const CommodityPriceSchema = z.object({
  commodity_code: z.string().min(3),
  commodity_name: z.string().min(1),
  price_local: z.number().positive(),
  currency: z.string().length(3),
  price_usd: z.number().positive(),
  source_id: z.string().min(1),
  source_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export type CommodityPrice = z.infer<typeof CommodityPriceSchema>;

export const GlobalTrackSchema = z.object({
  fao_fpi_cereals: z.number().positive().nullable(),
  fao_fpi_oils: z.number().positive().nullable(),
  fao_fpi_sugar: z.number().positive().nullable(),
  brent_crude_usd: z.number().positive().nullable(),
  gold_xau_usd: z.number().positive().nullable(),
  source_ids: z.array(z.string()),
});

export type GlobalTrack = z.infer<typeof GlobalTrackSchema>;

export const QualityFlagsSchema = z.object({
  missing_sources: z.array(z.string()).default([]),
  interpolated: z.array(z.string()).default([]),
  stale_gold: z.boolean().default(false),
  gold_stale_since: z.string().datetime().nullable().default(null),
  global_only: z.boolean().default(false),
});

export type QualityFlags = z.infer<typeof QualityFlagsSchema>;

export const CountrySnapshotSchema = z.object({
  country_code: z.string().length(2),
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  basket_version: z.string().min(1),
  prices: z.array(CommodityPriceSchema),
  global_track: GlobalTrackSchema,
  fetch_timestamp: z.string().datetime(),
  quality_flags: QualityFlagsSchema,
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CountrySnapshot = z.infer<typeof CountrySnapshotSchema>;

// --- data-schema.md §3 ---

export const SourceContributionSchema = z.object({
  slot: z.enum([
    'global_cereals_oils_sugar',
    'local_market_prices',
    'gold_spot',
    'crude_oil_energy',
  ]),
  source_ids: z.array(z.string()),
  tiers: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])),
});

export type SourceContribution = z.infer<typeof SourceContributionSchema>;

export const QualityLevelSchema = z.enum(['full', 'degraded', 'global_only']);

export type QualityLevel = z.infer<typeof QualityLevelSchema>;

export const EstimateMethodSchema = z.enum([
  'observed',
  'cpi_chained',
  'headline_cpi_chained',
  'global_only_historical',
]);

export type EstimateMethod = z.infer<typeof EstimateMethodSchema>;

export const EstimateConfidenceSchema = z.enum(['observed', 'high', 'medium', 'low']);

export type EstimateConfidence = z.infer<typeof EstimateConfidenceSchema>;

export const SourcePeriodicitySchema = z.enum([
  'realtime',
  'daily',
  'weekly',
  'monthly',
  'annual',
  'interpolated',
  'unknown',
]);

export type SourcePeriodicity = z.infer<typeof SourcePeriodicitySchema>;

export const IndexRecordSchema = z.object({
  country_code: z.string().length(2),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  kki_value: z.number().positive(),
  kki_value_usd: z.number().positive(),
  currency: z.string().length(3),
  alpha: z.number().min(0).max(1),
  local_basket_cost: z.number().nonnegative(),
  global_basket_cost: z.number().positive(),
  basket_version: z.string().min(1),
  methodology_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  computed_at: z.string().datetime(),
  source_summary: z.array(SourceContributionSchema),
  quality: QualityLevelSchema,
  estimate_method: EstimateMethodSchema.default('observed'),
  estimate_confidence: EstimateConfidenceSchema.default('observed'),
  source_periodicity: SourcePeriodicitySchema.default('monthly'),
  base_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .default(null),
  estimate_source_ids: z.array(z.string().min(1)).default([]),
  record_hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type IndexRecord = z.infer<typeof IndexRecordSchema>;

export const AlphaConfigSchema = z.record(
  z.string().length(2),
  z.object({
    alpha: z.number().min(0).max(1),
    market_type: z.enum(['high_trust', 'standard', 'subsidy_heavy', 'low_trust', 'no_local_data']),
    /** Overrides default ISO 4217 from `country-currency-defaults.json`. */
    currency: z.string().length(3).optional(),
    rationale: z.string().optional(),
  }),
);

export type AlphaConfig = z.infer<typeof AlphaConfigSchema>;

// --- data-schema.md §5.6 snapshot manifest ---

export const ManifestCountrySchema = z.object({
  country_code: z.string().length(2),
  basket_version: z.string().min(1),
  alpha: z.number().min(0).max(1),
  months_available: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
  latest_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable(),
  latest_quality: QualityLevelSchema.nullable(),
});

export type ManifestCountry = z.infer<typeof ManifestCountrySchema>;

/** Hash map keys are relative paths under `{versionPrefix}/`, e.g. `MA/2026-04.json`. Values are `sha256:hex`. */
export const SnapshotManifestSchema = z.object({
  schema_version: z.literal('1.0'),
  methodology_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  generated_at: z.string().datetime(),
  baskets: z.array(z.string().min(1)),
  countries: z.array(ManifestCountrySchema),
  file_hashes: z.record(z.string().min(1), z.string().regex(/^sha256:[a-f0-9]{64}$/i)),
});

export type SnapshotManifest = z.infer<typeof SnapshotManifestSchema>;

// --- Offline APK bundle (§3.4B.5) ---

/** Index row without provenance breakdown (apk size budget). */
export const SlimIndexRecordSchema = IndexRecordSchema.omit({ source_summary: true });

/** APK months may omit basket cost fields after gzip fallback. */
export const ApkMonthRecordSchema = SlimIndexRecordSchema.partial({
  local_basket_cost: true,
  global_basket_cost: true,
});

export const BundleCountriesSchema = z.record(
  z.string().length(2),
  z.object({
    months: z.array(ApkMonthRecordSchema),
  }),
);

export const KkiApkBundleSchema = z.object({
  generated_at: z.string().datetime(),
  methodology_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  countries: BundleCountriesSchema,
});

export type KkiApkBundle = z.infer<typeof KkiApkBundleSchema>;
export type SlimIndexRecord = z.infer<typeof SlimIndexRecordSchema>;
export type ApkMonthRecord = z.infer<typeof ApkMonthRecordSchema>;
