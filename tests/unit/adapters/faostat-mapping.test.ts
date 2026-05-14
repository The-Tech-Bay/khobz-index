/**
 * FAOSTAT area map + extractor (multi-country pipeline support).
 */

import { describe, expect, test } from 'bun:test';
import {
  extractFaostatPriceRecordsFromEnvelope,
  faostatAreaToIso2,
} from '../../../src/adapters/faostat.js';

describe('faostat bulk parsing', () => {
  test('faostatAreaToIso2 resolves UN M49 + FAOSTAT overrides', () => {
    expect(faostatAreaToIso2('212')).toBe('MA');
    expect(faostatAreaToIso2('818')).toBe('EG');
    expect(faostatAreaToIso2('144')).toBe('LK');
    expect(faostatAreaToIso2('840')).toBe('US');
  });

  test('extractFaostatPriceRecordsFromEnvelope honours filter_month', () => {
    const fetchedAt = '2026-01-01T00:00:00.000Z';
    const envelope = {
      data: [
        {
          area_code: '212',
          item_code: '16',
          year: '2025',
          months: '12',
          value: 7,
          currency: 'MAD',
        },
        {
          area_code: '212',
          item_code: '16',
          year: '2025',
          months: '11',
          value: 99,
          currency: 'MAD',
        },
      ],
    };
    const all = extractFaostatPriceRecordsFromEnvelope(
      envelope,
      {
        filter_month: '2025-12',
        lcu_per_usd_by_country: { MA: 10 },
      },
      fetchedAt,
    );
    expect(all.length).toBe(1);
    const first = all[0];
    expect(first?.country_code).toBe('MA');
    expect(first?.date).toBe('2025-12');
  });
});
