import { describe, expect, test } from 'bun:test';
import {
  BasketVersionMismatchError,
  getAllBaskets,
  getBasketForCountry,
  UnknownCountryError,
} from '../../../src/engine/basket.js';

describe('§3.3B.1 basket loader', () => {
  test('loads all 7 regional baskets', () => {
    const all = getAllBaskets();
    expect(all.size).toBe(7);
    const regions = [...all.keys()].sort();
    expect(regions).toEqual([
      'east_asia',
      'east_southern_africa',
      'latin_america',
      'mena',
      'oecd',
      'south_asia',
      'west_africa',
    ]);
  });

  test('basket weights sum to 1.0 (±0.001) for every region', () => {
    const all = getAllBaskets();
    for (const [region, byVersion] of all) {
      for (const [version, basket] of byVersion) {
        const sum = basket.items.reduce((s, item) => s + item.weight, 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
        expect(basket.region).toBe(region);
        expect(basket.methodology_version).toBe(version);
      }
    }
  });

  test('maps MA → mena basket', () => {
    const basket = getBasketForCountry('MA');
    expect(basket.region).toBe('mena');
    expect(basket.basket_id).toBe('mena-v1.0');
  });

  test('maps IN → south_asia basket', () => {
    const basket = getBasketForCountry('IN');
    expect(basket.region).toBe('south_asia');
  });

  test('maps US → oecd basket', () => {
    const basket = getBasketForCountry('US');
    expect(basket.region).toBe('oecd');
  });

  test('case-insensitive country code', () => {
    const basket = getBasketForCountry('ma');
    expect(basket.region).toBe('mena');
  });

  test('throws UnknownCountryError for invalid country', () => {
    expect(() => getBasketForCountry('XX')).toThrow(UnknownCountryError);
  });

  test('throws BasketVersionMismatchError for unknown version', () => {
    expect(() => getBasketForCountry('MA', '99.0.0')).toThrow(BasketVersionMismatchError);
  });
});
