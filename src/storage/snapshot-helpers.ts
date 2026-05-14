/**
 * Convenience builders for bridging engine output → persisted snapshot envelopes.
 */

import type { CommodityPrice, CountrySnapshot, GlobalTrack } from '../shared/schema.js';
import { QualityFlagsSchema } from '../shared/schema.js';
import { computeSnapshotPayloadHash } from './integrity.js';

export async function buildCountrySnapshotMinimal(args: {
  country_code: string;
  snapshot_date: string;
  basket_version: string;
  global_track: GlobalTrack;
  fetch_timestamp_iso: string;
  prices?: readonly CommodityPrice[];
  quality_flags?: Partial<CountrySnapshot['quality_flags']>;
}): Promise<CountrySnapshot> {
  const prices = args.prices ?? [];
  const qh = QualityFlagsSchema.parse({
    ...(args.quality_flags ?? {}),
    missing_sources: args.quality_flags?.missing_sources ?? [],
    interpolated: args.quality_flags?.interpolated ?? [],
    stale_gold: args.quality_flags?.stale_gold ?? false,
    gold_stale_since: args.quality_flags?.gold_stale_since ?? null,
    global_only: args.quality_flags?.global_only ?? false,
  });

  const content_hash = await computeSnapshotPayloadHash({
    prices,
    global_track: args.global_track,
  });

  return {
    country_code: args.country_code.toUpperCase().slice(0, 2),
    snapshot_date: args.snapshot_date,
    basket_version: args.basket_version,
    prices: [...prices],
    global_track: args.global_track,
    fetch_timestamp: args.fetch_timestamp_iso,
    quality_flags: qh,
    content_hash,
  };
}
