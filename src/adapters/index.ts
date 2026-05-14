/**
 * Source adapters + orchestrator (stack.md §2.1, §3.2B).
 * Types: `src/shared/schema.ts`.
 */

export type {
  AdapterError,
  AdapterResult,
  CountryCode,
  DataSlot,
  FetchMetadata,
  FetchParams,
  FetchState,
  PriceRecord,
  SourceAdapter,
  SourceId,
  SourceTier,
} from '../shared/schema.js';
export { PriceRecordSchema } from '../shared/schema.js';

export { createEiaSteoAdapter, type EiaSteoAdapterOptions } from './eia-steo.js';
export {
  createExchangeRateHostAdapter,
  type ExchangeRateHostAdapterOptions,
} from './exchangerate-host.js';
export { createFaoFpiAdapter, type FaoFpiAdapterOptions } from './fao-fpi.js';
export {
  createFaostatAdapter,
  extractFaostatPriceRecordsFromEnvelope,
  type FaostatAdapterOptions,
} from './faostat.js';
export { createFrankfurterAdapter, type FrankfurterAdapterOptions } from './frankfurter.js';
export { createGoldpriceDevAdapter, type GoldpriceDevAdapterOptions } from './goldprice-dev.js';
export { createMetalsDevAdapter, type MetalsDevAdapterOptions } from './metals-dev.js';
export {
  type CreateDefaultOrchestratorOptions,
  createDefaultOrchestrator,
  DEFAULT_SLOT_CHAINS,
  fetchAdapterWithRetries,
  filterRecordsForSlot,
  KkiAdapterOrchestrator,
  type OrchestratorAdapters,
  recordMatchesSlot,
  recordsFromAdapterResult,
  type SlotResult,
} from './orchestrator.js';
export { createWbPinkSheetAdapter, type WbPinkSheetAdapterOptions } from './wb-pink-sheet.js';
export { createWfpVamAdapter, type WfpVamAdapterOptions } from './wfp-vam.js';

import type {
  AdapterResult,
  DataSlot,
  FetchMetadata,
  FetchParams,
  FetchState,
  SourceAdapter,
  SourceId,
  SourceTier,
} from '../shared/schema.js';

const STUB_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function stubMetadata(
  id: SourceId,
  tier: SourceTier,
  _params: FetchParams,
  start: number,
): FetchMetadata {
  return {
    source_id: id,
    tier,
    response_time_ms: Math.max(0, Date.now() - start),
    record_count: 0,
    date_range: { from: _params.target_date, to: _params.target_date },
    cache_hit: false,
  };
}

function stubFetchState(params: FetchParams): FetchState {
  const at = new Date().toISOString();
  return {
    content_hash: STUB_HASH,
    fetched_at: at,
    records: params.previous?.records ?? [],
  };
}

function adapterDefaults(
  id: SourceId,
): Pick<SourceAdapter, 'tier' | 'name' | 'covers' | 'native_cadence'> {
  const common = {
    tier: 1 as SourceTier,
    name: id,
    covers: [] as DataSlot[],
    native_cadence: 'monthly' as const,
  };
  switch (id) {
    case 'goldprice-dev':
    case 'metals-dev':
      return { ...common, tier: 3, native_cadence: 'realtime' };
    case 'frankfurter':
    case 'exchangerate-host':
      return { ...common, tier: 3, native_cadence: 'daily' };
    case 'wfp-vam':
      return { ...common, native_cadence: 'weekly' };
    default:
      return common;
  }
}

/** @deprecated Prefer `createFaoFpiAdapter` / `createDefaultOrchestrator` (§3.2B). */
export function createAdapter(id: SourceId): SourceAdapter {
  const defaults = adapterDefaults(id);
  return {
    id,
    tier: defaults.tier,
    name: defaults.name,
    covers: defaults.covers,
    native_cadence: defaults.native_cadence,
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const state = stubFetchState(params);
      return {
        ok: true,
        changed: false,
        state,
        metadata: stubMetadata(id, defaults.tier, params, start),
      };
    },
  };
}
