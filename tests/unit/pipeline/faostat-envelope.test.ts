import { describe, expect, test } from 'bun:test';
import {
  FORWARD_FILL_CAP_MONTHS,
  convertToEnvelope,
  compareYm,
  addMonths,
  extendForwardFillThroughTarget,
} from '../../../scripts/fetch-faostat-prices';

describe('FAOSTAT convertToEnvelope (v1.1 provenance + cap)', () => {
  test('tags monthly rows as observed', () => {
    const rows = convertToEnvelope([
      {
        area_code: '840',
        area: 'United States of America',
        item_code_pp: '267',
        year: 2024,
        month_num: '06',
        value: 1000,
        currency: 'LCU',
      },
    ]);
    const june = rows.find((r) => r.year === '2024' && r.months === '06');
    expect(june?.fill_kind).toBe('observed');
    expect(june?.last_observation).toBe('2024-06');
  });

  test('forward-fill stops after FORWARD_FILL_CAP_MONTHS', () => {
    const rows = convertToEnvelope(
      [
        {
          area_code: '840',
          area: 'United States of America',
          item_code_pp: '267',
          year: 2024,
          month_num: 'annual',
          value: 1000,
          currency: 'LCU',
        },
      ],
      { fillThroughYm: '2025-06' },
    );
    const ff = rows.filter((r) => r.fill_kind === 'forward_filled' && r.area_code === '840');
    expect(ff.length).toBeLessThanOrEqual(FORWARD_FILL_CAP_MONTHS);
    if (ff.length > 0) {
      expect(ff[0]?.last_observation).toBe('2024-12');
    }
  });

  test('addMonths and compareYm', () => {
    const cap = addMonths(2024, 12, FORWARD_FILL_CAP_MONTHS);
    expect(cap).toEqual({ year: 2025, month: 6 });
    expect(compareYm(2025, 7, cap.year, cap.month)).toBeGreaterThan(0);
  });

  test('extendForwardFillThroughTarget carries latest row through pipeline month', () => {
    const base = convertToEnvelope(
      [
        {
          area_code: '840',
          area: 'United States of America',
          item_code_pp: '267',
          year: 2025,
          month_num: '01',
          value: 1000,
          currency: 'LCU',
        },
      ],
      { fillThroughYm: '2025-01' },
    );
    const { rows, pipelineExtendedCount } = extendForwardFillThroughTarget(base, '2026-05');
    expect(pipelineExtendedCount).toBeGreaterThan(0);
    const may26 = rows.filter(
      (r) => r.area_code === '840' && r.year === '2026' && r.months === '05',
    );
    expect(may26.length).toBeGreaterThan(0);
    expect(may26[0]?.fill_kind).toBe('forward_filled');
  });
});
