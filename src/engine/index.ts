/**
 * KKI calculation engine — barrel exports (§3.3B).
 */

export type {
  IndexRecord,
  QualityLevel,
  SourceContribution,
} from '../shared/schema.js';

export {
  BasketVersionMismatchError,
  getAllBaskets,
  getBasketForCountry,
  InvalidBasketError,
  UnknownCountryError,
} from './basket.js';
export type { CalculateKKIInput, KKIResult } from './calculate.js';
export { calculateKKI } from './calculate.js';
export type { CaloricContribution } from './calories.js';
export { computeCaloricContributions } from './calories.js';
export type { GlobalBasketResult } from './global-track.js';
export {
  BASE_VALUES,
  COMPOSITE_SCALE_USD,
  computeGlobalBasketCost,
  GLOBAL_WEIGHTS,
} from './global-track.js';
export type { HybridResult } from './hybrid.js';
export { computeHybridKKI, getAlpha } from './hybrid.js';
