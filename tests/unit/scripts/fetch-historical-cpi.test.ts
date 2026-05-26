import { describe, expect, test } from 'bun:test';
import {
  buildHistoricalCpiEnvelope,
  summarizeCpiCoverage,
} from '../../../scripts/fetch-historical-cpi.js';

describe('fetch-historical-cpi envelope builder', () => {
  test('maps World Bank rows into validated CPI observations', () => {
    const iso3ToIso2 = new Map([['MAR', 'MA'], ['FRA', 'FR']]);
    const allowedIso2 = new Set(['MA', 'FR']);

    const envelope = buildHistoricalCpiEnvelope({
      iso3ToIso2,
      allowedIso2,
      indicatorRows: [
        {
          kind: 'headline_cpi',
          rows: [
            { countryiso3code: 'MAR', date: '1995', value: 76.26 },
            { countryiso3code: 'FRA', date: '1995', value: 88.1 },
          ],
        },
        {
          kind: 'food_cpi',
          rows: [{ countryiso3code: 'MAR', date: '1995', value: 80.5 }],
        },
      ],
      generatedAt: '2026-05-22T12:00:00.000Z',
    });

    expect(envelope.observations.length).toBe(3);
    expect(envelope.observations.some((o) => o.country_code === 'MA' && o.kind === 'food_cpi')).toBe(
      true,
    );
    expect(
      envelope.observations.some((o) => o.country_code === 'FR' && o.kind === 'headline_cpi'),
    ).toBe(true);
    expect(summarizeCpiCoverage(envelope)).toMatchObject({
      countries: 2,
      observations: 3,
      foodCountries: 1,
      headlineCountries: 2,
      headlineOnlyCountries: 1,
      latestFoodPeriod: '1995',
      latestHeadlinePeriod: '1995',
    });
  });
});
