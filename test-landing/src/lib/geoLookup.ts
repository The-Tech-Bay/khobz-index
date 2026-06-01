import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import countries110m from "world-atlas/countries-110m.json";

export const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "AF", "008": "AL", "012": "DZ", "024": "AO", "032": "AR",
  "036": "AU", "040": "AT", "050": "BD", "056": "BE", "068": "BO",
  "076": "BR", "100": "BG", "104": "MM", "116": "KH", "120": "CM",
  "124": "CA", "140": "CF", "144": "LK", "148": "TD", "152": "CL",
  "156": "CN", "170": "CO", "178": "CG", "180": "CD", "188": "CR",
  "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "208": "DK",
  "214": "DO", "218": "EC", "818": "EG", "222": "SV", "231": "ET",
  "246": "FI", "250": "FR", "266": "GA", "276": "DE", "288": "GH",
  "300": "GR", "320": "GT", "324": "GN", "328": "GY", "332": "HT",
  "340": "HN", "348": "HU", "356": "IN", "360": "ID", "364": "IR",
  "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI",
  "388": "JM", "392": "JP", "400": "JO", "398": "KZ", "404": "KE",
  "408": "KP", "410": "KR", "414": "KW", "418": "LA", "422": "LB",
  "426": "LS", "430": "LR", "434": "LY", "440": "LT", "442": "LU",
  "450": "MG", "454": "MW", "458": "MY", "466": "ML", "478": "MR",
  "484": "MX", "496": "MN", "504": "MA", "508": "MZ", "512": "OM",
  "516": "NA", "524": "NP", "528": "NL", "540": "NC", "554": "NZ",
  "558": "NI", "562": "NE", "566": "NG", "578": "NO", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH",
  "616": "PL", "620": "PT", "634": "QA", "642": "RO", "643": "RU",
  "646": "RW", "682": "SA", "686": "SN", "694": "SL", "702": "SG",
  "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA",
  "716": "ZW", "724": "ES", "729": "SD", "736": "SS", "740": "SR",
  "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "764": "TH",
  "768": "TG", "780": "TT", "784": "AE", "788": "TN", "792": "TR",
  "800": "UG", "804": "UA", "826": "GB", "834": "TZ", "840": "US",
  "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "894": "ZM",
  "887": "YE",
  "732": "MA",
};

export function normalizeMapAlpha2(alpha2: string | undefined): string | undefined {
  if (!alpha2) return undefined;
  if (alpha2 === "EH") return "MA";
  return alpha2;
}

export function isMoroccoTerritoryAlpha2(alpha2: string | undefined): boolean {
  return normalizeMapAlpha2(alpha2) === "MA";
}

type CountryProps = { ISO_A2?: string; name?: string };

export function getAlpha2(geo: {
  id?: string | number;
  properties?: CountryProps;
}): string | undefined {
  if (geo.properties?.ISO_A2 && geo.properties.ISO_A2 !== "-99") {
    return normalizeMapAlpha2(geo.properties.ISO_A2);
  }
  if (geo.id !== undefined) {
    const id = String(geo.id);
    return normalizeMapAlpha2(ISO_NUMERIC_TO_ALPHA2[id] ?? id);
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = countries110m as any;

export const WORLD_GEOJSON = feature(
  topo,
  topo.objects.countries,
) as unknown as FeatureCollection<Geometry, CountryProps>;

export { countries110m as WORLD_TOPO };
