/**
 * Pipeline month utilities (backfill CLI).
 */

import { describe, expect, test } from 'bun:test';
import {
  expandInclusiveMonths,
  worldBankMonthRange,
  ymToWorldBankSlice,
} from '../../../src/pipeline/lib/month-utils.js';

describe('pipeline month-utils', () => {
  test('expandInclusiveMonths spans correctly', () => {
    expect(expandInclusiveMonths('2024-01', '2024-03')).toEqual(['2024-01', '2024-02', '2024-03']);
  });

  test('worldBankMonthRange matches WB Indicators envelope', () => {
    expect(worldBankMonthRange('2020-01', '2026-05')).toBe('2020M01:2026M05');
    expect(ymToWorldBankSlice('2019-07')).toBe('2019M07');
  });
});
