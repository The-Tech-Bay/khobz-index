import { describe, expect, test } from 'bun:test';
import { computeHybridKKI, getAlpha } from '../../../src/engine/hybrid.js';

describe('§3.3B.4 hybrid weighting + alpha', () => {
  test('α=0.65 standard case', () => {
    const r = computeHybridKKI(0.65, 7.5, 8.2);
    // 0.65 × 7.5 + 0.35 × 8.2 = 4.875 + 2.87 = 7.745
    expect(r.kki_value).toBeCloseTo(7.745, 3);
    expect(r.alpha).toBe(0.65);
    expect(r.local_basket_cost).toBe(7.5);
    expect(r.global_basket_cost).toBe(8.2);
  });

  test('α=0.50 subsidy-heavy case', () => {
    const r = computeHybridKKI(0.5, 7.5, 8.2);
    // 0.50 × 7.5 + 0.50 × 8.2 = 3.75 + 4.1 = 7.85
    expect(r.kki_value).toBeCloseTo(7.85, 3);
  });

  test('α=0 pure global (no local data)', () => {
    const r = computeHybridKKI(0.0, 0, 8.2);
    expect(r.kki_value).toBeCloseTo(8.2, 3);
    expect(r.local_basket_cost).toBe(0);
  });

  test('α=1 pure local', () => {
    const r = computeHybridKKI(1.0, 7.5, 8.2);
    expect(r.kki_value).toBeCloseTo(7.5, 3);
  });

  test('getAlpha returns 0.65 for MA (standard)', () => {
    expect(getAlpha('MA')).toBe(0.65);
  });

  test('getAlpha returns 0.50 for EG (subsidy_heavy)', () => {
    expect(getAlpha('EG')).toBe(0.5);
  });

  test('getAlpha returns 0.80 for DE (high_trust)', () => {
    expect(getAlpha('DE')).toBe(0.8);
  });

  test('getAlpha returns 0.35 for SS (low_trust)', () => {
    expect(getAlpha('SS')).toBe(0.35);
  });

  test('getAlpha falls back to 0.65 for unknown country', () => {
    expect(getAlpha('ZZ')).toBe(0.65);
  });
});
