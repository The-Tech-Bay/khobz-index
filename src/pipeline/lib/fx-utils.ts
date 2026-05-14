/**
 * Frankfurter `PriceRecord` rows → FX map for FAOSTAT LCU USD conversion.
 */

import type { PriceRecord } from '../../shared/schema.js';

/** Local currency units per 1 USD (e.g. MAD 10 ⇒ 10 MAD = 1 USD). */
export function lcuPerUsdFromFrankfurterRecords(
  records: readonly PriceRecord[],
): Record<string, number> {
  const out: Record<string, number> = { USD: 1 };
  for (const r of records) {
    if (!r.commodity.startsWith('fx_USD_')) continue;
    const ccy = r.commodity.slice('fx_USD_'.length).toUpperCase();
    if (ccy.length !== 3) continue;
    if (typeof r.price_usd === 'number' && r.price_usd > 0) {
      out[ccy] = r.price_usd;
    }
  }
  return out;
}
