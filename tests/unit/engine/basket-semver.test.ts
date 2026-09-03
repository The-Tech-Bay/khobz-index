import { describe, expect, test } from 'bun:test';
import {
  getBasketForCountry,
  resolveBasketMethodologyVersion,
} from '../../../src/engine/basket.js';

describe('basket semver fallback', () => {
  test('resolveBasketMethodologyVersion picks highest <= requested', () => {
    expect(resolveBasketMethodologyVersion(['1.0.0', '1.2.0'], '1.1.0')).toBe('1.0.0');
    expect(resolveBasketMethodologyVersion(['1.0.0'], '1.1.0')).toBe('1.0.0');
    expect(resolveBasketMethodologyVersion(['1.0.0', '1.1.0'], '1.1.0')).toBe('1.1.0');
  });

  test('getBasketForCountry(US, 1.1.0) resolves oecd-v1.0 basket', () => {
    const basket = getBasketForCountry('US', '1.1.0');
    expect(basket.basket_id).toBe('oecd-v1.0');
    expect(basket.methodology_version).toBe('1.0.0');
  });
});
