import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('fixtures', () => {
  test('loads normalized fixture JSON without network', () => {
    const path = resolve(import.meta.dir, '../fixtures/sample-price-record.json');
    const raw = readFileSync(path, 'utf8');
    const record = JSON.parse(raw) as { commodity: string; price_usd: number };
    expect(record.commodity).toBe('wheat_flour');
    expect(record.price_usd).toBeGreaterThan(0);
  });
});
