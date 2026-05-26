import type { FixtureData } from '../types';

export { FixtureProvider, useFixtureData, useFixtureDataRequired } from './FixtureProvider';

export function getCountryCodes(data: FixtureData): string[] {
  return Object.keys(data.countries);
}

export function getCountries(data: FixtureData) {
  return data.countries;
}

export function getCountry(data: FixtureData, code: string) {
  return data.countries[code.toUpperCase()];
}

export function getAvailableMonths(data: FixtureData): string[] {
  return data.months;
}

export function getLatestMonth(data: FixtureData): string {
  const last = data.months[data.months.length - 1];
  if (!last) throw new Error('No months in fixture data');
  return last;
}

export function getRecordForMonth(data: FixtureData, countryCode: string, month: string) {
  const country = getCountry(data, countryCode);
  if (!country) return undefined;
  return country.records[month];
}

export function getAllRecordsForMonth(data: FixtureData, month: string) {
  const result: Record<
    string,
    {
      code: string;
      name: string;
      currency: string;
      kki_value: number;
      kki_value_usd: number;
      quality: string;
    }
  > = {};
  for (const [code, country] of Object.entries(data.countries)) {
    const record = country.records[month];
    if (record) {
      result[code] = {
        code,
        name: country.name,
        currency: country.currency,
        kki_value: record.kki_value,
        kki_value_usd: record.kki_value_usd,
        quality: record.quality,
      };
    }
  }
  return result;
}

export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
