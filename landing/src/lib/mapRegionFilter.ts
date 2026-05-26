export type MapRegionId = 'global' | 'africa' | 'mena' | 'europe' | 'asia' | 'americas';

const AMERICAS_OECD_ISO2 = new Set(['US', 'CA', 'GL', 'BM']);
const OCEANIA_OECD_ISO2 = new Set(['AU', 'NZ']);

/**
 * Matches a country to the continent-style map picker using KKI basket regions in fixture data.
 * Europe = OECD basket minus Americas / Oceania members (covers EU+EFA focus without duplicating Morocco etc.).
 */
export function countryMatchesMapRegion(
  code: string,
  region: MapRegionId,
  basketRegion?: string,
): boolean {
  if (region === 'global') return true;
  const cc = code.toUpperCase();
  const r = basketRegion;
  if (!r) return false;

  switch (region) {
    case 'mena':
      return r === 'mena';
    case 'africa':
      return r === 'west_africa' || r === 'east_southern_africa';
    case 'asia':
      return r === 'south_asia' || r === 'east_asia';
    case 'americas':
      return r === 'latin_america' || AMERICAS_OECD_ISO2.has(cc);
    case 'europe':
      return r === 'oecd' && !AMERICAS_OECD_ISO2.has(cc) && !OCEANIA_OECD_ISO2.has(cc);
    default:
      return true;
  }
}

export function filterRecordsByMapRegion<T extends { code?: string }>(
  records: Record<string, T>,
  region: MapRegionId,
  countries?: Record<string, { region: string }>,
): Record<string, T> {
  if (region === 'global') return records;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(records)) {
    const code = typeof v.code === 'string' ? v.code : k;
    const basketRegion = countries?.[code.toUpperCase()]?.region;
    if (countryMatchesMapRegion(code, region, basketRegion)) {
      out[k] = v;
    }
  }
  return out;
}
