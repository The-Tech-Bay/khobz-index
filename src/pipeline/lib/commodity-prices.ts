/**
 * Normalize adapter `PriceRecord[]` → engine `CommodityPrice[]`.
 */

import type {
  BasketVersion,
  CommodityPrice,
  PriceRecord,
  SourceId,
  SourceTier,
} from '../../shared/schema.js';

/** Best-effort adapter → tier mirror (landing provenance only). */
export function tierForSourceId(sourceId: string): SourceTier {
  switch (sourceId as SourceId) {
    case 'goldprice-dev':
    case 'metals-dev':
    case 'frankfurter':
    case 'exchangerate-host':
      return 3;
    case 'eia-steo':
      return 2;
    case 'fao-fpi':
    case 'faostat':
    case 'wfp-vam':
    case 'wb-pink-sheet':
      return 1;
    default:
      return sourceId.startsWith('benchmark') ? 2 : 3;
  }
}

export function priceRecordsToBasketCommodityPrices(
  basket: BasketVersion,
  countryRecords: readonly PriceRecord[],
  monthYm: string,
  source_id: string,
): CommodityPrice[] {
  const ym = monthYm.slice(0, 7);
  const want = new Set(basket.items.map((i) => i.commodity_code));
  const best = new Map<string, PriceRecord>();
  for (const r of countryRecords) {
    if (r.date.slice(0, 7) !== ym) continue;
    if (!want.has(r.commodity)) continue;
    best.set(r.commodity, r);
  }
  const tier = tierForSourceId(source_id);
  const prices: CommodityPrice[] = [];
  for (const item of basket.items) {
    const r = best.get(item.commodity_code);
    if (!r) continue;
    const cc = typeof r.currency === 'string' && r.currency.length === 3 ? r.currency : 'USD';
    const price_local =
      typeof r.price_local === 'number' && r.price_local > 0
        ? r.price_local
        : r.price_usd * (typeof r.currency === 'string' ? 1 : 1);
    if (!Number.isFinite(price_local) || price_local <= 0) continue;
    if (!Number.isFinite(r.price_usd) || r.price_usd <= 0) continue;
    prices.push({
      commodity_code: item.commodity_code,
      commodity_name: item.commodity_name,
      price_local,
      currency: cc,
      price_usd: r.price_usd,
      source_id,
      source_tier: tier,
    });
  }
  return prices;
}
