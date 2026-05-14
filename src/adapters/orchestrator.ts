/**
 * Per-slot fallback orchestration (stack.md §5.1–5.2, §2.3 retries).
 */
import type {
  AdapterError,
  AdapterResult,
  DataSlot,
  FetchParams,
  PriceRecord,
  SourceAdapter,
  SourceId,
} from '../shared/schema.js';
import { createEiaSteoAdapter } from './eia-steo.js';
import { createExchangeRateHostAdapter } from './exchangerate-host.js';
import { createFaoFpiAdapter } from './fao-fpi.js';
import { createFaostatAdapter } from './faostat.js';
import { createFrankfurterAdapter } from './frankfurter.js';
import { createGoldpriceDevAdapter } from './goldprice-dev.js';
import { createMetalsDevAdapter } from './metals-dev.js';
import { adapterErr } from './utils.js';
import { createWbPinkSheetAdapter } from './wb-pink-sheet.js';
import { createWfpVamAdapter } from './wfp-vam.js';

export type SlotResult =
  | {
      ok: true;
      slot: DataSlot;
      records: PriceRecord[];
      source_id: SourceId;
      changed: boolean;
      errors_attempted: AdapterError[];
    }
  | {
      ok: false;
      slot: DataSlot;
      reason: 'slot-unavailable';
      errors: AdapterError[];
    };

/** Default cascade order per stack.md §5.1 — FAOSTAT first for scalable bulk pipelines; WFP enhances when credentials exist. */
export const DEFAULT_SLOT_CHAINS: Record<DataSlot, SourceId[]> = {
  global_cereals_oils_sugar: ['fao-fpi', 'wb-pink-sheet'],
  local_market_prices: ['faostat', 'wfp-vam'],
  gold_spot: ['goldprice-dev', 'metals-dev'],
  crude_oil_energy: ['wb-pink-sheet', 'eia-steo'],
  fx_display: ['frankfurter', 'exchangerate-host'],
};

export function recordsFromAdapterResult(r: AdapterResult): PriceRecord[] {
  if (!r.ok) return [];
  return r.changed ? r.records : r.state.records;
}

export function recordMatchesSlot(slot: DataSlot, rec: PriceRecord): boolean {
  switch (slot) {
    case 'global_cereals_oils_sugar':
      return (
        rec.commodity.startsWith('fao_fpi_') ||
        rec.commodity.startsWith('maize_') ||
        rec.commodity.startsWith('rice_') ||
        rec.commodity.startsWith('sugar_')
      );
    case 'gold_spot':
      return rec.commodity === 'gold_xau_usd' || rec.commodity.startsWith('gold_lbma');
    case 'crude_oil_energy':
      return rec.commodity === 'brent_crude_usd';
    case 'local_market_prices':
      return Boolean(rec.country_code);
    case 'fx_display':
      return rec.commodity.startsWith('fx_');
    default:
      return false;
  }
}

export function filterRecordsForSlot(slot: DataSlot, records: PriceRecord[]): PriceRecord[] {
  const matched = records.filter((r) => recordMatchesSlot(slot, r));
  if (slot === 'gold_spot') {
    const xau = matched.find((r) => r.commodity === 'gold_xau_usd');
    if (xau) return [xau];
    const first = matched[0];
    return first ? [first] : [];
  }
  return matched;
}

async function sleep(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

export async function fetchAdapterWithRetries(
  adapter: SourceAdapter,
  params: FetchParams,
  retryBackoffMs: readonly [number, number],
): Promise<AdapterResult> {
  let last: AdapterResult = {
    ok: false,
    error: adapterErr(adapter.id, {
      code: 'NETWORK_ERROR',
      message: 'no attempt',
      retryable: false,
    }),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    last = await adapter.fetch(params);
    if (last.ok) return last;
    if (!last.error.retryable || attempt >= 2) return last;
    await sleep(attempt === 0 ? retryBackoffMs[0] : retryBackoffMs[1]);
  }
  return last;
}

export type OrchestratorAdapters = Partial<Record<SourceId, SourceAdapter | undefined>>;

export class KkiAdapterOrchestrator {
  private readonly memo = new Map<string, Promise<AdapterResult>>();

  constructor(
    private readonly adapters: OrchestratorAdapters,
    private readonly chains: Record<DataSlot, SourceId[]> = DEFAULT_SLOT_CHAINS,
    private readonly retryBackoffMs: readonly [number, number] = [5000, 30_000],
  ) {}

  private memoKey(adapter: SourceAdapter, params: FetchParams): string {
    const cc = (params.countries ?? []).join(',');
    const lcuKeys = params.lcu_per_usd_by_country
      ? Object.keys(params.lcu_per_usd_by_country).sort().join('|')
      : '';
    const wb = params.wb_date_range ?? '';
    return `${adapter.id}:${params.target_date}:${cc}:${lcuKeys}:${wb}:${params.timeout_ms ?? ''}`;
  }

  private runAdapter(adapter: SourceAdapter, params: FetchParams): Promise<AdapterResult> {
    const k = this.memoKey(adapter, params);
    let p = this.memo.get(k);
    if (!p) {
      p = fetchAdapterWithRetries(adapter, params, this.retryBackoffMs);
      this.memo.set(k, p);
    }
    return p;
  }

  async fetchSlot(params: FetchParams, slot: DataSlot): Promise<SlotResult> {
    const chain = this.chains[slot] ?? [];
    const errorsAttempted: AdapterError[] = [];

    for (const sid of chain) {
      const adapter = this.adapters[sid];
      if (!adapter) continue;

      const res = await this.runAdapter(adapter, params);
      if (!res.ok) {
        errorsAttempted.push(res.error);
        continue;
      }
      const recs = filterRecordsForSlot(slot, recordsFromAdapterResult(res));
      if (recs.length > 0) {
        return {
          ok: true,
          slot,
          records: recs,
          source_id: adapter.id,
          changed: res.changed,
          errors_attempted: errorsAttempted,
        };
      }
    }

    return {
      ok: false,
      slot,
      reason: 'slot-unavailable',
      errors: errorsAttempted,
    };
  }

  async fetchAllSlots(params: FetchParams): Promise<Map<DataSlot, SlotResult>> {
    const slots: DataSlot[] = [
      'global_cereals_oils_sugar',
      'local_market_prices',
      'gold_spot',
      'crude_oil_energy',
      'fx_display',
    ];
    const results = await Promise.all(slots.map((s) => this.fetchSlot(params, s)));
    const out = new Map<DataSlot, SlotResult>();
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      const r = results[i];
      if (sl !== undefined && r !== undefined) out.set(sl, r);
    }
    return out;
  }
}

export type CreateDefaultOrchestratorOptions = {
  retryBackoffMs?: readonly [number, number];
  adapters?: OrchestratorAdapters;
  chains?: Record<DataSlot, SourceId[]>;
};

/** Wired with default adapter factories (reads env for URLs / keys). */
export function createDefaultOrchestrator(
  options: CreateDefaultOrchestratorOptions = {},
): KkiAdapterOrchestrator {
  const adapters: OrchestratorAdapters = {
    'fao-fpi': createFaoFpiAdapter(),
    faostat: createFaostatAdapter(),
    'wfp-vam': createWfpVamAdapter(),
    'wb-pink-sheet': createWbPinkSheetAdapter(),
    'goldprice-dev': createGoldpriceDevAdapter(),
    'metals-dev': createMetalsDevAdapter(),
    frankfurter: createFrankfurterAdapter(),
    'eia-steo': createEiaSteoAdapter(),
    'exchangerate-host': createExchangeRateHostAdapter(),
    ...options.adapters,
  };
  return new KkiAdapterOrchestrator(
    adapters,
    options.chains ?? DEFAULT_SLOT_CHAINS,
    options.retryBackoffMs ?? [5000, 30_000],
  );
}
