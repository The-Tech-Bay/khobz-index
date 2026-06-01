export interface SampleRecord {
  code: string;
  name: string;
  currency: string;
  kki_value: number;
  kki_value_usd: number;
}

/** Fixed sample values spanning the KKI color range for visual comparison. */
export const SAMPLE_RECORDS: Record<string, SampleRecord> = {
  US: { code: "US", name: "United States", currency: "USD", kki_value: 4.82, kki_value_usd: 4.82 },
  CA: { code: "CA", name: "Canada", currency: "CAD", kki_value: 6.1, kki_value_usd: 4.45 },
  GB: { code: "GB", name: "United Kingdom", currency: "GBP", kki_value: 3.95, kki_value_usd: 5.02 },
  DE: { code: "DE", name: "Germany", currency: "EUR", kki_value: 4.2, kki_value_usd: 4.55 },
  FR: { code: "FR", name: "France", currency: "EUR", kki_value: 4.05, kki_value_usd: 4.38 },
  ES: { code: "ES", name: "Spain", currency: "EUR", kki_value: 3.6, kki_value_usd: 3.9 },
  IT: { code: "IT", name: "Italy", currency: "EUR", kki_value: 3.85, kki_value_usd: 4.17 },
  SE: { code: "SE", name: "Sweden", currency: "SEK", kki_value: 52.0, kki_value_usd: 4.95 },
  NO: { code: "NO", name: "Norway", currency: "NOK", kki_value: 58.0, kki_value_usd: 5.35 },
  CH: { code: "CH", name: "Switzerland", currency: "CHF", kki_value: 6.8, kki_value_usd: 7.65 },
  JP: { code: "JP", name: "Japan", currency: "JPY", kki_value: 680, kki_value_usd: 4.52 },
  CN: { code: "CN", name: "China", currency: "CNY", kki_value: 22.5, kki_value_usd: 3.12 },
  IN: { code: "IN", name: "India", currency: "INR", kki_value: 185, kki_value_usd: 2.22 },
  PK: { code: "PK", name: "Pakistan", currency: "PKR", kki_value: 620, kki_value_usd: 2.18 },
  BD: { code: "BD", name: "Bangladesh", currency: "BDT", kki_value: 310, kki_value_usd: 2.65 },
  EG: { code: "EG", name: "Egypt", currency: "EGP", kki_value: 95, kki_value_usd: 1.95 },
  MA: { code: "MA", name: "Morocco", currency: "MAD", kki_value: 38.5, kki_value_usd: 3.85 },
  NG: { code: "NG", name: "Nigeria", currency: "NGN", kki_value: 2850, kki_value_usd: 1.72 },
  KE: { code: "KE", name: "Kenya", currency: "KES", kki_value: 420, kki_value_usd: 2.88 },
  ZA: { code: "ZA", name: "South Africa", currency: "ZAR", kki_value: 68, kki_value_usd: 3.55 },
  BR: { code: "BR", name: "Brazil", currency: "BRL", kki_value: 18.5, kki_value_usd: 3.42 },
  MX: { code: "MX", name: "Mexico", currency: "MXN", kki_value: 72, kki_value_usd: 3.68 },
  AR: { code: "AR", name: "Argentina", currency: "ARS", kki_value: 4200, kki_value_usd: 4.95 },
  CO: { code: "CO", name: "Colombia", currency: "COP", kki_value: 18500, kki_value_usd: 4.25 },
  AU: { code: "AU", name: "Australia", currency: "AUD", kki_value: 7.2, kki_value_usd: 4.68 },
  TR: { code: "TR", name: "Turkey", currency: "TRY", kki_value: 145, kki_value_usd: 4.12 },
  SA: { code: "SA", name: "Saudi Arabia", currency: "SAR", kki_value: 14.5, kki_value_usd: 3.87 },
  AE: { code: "AE", name: "United Arab Emirates", currency: "AED", kki_value: 16.2, kki_value_usd: 4.41 },
  RU: { code: "RU", name: "Russia", currency: "RUB", kki_value: 380, kki_value_usd: 4.05 },
  PL: { code: "PL", name: "Poland", currency: "PLN", kki_value: 16.8, kki_value_usd: 4.18 },
};

export const PROJECTION = {
  scale: 147,
  center: [10, 5] as [number, number],
};
