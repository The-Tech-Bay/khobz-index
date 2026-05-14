import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { COUNTRY_TO_REGION } from '../../src/shared/countries.js';
import { AlphaConfigSchema, BasketVersionSchema } from '../../src/shared/schema.js';

const basketsDir = resolve(import.meta.dir, '../../data/baskets');
const alphaPath = resolve(import.meta.dir, '../../data/v1.0/alpha-config.json');

describe('basket JSON files', () => {
  test('all regional v1.0 baskets validate and weights sum to ~1', () => {
    const files = readdirSync(basketsDir).filter((name) => name.endsWith('-v1.0.json'));
    expect(files.length).toBe(7);

    for (const file of files.sort()) {
      const raw = readFileSync(join(basketsDir, file), 'utf8');
      const parsed = JSON.parse(raw) as unknown;

      const basket = BasketVersionSchema.parse(parsed);
      const sum = basket.items.reduce((s, item) => s + item.weight, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(0.001);
    }
  });
});

describe('alpha-config.json', () => {
  test('validates and keys match COUNTRY_TO_REGION exactly', () => {
    const raw = readFileSync(alphaPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const cfg = AlphaConfigSchema.parse(parsed);

    const alphaKeys = Object.keys(cfg).sort();
    const countryKeys = Object.keys(COUNTRY_TO_REGION).sort();

    expect(alphaKeys).toEqual(countryKeys);
  });
});
