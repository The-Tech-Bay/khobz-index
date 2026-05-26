/**
 * Main KKI calculator (§3.3B.5).
 *
 * Orchestrates basket loading, local cost computation, global track
 * composite, and hybrid weighting to produce an IndexRecord that
 * validates against IndexRecordSchema.
 */

import type {
  BasketVersion,
  CommodityPrice,
  EstimateConfidence,
  EstimateMethod,
  GlobalTrack,
  IndexRecord,
  QualityLevel,
  SourcePeriodicity,
  SourceContribution,
} from '../shared/schema.js';
import { IndexRecordSchema } from '../shared/schema.js';
import { getBasketForCountry } from './basket.js';
import { computeGlobalBasketCost } from './global-track.js';
import { computeHybridKKI, getAlpha } from './hybrid.js';

export interface CalculateKKIInput {
  countryCode: string;
  month: string;
  prices: CommodityPrice[];
  globalTrack: GlobalTrack;
  /** Local-currency units per 1 USD. */
  fxRate: number;
  currency: string;
  methodologyVersion?: string;
  /** Source contributions for provenance tracking. */
  sourceSummary?: SourceContribution[];
  /** Additive historical provenance. Current live pipeline records stay `observed`. */
  estimateMethod?: EstimateMethod;
  estimateConfidence?: EstimateConfidence;
  sourcePeriodicity?: SourcePeriodicity;
  baseMonth?: string | null;
  estimateSourceIds?: string[];
}

export interface KKIResult {
  record: IndexRecord;
  quality: QualityLevel;
}

/**
 * Compute the local basket cost as Σ(weight_i × price_local_i) for
 * items whose price is available. Returns the cost and the list of
 * matched/missing commodity codes.
 */
function computeLocalBasketCost(
  basket: BasketVersion,
  prices: CommodityPrice[],
): {
  cost: number;
  matched: string[];
  missing: string[];
  adjustedWeights: Map<string, number>;
  weightCoverageSum: number;
} {
  const priceMap = new Map<string, CommodityPrice>();
  for (const p of prices) {
    priceMap.set(p.commodity_code, p);
  }

  const matched: string[] = [];
  const missing: string[] = [];
  /** Sum of nominal basket weights for items whose price exists (coverage before local re-normalisation — §pipeline D6 threshold). */
  let weightCoverageSum = 0;

  for (const item of basket.items) {
    if (priceMap.has(item.commodity_code)) {
      matched.push(item.commodity_code);
      weightCoverageSum += item.weight;
    } else {
      missing.push(item.commodity_code);
    }
  }

  const adjustedWeights = new Map<string, number>();
  let cost = 0;

  for (const item of basket.items) {
    const price = priceMap.get(item.commodity_code);
    if (!price) continue;

    // Re-normalise weights so available items sum to 1.0 (degraded mode)
    const adjustedWeight = weightCoverageSum > 0 ? item.weight / weightCoverageSum : 0;
    adjustedWeights.set(item.commodity_code, adjustedWeight);
    cost += adjustedWeight * price.price_local;
  }

  return { cost, matched, missing, adjustedWeights, weightCoverageSum };
}

async function computeRecordHash(data: Omit<IndexRecord, 'record_hash'>): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Full KKI calculation for one country-month.
 *
 * Handles degraded mode: when some commodity prices are missing the
 * weights are re-normalised over the available items and quality is
 * flagged as "degraded". When ALL local prices are missing, alpha
 * drops to 0 (global_only). When fewer than ~60% of basket weight has
 * local prices coverage, local leg is dropped (same as §pipeline D6).
 */
export async function calculateKKI(input: CalculateKKIInput): Promise<KKIResult> {
  const {
    countryCode,
    month,
    prices,
    globalTrack,
    fxRate,
    currency,
    methodologyVersion = '1.0.0',
    sourceSummary = [],
    estimateMethod = 'observed',
    estimateConfidence = 'observed',
    sourcePeriodicity = 'monthly',
    baseMonth = null,
    estimateSourceIds = [],
  } = input;

  const cc = countryCode.toUpperCase();
  const basket = getBasketForCountry(cc, methodologyVersion);

  const local = computeLocalBasketCost(basket, prices);
  const globalResult = computeGlobalBasketCost(globalTrack, fxRate);

  let alpha = getAlpha(cc);
  let quality: QualityLevel = 'full';

  if (local.matched.length === 0 || local.weightCoverageSum < 0.6) {
    alpha = 0;
    quality = 'global_only';
  } else if (local.missing.length > 0) {
    quality = 'degraded';
  }

  const hybrid = computeHybridKKI(
    alpha,
    alpha === 0 ? 0 : local.cost,
    globalResult.global_basket_cost,
  );

  const kki_value_usd = fxRate > 0 ? hybrid.kki_value / fxRate : hybrid.kki_value;

  const partial: Omit<IndexRecord, 'record_hash'> = {
    country_code: cc,
    month,
    kki_value: Number(hybrid.kki_value.toFixed(3)),
    kki_value_usd: Number(kki_value_usd.toFixed(3)),
    currency,
    alpha: hybrid.alpha,
    local_basket_cost: Number(hybrid.local_basket_cost.toFixed(3)),
    global_basket_cost: Number(hybrid.global_basket_cost.toFixed(3)),
    basket_version: basket.basket_id,
    methodology_version: methodologyVersion,
    computed_at: new Date().toISOString(),
    source_summary: sourceSummary,
    quality,
    estimate_method: estimateMethod,
    estimate_confidence: estimateConfidence,
    source_periodicity: sourcePeriodicity,
    base_month: baseMonth,
    estimate_source_ids: estimateSourceIds,
  };

  const record_hash = await computeRecordHash(partial);

  const record: IndexRecord = { ...partial, record_hash };

  IndexRecordSchema.parse(record);

  return { record, quality };
}
