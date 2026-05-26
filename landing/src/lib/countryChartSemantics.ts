import type { CountryData, CountryRecord } from "../types";

export type ChartConfidence = "observed" | "high" | "medium" | "low";
export type ChartMode = "kki" | "purchasing_power";

export function confidenceForRecord(
  quality: CountryRecord["quality"],
  estimateConfidence?: string,
): ChartConfidence {
  if (
    estimateConfidence === "observed" ||
    estimateConfidence === "high" ||
    estimateConfidence === "medium" ||
    estimateConfidence === "low"
  ) {
    return estimateConfidence;
  }
  if (quality === "full") return "observed";
  if (quality === "degraded") return "medium";
  return "low";
}

export function confidenceLabel(confidence: ChartConfidence): string {
  switch (confidence) {
    case "observed":
      return "Observed item prices";
    case "high":
      return "High-confidence estimate";
    case "medium":
      return "Medium-confidence estimate";
    case "low":
      return "Low-confidence estimate";
  }
}

export function methodLabel(method: string, sourcePeriodicity?: string): string {
  switch (method) {
    case "observed":
      return "Observed local basket";
    case "cpi_chained":
      return sourcePeriodicity === "annual" ? "Annual food CPI estimate" : "Food CPI estimate";
    case "headline_cpi_chained":
      return sourcePeriodicity === "annual"
        ? "Annual headline CPI estimate"
        : "Headline CPI estimate";
    case "global_only_historical":
      return "Global-only historical estimate";
    default:
      return method.replace(/_/g, " ");
  }
}

export function recordEra(record: CountryRecord): "observed" | "estimated" | "global_only" {
  const method = record.estimate_method ?? "observed";
  if (method !== "observed") return "estimated";
  if (record.quality === "global_only") return "global_only";
  return "observed";
}

export function valueForChartMode(record: CountryRecord, mode: ChartMode): number {
  return mode === "kki" ? record.kki_value : 100 / record.kki_value;
}

export function displayCurrency(priceCurrency: string, countryCurrency: string): string {
  return priceCurrency === "LCU" ? countryCurrency : priceCurrency;
}

export function estimateNote(record: CountryRecord): string {
  const method = record.estimate_method ?? "observed";
  if (method === "observed") return "Direct monthly basket observation.";
  const base = record.base_month ? ` Anchored to ${record.base_month}.` : "";
  const periodicity =
    record.source_periodicity === "annual"
      ? "Annual CPI source; no monthly precision is implied."
      : `${record.source_periodicity ?? "Unknown"} source cadence.`;
  return `${methodLabel(method, record.source_periodicity)}. ${periodicity}${base}`;
}

export function computeRecordDiagnostics(records: Record<string, CountryRecord>) {
  const months = Object.keys(records).sort();
  const firstObservedMonth =
    months.find((m) => recordEra(records[m]!) === "observed" && records[m]!.local_basket_cost > 0) ??
    null;
  const lastEstimatedMonthBeforeObserved = firstObservedMonth
    ? [...months]
        .filter((m) => m < firstObservedMonth && recordEra(records[m]!) === "estimated")
        .pop() ?? null
    : null;
  const observed = firstObservedMonth ? records[firstObservedMonth] : undefined;
  const estimated = lastEstimatedMonthBeforeObserved
    ? records[lastEstimatedMonthBeforeObserved]
    : undefined;
  const spliceGapPct =
    observed && estimated && estimated.kki_value > 0
      ? Number((((observed.kki_value - estimated.kki_value) / estimated.kki_value) * 100).toFixed(1))
      : null;
  const methodCounts = new Map<string, number>();
  let hasAnnualCpiHistory = false;
  for (const m of months) {
    const rec = records[m]!;
    const method = rec.estimate_method ?? "observed";
    if (method !== "observed") methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
    if (
      rec.source_periodicity === "annual" &&
      (method === "cpi_chained" || method === "headline_cpi_chained")
    ) {
      hasAnnualCpiHistory = true;
    }
  }
  const dominantEstimateMethod =
    [...methodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    first_observed_month: firstObservedMonth,
    last_estimated_month_before_observed: lastEstimatedMonthBeforeObserved,
    splice_gap_pct: spliceGapPct,
    dominant_estimate_method: dominantEstimateMethod,
    has_annual_cpi_history: hasAnnualCpiHistory,
  };
}

export function countryMethodologySummary(country: CountryData): string {
  const diagnostics = country.diagnostics ?? computeRecordDiagnostics(country.records);
  const parts: string[] = [];
  if (diagnostics.has_annual_cpi_history) {
    parts.push("Historical orange segments use annual CPI, so steps represent annual estimates.");
  }
  if (diagnostics.first_observed_month) {
    parts.push(`Observed local basket data begins in ${diagnostics.first_observed_month}.`);
  }
  if (diagnostics.splice_gap_pct !== null && Math.abs(diagnostics.splice_gap_pct) >= 15) {
    parts.push(
      `The splice gap is ${diagnostics.splice_gap_pct.toFixed(1)}%, a methodology diagnostic rather than a monthly shock.`,
    );
  }
  return parts.join(" ");
}
