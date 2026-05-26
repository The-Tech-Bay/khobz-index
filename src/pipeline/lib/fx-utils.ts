/**
 * FX `PriceRecord` rows → map for FAOSTAT LCU USD conversion.
 * Supports Frankfurter (`fx_USD_MAD`) and exchangerate.host (`fx_USDMAD`) shapes.
 */

import type { PriceRecord } from '../../shared/schema.js';

function parseUsdQuoteCommodity(commodity: string): string | undefined {
  if (!commodity.startsWith('fx_')) return undefined;
  const body = commodity.slice(3).toUpperCase();
  if (body.startsWith('USD_')) {
    const ccy = body.slice(4);
    return ccy.length === 3 ? ccy : undefined;
  }
  if (body.startsWith('USD') && body.length === 6) {
    return body.slice(3);
  }
  return undefined;
}

/** Local currency units per 1 USD (e.g. MAD 10 ⇒ 10 MAD = 1 USD). */
export function lcuPerUsdFromFxRecords(records: readonly PriceRecord[]): Record<string, number> {
  const out: Record<string, number> = { USD: 1 };
  for (const r of records) {
    const ccy = parseUsdQuoteCommodity(r.commodity);
    if (!ccy) continue;
    if (typeof r.price_usd === 'number' && r.price_usd > 0) {
      out[ccy] = r.price_usd;
    }
  }
  return out;
}

/** @deprecated Use {@link lcuPerUsdFromFxRecords}. */
export const lcuPerUsdFromFrankfurterRecords = lcuPerUsdFromFxRecords;
