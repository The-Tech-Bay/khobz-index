import type { CountryData, CountrySnapshot } from '../types';

export interface LocalCoverageSummary {
  items_expected: number;
  items_priced: number;
  weight_covered: number;
  threshold: number;
  local_leg_accepted: boolean;
  missing_high_weight: Array<{
    commodity_code: string;
    commodity_name: string;
    weight: number;
  }>;
}

export function getLocalCoverage(country: CountryData): LocalCoverageSummary {
  return (
    country.latest_snapshot.local_coverage ?? {
      items_expected: 0,
      items_priced: 0,
      weight_covered: 0,
      threshold: 0.6,
      local_leg_accepted: false,
      missing_high_weight: [],
    }
  );
}

export function formatWeightPct(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

export function qualityLabel(quality: string): string {
  if (quality === 'full') return 'Full local basket';
  if (quality === 'degraded') return 'Partial local basket';
  if (quality === 'global_only') return 'Global fallback only';
  return quality;
}

export function qualityShortLabel(quality: string): string {
  if (quality === 'full') return 'Full';
  if (quality === 'degraded') return 'Partial';
  if (quality === 'global_only') return 'Global fallback';
  return quality;
}

export function coverageSummaryText(coverage: LocalCoverageSummary): string {
  const weightPct = formatWeightPct(coverage.weight_covered);
  const thresholdPct = formatWeightPct(coverage.threshold);
  if (coverage.local_leg_accepted) {
    return `${coverage.items_priced} of ${coverage.items_expected} basket items priced (${weightPct} nominal weight covered; local leg accepted).`;
  }
  if (coverage.items_priced === 0) {
    return `No local basket items priced; below the ${thresholdPct} threshold, so the local leg is suppressed.`;
  }
  return `${coverage.items_priced} of ${coverage.items_expected} local basket items available, covering ${weightPct} of nominal basket weight; below the ${thresholdPct} threshold, so the local leg is suppressed.`;
}

export function basketSectionTitle(quality: string): string {
  if (quality === 'global_only') {
    return 'Available latest basket rows';
  }
  return 'Latest observed basket breakdown';
}

export function hasPartialLocalRows(snapshot: CountrySnapshot): boolean {
  const coverage = snapshot.local_coverage;
  return Boolean(coverage && coverage.items_priced > 0 && !coverage.local_leg_accepted);
}

export function usMoroccoSanityNote(countryCode: string): string | null {
  const cc = countryCode.toUpperCase();
  if (cc === 'US') {
    return 'US KKI levels use FAOSTAT producer-price proxies and may understate true retail basket costs. BLS Average Retail Food Prices integration is planned before strong public claims about the absolute US level.';
  }
  if (cc === 'MA') {
    return 'Morocco often ranks higher than the US in USD KKI because its observed local basket leg is higher in USD terms, not because food is universally more expensive in every category.';
  }
  return null;
}
