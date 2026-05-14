/**
 * ISO 3166-1 alpha-2 → KKI region (data-schema.md RegionSchema).
 * Each country maps to exactly one basket region. Territories follow the assigned market.
 * Unknown codes: use `getRegionForCountry` (returns undefined).
 */

import type { Region } from './schema.js';

type Entry = readonly [string, Region];

function buildCountryRegionMap(lists: readonly Entry[]): Readonly<Record<string, Region>> {
  const out: Record<string, Region> = {};
  for (const [code, region] of lists) {
    const cc = code.toUpperCase();
    const existing = out[cc];
    if (existing !== undefined && existing !== region) {
      throw new Error(`Country ${cc} mapped to both ${existing} and ${region}`);
    }
    out[cc] = region;
  }
  return Object.freeze(out);
}

/** MENA + Middle East (methodology Khobz basket). Includes pilot markets MA, EG (e-commerce pilots MA Jumia, EG Noon per kki_research.md §11). */
const mena: Entry[] = [
  'AE',
  'BH',
  'DZ',
  'EG',
  'EH',
  'IQ',
  'IR',
  'IL',
  'JO',
  'KW',
  'LB',
  'LY',
  'MA',
  'OM',
  'PS',
  'QA',
  'SA',
  'SD',
  'SY',
  'TN',
  'TR',
  'YE',
].map((c) => [c, 'mena'] as const);

/** South Asia (Atta basket). Pilot IN (Bigbasket per kki_research.md §11). */
const south_asia: Entry[] = ['AF', 'BD', 'BT', 'IN', 'LK', 'MV', 'NP', 'PK'].map(
  (c) => [c, 'south_asia'] as const,
);

/** UN Western Africa + Mauritania (Riz basket). Includes pilot NG (kki_research.md). */
const west_africa: Entry[] = [
  'BJ',
  'BF',
  'CV',
  'CI',
  'GM',
  'GH',
  'GN',
  'GW',
  'LR',
  'ML',
  'MR',
  'NE',
  'NG',
  'SN',
  'SL',
  'TG',
  'SH',
  'ST',
].map((c) => [c, 'west_africa'] as const);

/** Eastern + Middle + Southern Africa (Sadza/Ugali basket). Includes pilots KE, SS, CF (architecture / alpha examples). */
const east_southern_africa: Entry[] = [
  'BI',
  'KM',
  'DJ',
  'ER',
  'ET',
  'KE',
  'MG',
  'MW',
  'MU',
  'MZ',
  'RW',
  'SC',
  'SO',
  'SS',
  'TZ',
  'UG',
  'ZM',
  'ZW',
  'BW',
  'LS',
  'NA',
  'ZA',
  'SZ',
  'AO',
  'CF',
  'TD',
  'CG',
  'CD',
  'GA',
  'GQ',
  'CM',
  'IO',
].map((c) => [c, 'east_southern_africa'] as const);

/** East & Southeast Asia, Central Asia, Russia, Oceania (excl. AU/NZ) — Mihan basket or close substitutes. */
const east_asia: Entry[] = [
  'BN',
  'KH',
  'CN',
  'HK',
  'ID',
  'JP',
  'KP',
  'KR',
  'LA',
  'MO',
  'MM',
  'MN',
  'MY',
  'PH',
  'SG',
  'TH',
  'TL',
  'TW',
  'VN',
  'KZ',
  'KG',
  'TJ',
  'TM',
  'UZ',
  'RU',
  'FJ',
  'PG',
  'SB',
  'VU',
  'NC',
  'PF',
  'WS',
  'TO',
  'KI',
  'TV',
  'NR',
  'MH',
  'FM',
  'PW',
  'CK',
  'NU',
  'AS',
  'GU',
  'MP',
  'WF',
  'TK',
].map((c) => [c, 'east_asia'] as const);

/** Latin America & Caribbean (Tortilla basket) — Americas except US/CA/BM/Greenland dependencies treated as oecd. */
const latin_america: Entry[] = [
  'AR',
  'AW',
  'AI',
  'AG',
  'BS',
  'BB',
  'BZ',
  'BO',
  'BQ',
  'BR',
  'KY',
  'CL',
  'CO',
  'CR',
  'CU',
  'CW',
  'DM',
  'DO',
  'EC',
  'SV',
  'FK',
  'GF',
  'GD',
  'GP',
  'GT',
  'GY',
  'HT',
  'HN',
  'JM',
  'MQ',
  'MX',
  'MS',
  'NI',
  'PA',
  'PY',
  'PE',
  'PR',
  'BL',
  'KN',
  'LC',
  'MF',
  'SX',
  'VC',
  'SR',
  'TT',
  'UY',
  'VE',
  'VG',
  'VI',
].map((c) => [c, 'latin_america'] as const);

/** OECD / Europe / N. America / Oceania (Loaf basket). FR, US, DE per data-schema.md §3.3 alpha examples. */
const oecd: Entry[] = [
  'US',
  'CA',
  'GL',
  'BM',
  'AU',
  'NZ',
  'AD',
  'AL',
  'AM',
  'AT',
  'AZ',
  'BY',
  'BE',
  'BA',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FO',
  'FI',
  'FR',
  'GE',
  'DE',
  'GR',
  'HU',
  'IS',
  'IE',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MC',
  'MD',
  'ME',
  'MK',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'RS',
  'SK',
  'SI',
  'SM',
  'ES',
  'SE',
  'CH',
  'UA',
  'VA',
  'XK',
  'GB',
  'AX',
  'GI',
  'GG',
  'JE',
  'IM',
  'SJ',
  'PM',
  'YT',
].map((c) => [c, 'oecd'] as const);

const ALL_ENTRIES: Entry[] = [
  ...mena,
  ...south_asia,
  ...west_africa,
  ...east_southern_africa,
  ...east_asia,
  ...latin_america,
  ...oecd,
];

/** Uppercase ISO 3166-1 alpha-2 → KKI region. */
export const COUNTRY_TO_REGION: Readonly<Record<string, Region>> =
  buildCountryRegionMap(ALL_ENTRIES);

export function getRegionForCountry(code: string): Region | undefined {
  return COUNTRY_TO_REGION[code.toUpperCase()];
}
