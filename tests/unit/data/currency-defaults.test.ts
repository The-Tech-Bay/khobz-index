/**
 * Currency defaults cover every indexed country.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COUNTRY_TO_REGION } from '../../../src/shared/countries.js';

describe('country-currency-defaults.json', () => {
  test('every COUNTRY_TO_REGION code has ISO 4217 entry', () => {
    const p = resolve(import.meta.dir, '../../../data/v1.0/country-currency-defaults.json');
    const cur = JSON.parse(readFileSync(p, 'utf8')) as Record<string, string>;
    for (const code of Object.keys(COUNTRY_TO_REGION)) {
      const ccy = cur[code];
      expect(ccy?.length).toBe(3);
    }
  });
});
