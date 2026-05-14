import { describe, expect, test } from 'bun:test';
import { COUNTRY_TO_REGION, getRegionForCountry } from '../../src/shared/countries.js';
import type { Region } from '../../src/shared/schema.js';

/** Pilots / cited markets from architecture + kki_research */
const expected: ReadonlyArray<readonly [string, Region]> = [
  ['MA', 'mena'],
  ['EG', 'mena'],
  ['IN', 'south_asia'],
  ['KE', 'east_southern_africa'],
  ['NG', 'west_africa'],
  ['FR', 'oecd'],
  ['US', 'oecd'],
  ['DE', 'oecd'],
  ['LB', 'mena'],
  ['SS', 'east_southern_africa'],
  ['CF', 'east_southern_africa'],
  ['TR', 'mena'],
  ['DZ', 'mena'],
  ['TN', 'mena'],
];

describe('country → region map', () => {
  test('pilot and doc examples resolve', () => {
    for (const [code, region] of expected) {
      expect(getRegionForCountry(code)).toBe(region);
      expect(COUNTRY_TO_REGION[code]).toBe(region);
    }
  });

  test('normalizes case', () => {
    expect(getRegionForCountry('ma')).toBe('mena');
  });
});
