import type {
  EstimateConfidence,
  EstimateMethod,
  IndexRecord,
  SourcePeriodicity,
} from '../shared/schema.js';

export interface CpiChainInput {
  readonly base: IndexRecord;
  readonly existingTarget?: IndexRecord;
  readonly targetMonth: string;
  readonly targetCpi: number;
  readonly baseCpi: number;
  readonly method: Extract<EstimateMethod, 'cpi_chained' | 'headline_cpi_chained'>;
  readonly sourcePeriodicity: SourcePeriodicity;
  readonly sourceIds: readonly string[];
  readonly computedAt?: string;
}

export interface PurchasingPowerResult {
  readonly originKk: number;
  readonly equivalentAmount: number;
  readonly ratio: number;
}

function assertPositive(name: string, n: number): void {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}

async function computeRecordHash(data: Omit<IndexRecord, 'record_hash'>): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function confidenceForChain(
  method: Extract<EstimateMethod, 'cpi_chained' | 'headline_cpi_chained'>,
  sourcePeriodicity: SourcePeriodicity,
): EstimateConfidence {
  if (method === 'cpi_chained' && sourcePeriodicity === 'monthly') return 'high';
  if (method === 'cpi_chained') return 'medium';
  if (method === 'headline_cpi_chained' && sourcePeriodicity === 'monthly') return 'medium';
  return 'low';
}

export function chainKkiValue(baseValue: number, targetCpi: number, baseCpi: number): number {
  assertPositive('baseValue', baseValue);
  assertPositive('targetCpi', targetCpi);
  assertPositive('baseCpi', baseCpi);
  return baseValue * (targetCpi / baseCpi);
}

function lcuPerUsdFromRecord(record: IndexRecord): number | null {
  if (!Number.isFinite(record.kki_value) || !Number.isFinite(record.kki_value_usd)) return null;
  if (record.kki_value <= 0 || record.kki_value_usd <= 0) return null;
  if (record.currency !== 'USD' && Math.abs(record.kki_value - record.kki_value_usd) < 0.001) {
    return null;
  }
  return record.kki_value / record.kki_value_usd;
}

function targetGlobalBasketCost(
  base: IndexRecord,
  existingTarget: IndexRecord | undefined,
): number {
  if (
    existingTarget &&
    Number.isFinite(existingTarget.global_basket_cost) &&
    existingTarget.global_basket_cost > 0
  ) {
    return existingTarget.global_basket_cost;
  }
  return base.global_basket_cost;
}

export async function chainObservedRecordWithCpi(input: CpiChainInput): Promise<IndexRecord> {
  const {
    base,
    existingTarget,
    targetMonth,
    targetCpi,
    baseCpi,
    method,
    sourcePeriodicity,
    sourceIds,
  } = input;
  const ratio = targetCpi / baseCpi;
  assertPositive('ratio', ratio);
  const localBasketCost = Number((base.local_basket_cost * ratio).toFixed(3));
  const globalBasketCost = Number(targetGlobalBasketCost(base, existingTarget).toFixed(3));
  const alpha = base.alpha;
  const kkiValue = Number((alpha * localBasketCost + (1 - alpha) * globalBasketCost).toFixed(3));
  const targetFx = existingTarget ? lcuPerUsdFromRecord(existingTarget) : null;
  const baseFx = lcuPerUsdFromRecord(base);
  const fx = targetFx ?? baseFx;
  const kkiValueUsd = Number(
    (fx && fx > 0 ? kkiValue / fx : base.kki_value_usd * ratio).toFixed(3),
  );

  const partial: Omit<IndexRecord, 'record_hash'> = {
    ...base,
    month: targetMonth.slice(0, 7),
    kki_value: kkiValue,
    kki_value_usd: kkiValueUsd,
    local_basket_cost: localBasketCost,
    global_basket_cost: globalBasketCost,
    computed_at: input.computedAt ?? new Date().toISOString(),
    estimate_method: method,
    estimate_confidence: confidenceForChain(method, sourcePeriodicity),
    source_periodicity: sourcePeriodicity,
    base_month: base.month,
    estimate_source_ids: [...sourceIds],
  };

  return {
    ...partial,
    record_hash: await computeRecordHash(partial),
  };
}

export function calculatePurchasingPowerEquivalent(args: {
  amount: number;
  originKkiValue: number;
  comparisonKkiValue: number;
}): PurchasingPowerResult {
  const { amount, originKkiValue, comparisonKkiValue } = args;
  assertPositive('amount', amount);
  assertPositive('originKkiValue', originKkiValue);
  assertPositive('comparisonKkiValue', comparisonKkiValue);

  const originKk = amount / originKkiValue;
  return {
    originKk,
    equivalentAmount: originKk * comparisonKkiValue,
    ratio: comparisonKkiValue / originKkiValue,
  };
}
