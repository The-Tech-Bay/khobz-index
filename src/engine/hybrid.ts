/**
 * Hybrid weighting + alpha selection (§3.3B.4).
 *
 * Implements KKI = α × LOCAL + (1 − α) × GLOBAL.
 * Alpha is loaded per country from data/v1.0/alpha-config.json.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AlphaConfig } from '../shared/schema.js';
import { AlphaConfigSchema } from '../shared/schema.js';

export interface HybridResult {
  kki_value: number;
  alpha: number;
  local_basket_cost: number;
  global_basket_cost: number;
}

const ALPHA_CONFIG_PATH = resolve(import.meta.dir, '../../data/v1.0/alpha-config.json');
const CURRENCY_DEFAULTS_PATH = resolve(
  import.meta.dir,
  '../../data/v1.0/country-currency-defaults.json',
);
const DEFAULT_ALPHA = 0.65;

let _alphaConfig: AlphaConfig | null = null;
let _currencyDefaults: Record<string, string> | null = null;

function loadAlphaConfig(): AlphaConfig {
  if (!_alphaConfig) {
    const raw = readFileSync(ALPHA_CONFIG_PATH, 'utf8');
    _alphaConfig = AlphaConfigSchema.parse(JSON.parse(raw));
  }
  return _alphaConfig;
}

function loadCurrencyDefaults(): Record<string, string> {
  if (!_currencyDefaults) {
    const raw = readFileSync(CURRENCY_DEFAULTS_PATH, 'utf8');
    _currencyDefaults = JSON.parse(raw) as Record<string, string>;
  }
  return _currencyDefaults;
}

/**
 * Get the alpha value for a country. Falls back to DEFAULT_ALPHA
 * if the country is not in the config.
 */
export function getAlpha(countryCode: string): number {
  const cfg = loadAlphaConfig();
  const entry = cfg[countryCode.toUpperCase()];
  return entry?.alpha ?? DEFAULT_ALPHA;
}

/** ISO 4217 for indexed country (`alpha-config.currency` or `country-currency-defaults.json`). */
export function getCurrency(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  const cfg = loadAlphaConfig();
  const alphaCur = cfg[cc]?.currency;
  if (alphaCur?.length === 3) return alphaCur;
  const def = loadCurrencyDefaults()[cc];
  if (def?.length === 3) return def;
  return 'USD';
}

export function getMarketType(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  const cfg = loadAlphaConfig();
  return cfg[cc]?.market_type ?? 'standard';
}

/**
 * Compute hybrid KKI from local and global basket costs.
 *
 * Edge cases:
 *   α = 0 → pure global (no local data available)
 *   α = 1 → pure local (global track unreliable / not needed)
 */
export function computeHybridKKI(
  alpha: number,
  localBasketCost: number,
  globalBasketCost: number,
): HybridResult {
  const kki_value = alpha * localBasketCost + (1 - alpha) * globalBasketCost;
  return {
    kki_value,
    alpha,
    local_basket_cost: localBasketCost,
    global_basket_cost: globalBasketCost,
  };
}

/** Reset the internal cache — only useful in tests. */
export function _resetAlphaCache(): void {
  _alphaConfig = null;
  _currencyDefaults = null;
}
