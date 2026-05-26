import type { CountryRecord } from "../types";

export interface ResolvedKkiPoint {
  month: string;
  record: CountryRecord;
  method: string;
  confidence: string;
  sourcePeriodicity: string;
  note: string;
}

export interface PurchasingPowerCalculation {
  origin: ResolvedKkiPoint;
  comparison: ResolvedKkiPoint;
  kkEquivalent: number;
  equivalentAmount: number;
  ratio: number;
}

function normalizeMonth(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed.slice(0, 7);
}

function averageKkiForYear(records: Record<string, CountryRecord>, year: string): number | null {
  const inYear = Object.entries(records).filter(([m]) => m.startsWith(`${year}-`));
  if (inYear.length === 0) return null;
  const sum = inYear.reduce((acc, [, rec]) => acc + rec.kki_value, 0);
  return sum / inYear.length;
}

function annualAveragePoint(
  records: Record<string, CountryRecord>,
  year: string,
): ResolvedKkiPoint | null {
  const avg = averageKkiForYear(records, year);
  if (avg == null || avg <= 0) return null;

  const inYear = Object.entries(records).filter(([m]) => m.startsWith(`${year}-`));
  const representative = inYear[0]?.[1];
  if (!representative) return null;

  return {
    month: `${year}-AVG`,
    record: {
      ...representative,
      kki_value: avg,
      kki_value_usd: (representative.kki_value_usd / representative.kki_value) * avg,
      local_basket_cost: (representative.local_basket_cost / representative.kki_value) * avg,
      global_basket_cost: (representative.global_basket_cost / representative.kki_value) * avg,
      source_periodicity: "annual",
    },
    method: representative.estimate_method ?? "observed",
    confidence: representative.estimate_confidence ?? "observed",
    sourcePeriodicity: "annual",
    note: `Annual average KKI for ${year}.`,
  };
}

function observedPoint(records: Record<string, CountryRecord>, month: string): ResolvedKkiPoint | null {
  const normalized = normalizeMonth(month);
  const exact = records[normalized];
  if (exact) {
    return {
      month: normalized,
      record: exact,
      method: exact.estimate_method ?? "observed",
      confidence: exact.estimate_confidence ?? "observed",
      sourcePeriodicity: exact.source_periodicity ?? "monthly",
      note:
        exact.estimate_method && exact.estimate_method !== "observed"
          ? `Archive ${exact.estimate_method.replace(/_/g, " ")} estimate.`
          : "Observed KKI archive value.",
    };
  }

  const nearest = Object.keys(records)
    .sort()
    .filter((m) => m <= normalized)
    .pop();
  if (!nearest) return null;

  const rec = records[nearest];
  if (!rec) return null;
  return {
    month: nearest,
    record: rec,
    method: rec.estimate_method ?? "observed",
    confidence: rec.estimate_confidence ?? "observed",
    sourcePeriodicity: rec.source_periodicity ?? "monthly",
    note: "Nearest earlier KKI archive value.",
  };
}

function cpiChainedYearPoint(
  records: Record<string, CountryRecord>,
  year: string,
): ResolvedKkiPoint | null {
  const chained = Object.entries(records).find(
    ([m, rec]) =>
      m.startsWith(`${year}-`) &&
      (rec.estimate_method === "cpi_chained" || rec.estimate_method === "headline_cpi_chained"),
  );
  if (!chained) return null;
  const [, record] = chained;
  return {
    month: `${year}-AVG`,
    record,
    method: record.estimate_method ?? "headline_cpi_chained",
    confidence: record.estimate_confidence ?? "low",
    sourcePeriodicity: record.source_periodicity ?? "annual",
    note: `CPI-chained KKI estimate for ${year}.`,
  };
}

export function resolveKkiPoint(args: {
  countryCode: string;
  records: Record<string, CountryRecord>;
  month: string;
}): ResolvedKkiPoint | null {
  const normalized = normalizeMonth(args.month);
  if (/^\d{4}$/.test(normalized)) {
    const avg = annualAveragePoint(args.records, normalized);
    if (avg) return avg;
    return cpiChainedYearPoint(args.records, normalized);
  }

  return observedPoint(args.records, normalized);
}

export function calculatePurchasingPower(args: {
  amount: number;
  countryCode: string;
  records: Record<string, CountryRecord>;
  originMonth: string;
  comparisonMonth: string;
}): PurchasingPowerCalculation | null {
  if (!Number.isFinite(args.amount) || args.amount <= 0) return null;
  const origin = resolveKkiPoint({
    countryCode: args.countryCode,
    records: args.records,
    month: args.originMonth,
  });
  const comparison = resolveKkiPoint({
    countryCode: args.countryCode,
    records: args.records,
    month: args.comparisonMonth,
  });
  if (!origin || !comparison) return null;

  const kkEquivalent = args.amount / origin.record.kki_value;
  return {
    origin,
    comparison,
    kkEquivalent,
    equivalentAmount: kkEquivalent * comparison.record.kki_value,
    ratio: comparison.record.kki_value / origin.record.kki_value,
  };
}
