import type {
  HistoricalCpiEnvelope,
  HistoricalCpiObservation,
} from '../../adapters/historical-cpi.js';
import { findCpiObservation, observationsForCountry } from '../../adapters/historical-cpi.js';
import { chainObservedRecordWithCpi } from '../../engine/historical.js';
import type { IndexRecord, SourcePeriodicity } from '../../shared/schema.js';
import { expandInclusiveMonths } from './month-utils.js';

export interface HistoricalBackfillInput {
  readonly countryCode: string;
  readonly observedByMonth: ReadonlyMap<string, IndexRecord>;
  readonly targetMonths: readonly string[];
  readonly cpiEnvelope: HistoricalCpiEnvelope | null;
  readonly computedAt?: string;
}

export interface HistoricalBackfillResult {
  readonly records: IndexRecord[];
  readonly chainedCount: number;
  readonly replacedCount: number;
  readonly skippedCount: number;
}

export function hasLocalKkiData(record: IndexRecord): boolean {
  return (
    record.estimate_method === 'observed' &&
    (record.local_basket_cost > 0 || record.quality !== 'global_only')
  );
}

function canChainFromBase(
  record: IndexRecord,
  foodObs: readonly HistoricalCpiObservation[],
  headlineObs: readonly HistoricalCpiObservation[],
): boolean {
  return (
    findCpiObservation(foodObs, record.month) !== null ||
    findCpiObservation(headlineObs, record.month) !== null
  );
}

function pickObservedBase(
  records: readonly IndexRecord[],
  foodObs: readonly HistoricalCpiObservation[],
  headlineObs: readonly HistoricalCpiObservation[],
): IndexRecord | null {
  const withLocal = records.filter(hasLocalKkiData);
  if (withLocal.length > 0) {
    return (
      [...withLocal]
        .sort((a, b) => b.month.localeCompare(a.month))
        .find((r) => canChainFromBase(r, foodObs, headlineObs)) ?? null
    );
  }
  const observed = records.filter((r) => r.estimate_method === 'observed');
  if (observed.length === 0) return null;
  return (
    [...observed]
      .sort((a, b) => b.month.localeCompare(a.month))
      .find((r) => canChainFromBase(r, foodObs, headlineObs)) ?? null
  );
}

export function firstLocalMonth(records: readonly IndexRecord[]): string | null {
  const months = records.filter(hasLocalKkiData).map((r) => r.month);
  if (months.length === 0) return null;
  return [...months].sort()[0] ?? null;
}

export function shouldCpiReplaceMonth(
  month: string,
  existing: IndexRecord | undefined,
  firstLocal: string | null,
): boolean {
  if (!existing) return true;
  if (hasLocalKkiData(existing)) return false;
  if (firstLocal !== null && month >= firstLocal) return false;
  return true;
}

function sourcePeriodicityFromObservation(obs: HistoricalCpiObservation): SourcePeriodicity {
  return obs.periodicity === 'monthly' ? 'monthly' : 'annual';
}

async function chainMonthFromCpi(args: {
  base: IndexRecord;
  existingTarget?: IndexRecord;
  targetMonth: string;
  foodObs: HistoricalCpiObservation[];
  headlineObs: HistoricalCpiObservation[];
  computedAt?: string;
}): Promise<IndexRecord | null> {
  const { base, existingTarget, targetMonth, foodObs, headlineObs, computedAt } = args;
  const baseMonth = base.month;
  const foodTarget = findCpiObservation(foodObs, targetMonth);
  const foodBase = findCpiObservation(foodObs, baseMonth);
  if (foodTarget && foodBase) {
    return chainObservedRecordWithCpi({
      base,
      existingTarget,
      targetMonth,
      targetCpi: foodTarget.value,
      baseCpi: foodBase.value,
      method: 'cpi_chained',
      sourcePeriodicity: sourcePeriodicityFromObservation(foodTarget),
      sourceIds: [foodTarget.source_id],
      computedAt,
    });
  }

  const headlineTarget = findCpiObservation(headlineObs, targetMonth);
  const headlineBase = findCpiObservation(headlineObs, baseMonth);
  if (headlineTarget && headlineBase) {
    return chainObservedRecordWithCpi({
      base,
      existingTarget,
      targetMonth,
      targetCpi: headlineTarget.value,
      baseCpi: headlineBase.value,
      method: 'headline_cpi_chained',
      sourcePeriodicity: sourcePeriodicityFromObservation(headlineTarget),
      sourceIds: [headlineTarget.source_id],
      computedAt,
    });
  }

  return null;
}

export async function backfillHistoricalRecords(
  input: HistoricalBackfillInput,
): Promise<HistoricalBackfillResult> {
  const cc = input.countryCode.toUpperCase();
  const observedRecords = [...input.observedByMonth.values()];
  if (!input.cpiEnvelope) {
    return {
      records: observedRecords,
      chainedCount: 0,
      replacedCount: 0,
      skippedCount: input.targetMonths.length,
    };
  }

  const foodObs = observationsForCountry(input.cpiEnvelope, cc, 'food_cpi');
  const headlineObs = observationsForCountry(input.cpiEnvelope, cc, 'headline_cpi');
  if (foodObs.length === 0 && headlineObs.length === 0) {
    return {
      records: observedRecords,
      chainedCount: 0,
      replacedCount: 0,
      skippedCount: input.targetMonths.length,
    };
  }
  const base = pickObservedBase(observedRecords, foodObs, headlineObs);
  if (!base) {
    return {
      records: observedRecords,
      chainedCount: 0,
      replacedCount: 0,
      skippedCount: input.targetMonths.length,
    };
  }

  const firstLocal = firstLocalMonth(observedRecords);
  const merged = new Map<string, IndexRecord>();
  for (const rec of observedRecords) merged.set(rec.month, rec);

  let chainedCount = 0;
  let replacedCount = 0;
  let skippedCount = 0;

  for (const month of input.targetMonths) {
    const existing = merged.get(month);
    if (!shouldCpiReplaceMonth(month, existing, firstLocal)) {
      skippedCount += 1;
      continue;
    }

    const chained = await chainMonthFromCpi({
      base,
      existingTarget: existing,
      targetMonth: month,
      foodObs,
      headlineObs,
      computedAt: input.computedAt,
    });
    if (chained) {
      if (existing) replacedCount += 1;
      else chainedCount += 1;
      merged.set(month, chained);
    } else {
      skippedCount += 1;
    }
  }

  const records = [...merged.values()].sort((a, b) => a.month.localeCompare(b.month));
  return { records, chainedCount, replacedCount, skippedCount };
}

export function historicalTargetMonths(fromYm: string, toYm: string): string[] {
  return expandInclusiveMonths(fromYm.slice(0, 7), toYm.slice(0, 7));
}
