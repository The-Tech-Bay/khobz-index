import { describe, expect, test } from 'bun:test';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMonthlyBenchmarkCsv } from '../../../src/pipeline/lib/benchmark-csv.js';

const here = dirname(fileURLToPath(import.meta.url));
const benchCsvPath = resolve(here, '../../../data/reference/monthly-global-benchmarks.csv');

describe('loadMonthlyBenchmarkCsv', () => {
  test('parses bundled monthly-global-benchmarks with FAO FPI columns', () => {
    const m = loadMonthlyBenchmarkCsv(benchCsvPath);
    const row202001 = m.get('2020-01');
    expect(row202001).toBeDefined();
    expect(row202001?.gold_xau_usd).toBeCloseTo(1580, 1);
    expect(row202001?.brent_crude_usd).toBeCloseTo(64, 1);
    expect(row202001?.fao_fpi_cereals).toBeCloseTo(100.7, 6);
    expect(row202001?.fao_fpi_oils).toBeCloseTo(108.73, 6);
    expect(row202001?.fao_fpi_sugar).toBeCloseTo(87.5, 6);
  });

  test('supports legacy CSV rows with only gold and brent (no FAO columns)', () => {
    const legacy = `${[
      ['month', 'gold_xau_usd', 'brent_crude_usd'],
      ['1999-12', '280', '20'],
      ['2000-01', '282', '21'],
    ]
      .map((r) => r.join(','))
      .join('\n')}\n`;
    const p = join(tmpdir(), `benchmark-legacy-${Date.now()}-${Math.random()}.csv`);
    writeFileSync(p, legacy, 'utf8');
    try {
      const m = loadMonthlyBenchmarkCsv(p);
      expect(m.get('2000-01')).toMatchObject({
        month: '2000-01',
        gold_xau_usd: 282,
        brent_crude_usd: 21,
      });
      expect(m.get('2000-01')?.fao_fpi_cereals).toBeUndefined();
    } finally {
      unlinkSync(p);
    }
  });
});
