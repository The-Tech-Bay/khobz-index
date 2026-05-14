/**
 * Frankfurter historical `/v2/YYYY-MM-DD` wiring.
 */
import { describe, expect, test } from 'bun:test';
import { createFrankfurterAdapter } from '../../../src/adapters/frankfurter.js';

describe('frankfurter historical target_date', () => {
  test('uses /v2/rates?date=… and rolls weekend anchors to ECB weekdays', async () => {
    const caught: string[] = [];

    const mockFetch = (async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      caught.push(url);
      return new Response(
        JSON.stringify({ base: 'USD', date: '2024-06-15', rates: { MAD: 9.91 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const a = createFrankfurterAdapter({ fetchImpl: mockFetch });
    const r = await a.fetch({
      target_date: '2024-06',
    });
    expect(r.ok).toBe(true);
    expect(caught.some((url) => url.includes('/v2/rates') && url.includes('date=2024-06-14'))).toBe(
      true,
    );
    if (r.ok && r.changed) {
      expect(r.records.some((x) => x.commodity === 'fx_USD_MAD')).toBe(true);
    }
  });
});
