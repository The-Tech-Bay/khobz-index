import { useParams, Link, Navigate } from "react-router";
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { getCountry, getAvailableMonths, formatMonth } from "../data";
import { useFixtureDataRequired } from "../data/FixtureProvider";
import {
  confidenceForRecord,
  confidenceLabel,
  countryMethodologySummary,
  displayCurrency,
  estimateNote,
  methodLabel,
  valueForChartMode,
  type ChartConfidence,
  type ChartMode,
} from "../lib/countryChartSemantics";
import {
  basketSectionTitle,
  coverageSummaryText,
  formatWeightPct,
  getLocalCoverage,
  qualityLabel,
  usMoroccoSanityNote,
} from "../lib/localCoverage";
import styles from "./CountryPage.module.css";

const REGION_NAMES: Record<string, string> = {
  mena: "MENA",
  south_asia: "South Asia",
  east_southern_africa: "East & Southern Africa",
  west_africa: "West Africa",
  east_asia: "East Asia",
  latin_america: "Latin America",
  oecd: "OECD",
};

const BASKET_NICKNAMES: Record<string, string> = {
  mena: "Khobz basket",
  south_asia: "Atta basket",
  east_southern_africa: "Sadza / Ugali basket",
  west_africa: "Riz basket",
  east_asia: "Mihan basket",
  latin_america: "Tortilla basket",
  oecd: "Loaf basket",
};

function QualityBadge({ quality }: { quality: string }) {
  const cls = quality === "full" ? styles.badgeFull : quality === "degraded" ? styles.badgeDegraded : styles.badgeGlobalOnly;
  return <span className={cls}>{qualityLabel(quality)}</span>;
}

type Timeframe = "all" | "1y" | "5y" | "10y" | "since1990";

interface ChartPoint {
  month: string;
  label: string;
  value: number;
  observed: number | null;
  high: number | null;
  medium: number | null;
  low: number | null;
  quality: "full" | "degraded" | "global_only";
  method: string;
  confidence: ChartConfidence;
  sourcePeriodicity: string;
  baseMonth: string | null;
  sourceIds: string[];
}

const CONFIDENCE_COLORS = {
  observed: "#3E9470",
  high: "#56AB87",
  medium: "#E5AB4F",
  low: "#C57A1F",
} as const;

function filterMonthsByTimeframe(months: string[], timeframe: Timeframe): string[] {
  if (timeframe === "all") return months;
  if (timeframe === "since1990") return months.filter((m) => m >= "1990-01");
  const last = months[months.length - 1];
  if (!last) return months;
  const years = timeframe === "1y" ? 1 : timeframe === "5y" ? 5 : 10;
  const startYear = Number(last.slice(0, 4)) - years;
  const startMonth = `${startYear}-${last.slice(5, 7)}`;
  return months.filter((m) => m >= startMonth);
}

function spliceGapLabel(gapPct: number | null | undefined): string | null {
  if (gapPct == null || Math.abs(gapPct) < 15) return null;
  const direction = gapPct > 0 ? "higher" : "lower";
  return `${Math.abs(gapPct).toFixed(1)}% ${direction} at observed-data boundary`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload.find((p) => p.payload)?.payload;
  if (!point) return null;
  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipTitle}>{label}</div>
      <div className={styles.tooltipValue}>{point.value.toFixed(2)}</div>
      <div className={styles.tooltipMeta}>
        {methodLabel(point.method, point.sourcePeriodicity)} · {confidenceLabel(point.confidence)}
      </div>
      {point.baseMonth && <div className={styles.tooltipMeta}>Anchor month: {point.baseMonth}</div>}
      {point.sourceIds.length > 0 && (
        <div className={styles.tooltipMeta}>Source: {point.sourceIds.join(", ")}</div>
      )}
      <div className={styles.tooltipMeta}>{estimateNote({
        kki_value: point.value,
        kki_value_usd: point.value,
        local_basket_cost: point.value,
        global_basket_cost: point.value,
        quality: point.quality,
        estimate_method: point.method,
        estimate_confidence: point.confidence,
        source_periodicity: point.sourcePeriodicity,
        base_month: point.baseMonth,
        estimate_source_ids: point.sourceIds,
      })}</div>
      <div className={styles.tooltipMeta}>Quality: {point.quality}</div>
    </div>
  );
}

export function CountryPage() {
  const fixture = useFixtureDataRequired();
  const { code } = useParams<{ code: string }>();
  const country = code ? getCountry(fixture, code) : undefined;
  const [chartMode, setChartMode] = useState<ChartMode>("kki");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  const months = getAvailableMonths(fixture);
  const chartMonths = useMemo(() => filterMonthsByTimeframe(months, timeframe), [months, timeframe]);
  const chartData = useMemo(
    () => {
      if (!country) return [];
      return chartMonths
        .map((m) => {
          const rec = country.records[m];
          if (!rec) return null;
          const confidence = confidenceForRecord(rec.quality, rec.estimate_confidence);
          const value = valueForChartMode(rec, chartMode);
          return {
            month: m,
            label: formatMonth(m),
            value,
            observed: confidence === "observed" ? value : null,
            high: confidence === "high" ? value : null,
            medium: confidence === "medium" ? value : null,
            low: confidence === "low" ? value : null,
            quality: rec.quality,
            method: rec.estimate_method ?? "observed",
            confidence,
            sourcePeriodicity: rec.source_periodicity ?? "monthly",
            baseMonth: rec.base_month ?? null,
            sourceIds: rec.estimate_source_ids ?? [],
          } satisfies ChartPoint;
        })
        .filter((p): p is ChartPoint => p !== null);
    },
    [chartMonths, chartMode, country],
  );

  if (!country) {
    return <Navigate to="/" replace />;
  }

  const latestMonth = months[months.length - 1]!;
  const latestRecord = country.records[latestMonth];
  const snapshot = country.latest_snapshot;
  const diagnostics = country.diagnostics;
  const methodologySummary = countryMethodologySummary(country);
  const activeConfidences = (["observed", "high", "medium", "low"] as const).filter((key) =>
    chartData.some((p) => p[key] !== null),
  );
  const spliceLabel = spliceGapLabel(diagnostics?.splice_gap_pct);
  const localCoverage = getLocalCoverage(country);
  const sanityNote = code ? usMoroccoSanityNote(code) : null;
  const basketTitle = latestRecord ? basketSectionTitle(latestRecord.quality) : "Latest basket breakdown";

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{country.name} — Khobz Index</title>
        <meta
          name="description"
          content={`Cost of 1 KK (one day of staple food) in ${country.name}: ${latestRecord?.kki_value.toFixed(2)} ${country.currency}`}
        />
      </Helmet>

      <div className={styles.breadcrumb}>
        <Link to="/" className={styles.backLink}>
          ← Back to map
        </Link>
      </div>

      <header className={styles.header}>
        <div>
          <h1 className={styles.countryName}>{country.name}</h1>
          <p className={styles.regionLabel}>
            {REGION_NAMES[country.region] ?? country.region} · {BASKET_NICKNAMES[country.region] ?? country.basket_version}
          </p>
        </div>
        {latestRecord && (
          <div className={styles.heroStat}>
            <span className={styles.heroValue}>
              {latestRecord.kki_value.toFixed(2)} {country.currency}
            </span>
            <span className={styles.heroLabel}>per KK</span>
            <span className={styles.heroUsd}>
              ≈ ${latestRecord.kki_value_usd.toFixed(2)} USD
            </span>
          </div>
        )}
      </header>

      {latestRecord && (
        <div className={styles.metaRow}>
          <QualityBadge quality={latestRecord.quality} />
          <span className={styles.metaItem}>
            α = {country.alpha} ({country.market_type.replace(/_/g, " ")})
          </span>
          <span className={styles.metaItem}>
            {formatMonth(latestMonth)}
          </span>
        </div>
      )}

      {latestRecord && (
        <div className={styles.coverageCallout} data-quality={latestRecord.quality}>
          <strong>Local basket coverage:</strong> {coverageSummaryText(localCoverage)}
          {latestRecord.quality === "global_only" && latestRecord.local_basket_cost === 0 && (
            <span className={styles.coverageSub}>
              {" "}
              The local leg is 0 because coverage failed the threshold — not because food is free.
            </span>
          )}
        </div>
      )}

      {sanityNote && (
        <div className={styles.sanityNote}>
          <strong>Validation note:</strong> {sanityNote}
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.chartHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Trend ({chartData.length} months)</h2>
            <p className={styles.chartSubtitle}>
              {chartMode === "kki"
                ? `Local-currency cost of 1 KK in ${country.currency}.`
                : `KK purchasable by 100 ${country.currency}; higher means stronger purchasing power.`}
            </p>
          </div>
          <div className={styles.chartControls}>
            <div className={styles.segmented} role="group" aria-label="Chart display mode">
              <button
                type="button"
                className={chartMode === "kki" ? styles.segmentActive : styles.segment}
                onClick={() => setChartMode("kki")}
              >
                KKI cost
              </button>
              <button
                type="button"
                className={chartMode === "purchasing_power" ? styles.segmentActive : styles.segment}
                onClick={() => setChartMode("purchasing_power")}
              >
                Purchasing power
              </button>
            </div>
            <div className={styles.segmented} role="group" aria-label="Chart timeframe">
              {(["1y", "5y", "10y", "since1990", "all"] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={timeframe === tf ? styles.segmentActive : styles.segment}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf === "since1990" ? "1990+" : tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        {methodologySummary && (
          <div className={styles.methodologyNote}>
            <strong>Reading the chart:</strong> {methodologySummary}
          </div>
        )}
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--fg-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-default)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--fg-muted)" }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<ChartTooltip />} />
              {diagnostics?.first_observed_month &&
                chartData.some((p) => p.month === diagnostics.first_observed_month) && (
                  <ReferenceLine
                    x={formatMonth(diagnostics.first_observed_month)}
                    stroke="var(--fg-muted)"
                    strokeDasharray="4 4"
                    label={{
                      value: "Observed local basket begins",
                      position: "insideTopRight",
                      fill: "var(--fg-muted)",
                      fontSize: 11,
                    }}
                  />
                )}
              {activeConfidences.map((key) => (
                <Line
                  key={key}
                  type={key === "observed" ? "monotone" : "stepAfter"}
                  dataKey={key}
                  name={confidenceLabel(key)}
                  stroke={CONFIDENCE_COLORS[key]}
                  strokeWidth={2.5}
                  dot={key === "observed" ? { r: 3, fill: CONFIDENCE_COLORS[key] } : false}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {spliceLabel && (
          <div className={styles.spliceCallout}>
            <strong>Splice diagnostic:</strong> {spliceLabel}. This compares the last CPI estimate
            with the first observed basket point; it is not necessarily a real monthly price shock.
          </div>
        )}
        <div className={styles.legendRow}>
          {activeConfidences.map((key) => (
            <span key={key} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: CONFIDENCE_COLORS[key] }} />
              {confidenceLabel(key)}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{basketTitle}</h2>
        <p className={styles.sectionNote}>
          Commodity rows describe the latest line-item data available for this month. Historical CPI
          estimates use inflation proxies and do not imply historical item-level prices.
          {localCoverage.missing_high_weight.length > 0 && (
            <>
              {" "}
              Missing high-weight items:{" "}
              {localCoverage.missing_high_weight
                .slice(0, 3)
                .map((m) => `${m.commodity_name} (${formatWeightPct(m.weight)})`)
                .join(", ")}
              .
            </>
          )}
        </p>
        {latestRecord && (
          <div className={styles.splitGrid}>
            <div className={styles.splitItem}>
              <span className={styles.globalLabel}>Local basket leg</span>
              <span className={styles.globalValue}>
                {latestRecord.local_basket_cost.toFixed(2)} {country.currency}
              </span>
            </div>
            <div className={styles.splitItem}>
              <span className={styles.globalLabel}>Global basket leg</span>
              <span className={styles.globalValue}>
                {latestRecord.global_basket_cost.toFixed(2)} {country.currency}
              </span>
            </div>
          </div>
        )}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Commodity</th>
                <th>Weight</th>
                <th>Price ({country.currency})</th>
                <th>Price (USD)</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.prices.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={5}>
                    Commodity line-item data is unavailable for this month.
                  </td>
                </tr>
              ) : (
                snapshot.prices.map((p) => (
                  <tr key={p.commodity_code}>
                    <td className={styles.commodityName}>{p.commodity_name}</td>
                    <td className={styles.numeric}>{(p.weight * 100).toFixed(0)}%</td>
                    <td className={styles.numeric}>
                      {p.price_local.toFixed(2)} {displayCurrency(p.currency, country.currency)}
                    </td>
                    <td className={styles.numeric}>${p.price_usd.toFixed(2)}</td>
                    <td>
                      <span className={styles.sourceBadge}>
                        {p.source_id}
                        <span className={styles.tierBadge}>T{p.source_tier}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Global commodity track</h2>
        <div className={styles.globalGrid}>
          <div className={styles.globalItem}>
            <span className={styles.globalLabel}>FAO Cereals</span>
            <span className={styles.globalValue}>{snapshot.global_track.fao_fpi_cereals}</span>
          </div>
          <div className={styles.globalItem}>
            <span className={styles.globalLabel}>FAO Oils</span>
            <span className={styles.globalValue}>{snapshot.global_track.fao_fpi_oils}</span>
          </div>
          <div className={styles.globalItem}>
            <span className={styles.globalLabel}>FAO Sugar</span>
            <span className={styles.globalValue}>{snapshot.global_track.fao_fpi_sugar}</span>
          </div>
          <div className={styles.globalItem}>
            <span className={styles.globalLabel}>Brent crude</span>
            <span className={styles.globalValue}>${snapshot.global_track.brent_crude_usd}</span>
          </div>
          <div className={styles.globalItem}>
            <span className={styles.globalLabel}>Gold (XAU)</span>
            <span className={styles.globalValue}>${snapshot.global_track.gold_xau_usd.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {(snapshot.quality_flags.missing_sources.length > 0 ||
        snapshot.quality_flags.stale_gold ||
        snapshot.quality_flags.global_only) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Quality flags</h2>
          <ul className={styles.flagsList}>
            {snapshot.quality_flags.missing_sources.length > 0 && (
              <li>Missing sources: {snapshot.quality_flags.missing_sources.join(", ")}</li>
            )}
            {snapshot.quality_flags.stale_gold && <li>Gold price is stale (cached)</li>}
            {snapshot.quality_flags.global_only && (
              <li>
                Global fallback only: local leg suppressed ({coverageSummaryText(localCoverage)})
              </li>
            )}
            {snapshot.quality_flags.interpolated.length > 0 && (
              <li>
                Interpolated commodities:{" "}
                {snapshot.quality_flags.interpolated.join(", ")}
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
