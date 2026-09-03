/**
 * Derive index-record provenance from FAOSTAT commodity fill metadata.
 */

import type { CommodityPrice, EstimateConfidence, SourcePeriodicity } from '../../shared/schema.js';

export interface LocalProvenanceFlags {
  sourcePeriodicity: SourcePeriodicity;
  estimateConfidence: EstimateConfidence;
  /** Commodity codes with forward-filled or interpolated local prices. */
  interpolatedCommodityCodes: string[];
}

export function deriveLocalProvenanceFromCommodityPrices(
  prices: readonly CommodityPrice[],
): LocalProvenanceFlags {
  const interpolatedCommodityCodes: string[] = [];
  let hasForwardFilled = false;
  let hasInterpolated = false;

  for (const p of prices) {
    if (p.fill_kind === 'forward_filled') {
      hasForwardFilled = true;
      interpolatedCommodityCodes.push(p.commodity_code);
    } else if (p.fill_kind === 'interpolated') {
      hasInterpolated = true;
      interpolatedCommodityCodes.push(p.commodity_code);
    }
  }

  if (hasForwardFilled || hasInterpolated) {
    return {
      sourcePeriodicity: 'interpolated',
      estimateConfidence: 'low',
      interpolatedCommodityCodes,
    };
  }

  return {
    sourcePeriodicity: 'monthly',
    estimateConfidence: 'observed',
    interpolatedCommodityCodes: [],
  };
}
