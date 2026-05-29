/**
 * Basket loader + country→region mapper (§3.3B.1).
 *
 * Loads regional basket JSON files from disk at module init,
 * validates them against BasketVersionSchema, and resolves
 * a country code to its typed basket via the COUNTRY_TO_REGION map.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getRegionForCountry } from '../shared/countries.js';
import type { BasketVersion, Region } from '../shared/schema.js';
import { BasketVersionSchema } from '../shared/schema.js';

export class UnknownCountryError extends Error {
  constructor(public readonly countryCode: string) {
    super(`Unknown country code: ${countryCode}`);
    this.name = 'UnknownCountryError';
  }
}

export class InvalidBasketError extends Error {
  constructor(
    public readonly basketId: string,
    cause: unknown,
  ) {
    super(`Invalid basket ${basketId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'InvalidBasketError';
  }
}

export class BasketVersionMismatchError extends Error {
  constructor(
    public readonly requested: string,
    public readonly available: string[],
  ) {
    super(`Basket version "${requested}" not found. Available: ${available.join(', ')}`);
    this.name = 'BasketVersionMismatchError';
  }
}

const BASKETS_DIR = resolve(import.meta.dir, '../../data/baskets');

/** region → methodologyVersion → BasketVersion */
type BasketRegistry = Map<Region, Map<string, BasketVersion>>;

function parseSemver(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return a.localeCompare(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! - pb[i]!;
  }
  return 0;
}

/**
 * Pick the highest basket `methodology_version` that is <= `requested`.
 * Lets METHODOLOGY_VERSION 1.1.0 use existing 1.0.0 basket files until a v1.1 basket ships.
 */
export function resolveBasketMethodologyVersion(
  available: Iterable<string>,
  requested: string,
): string | null {
  let best: string | null = null;
  for (const v of available) {
    if (compareSemver(v, requested) > 0) continue;
    if (!best || compareSemver(v, best) > 0) best = v;
  }
  return best;
}

function loadAllBaskets(dir: string): BasketRegistry {
  const registry: BasketRegistry = new Map();
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InvalidBasketError(file, 'Malformed JSON');
    }

    const result = BasketVersionSchema.safeParse(parsed);
    if (!result.success) {
      throw new InvalidBasketError(file, result.error.message);
    }
    const basket = result.data;

    let byVersion = registry.get(basket.region);
    if (!byVersion) {
      byVersion = new Map();
      registry.set(basket.region, byVersion);
    }
    byVersion.set(basket.methodology_version, basket);
  }

  return registry;
}

let _registry: BasketRegistry | null = null;

function getRegistry(): BasketRegistry {
  if (!_registry) {
    _registry = loadAllBaskets(BASKETS_DIR);
  }
  return _registry;
}

/**
 * Return the basket for a country and methodology version.
 * Throws UnknownCountryError if the country code has no region mapping.
 * Throws BasketVersionMismatchError if the version is not available.
 * Throws InvalidBasketError if a basket file is malformed.
 */
export function getBasketForCountry(
  countryCode: string,
  methodologyVersion = '1.0.0',
): BasketVersion {
  const cc = countryCode.toUpperCase();
  const region = getRegionForCountry(cc);
  if (!region) {
    throw new UnknownCountryError(cc);
  }

  const registry = getRegistry();
  const byVersion = registry.get(region);
  if (!byVersion) {
    throw new BasketVersionMismatchError(methodologyVersion, []);
  }

  const resolved =
    byVersion.get(methodologyVersion) ??
    (() => {
      const key = resolveBasketMethodologyVersion(byVersion.keys(), methodologyVersion);
      return key ? byVersion.get(key) : undefined;
    })();

  if (!resolved) {
    throw new BasketVersionMismatchError(methodologyVersion, [...byVersion.keys()]);
  }

  return resolved;
}

/**
 * Return all loaded baskets keyed by region (for diagnostics / pipeline use).
 */
export function getAllBaskets(): ReadonlyMap<Region, Map<string, BasketVersion>> {
  return getRegistry();
}

/** Reset the internal cache — only useful in tests. */
export function _resetBasketCache(): void {
  _registry = null;
}
