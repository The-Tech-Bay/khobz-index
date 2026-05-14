import { useParams, Link, Navigate } from "react-router";
import { Helmet } from "react-helmet-async";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getCountry, getAvailableMonths, formatMonth } from "../data";
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
  return <span className={cls}>{quality}</span>;
}

export function CountryPage() {
  const { code } = useParams<{ code: string }>();
  const country = code ? getCountry(code) : undefined;

  if (!country) {
    return <Navigate to="/" replace />;
  }

  const months = getAvailableMonths();
  const chartData = months
    .map((m) => {
      const rec = country.records[m];
      return rec ? { month: formatMonth(m), kki_value: rec.kki_value, kki_value_usd: rec.kki_value_usd } : null;
    })
    .filter(Boolean);

  const latestMonth = months[months.length - 1]!;
  const latestRecord = country.records[latestMonth];
  const snapshot = country.latest_snapshot;

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

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Trend (last {chartData.length} months)</h2>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
              <XAxis
                dataKey="month"
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
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <Line
                type="monotone"
                dataKey="kki_value"
                name={`KKI (${country.currency})`}
                stroke="#3E9470"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3E9470" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Basket breakdown</h2>
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
              {snapshot.prices.map((p) => (
                <tr key={p.commodity_code}>
                  <td className={styles.commodityName}>{p.commodity_name}</td>
                  <td className={styles.numeric}>{(p.weight * 100).toFixed(0)}%</td>
                  <td className={styles.numeric}>
                    {p.price_local.toFixed(2)} {p.currency}
                  </td>
                  <td className={styles.numeric}>${p.price_usd.toFixed(2)}</td>
                  <td>
                    <span className={styles.sourceBadge}>
                      {p.source_id}
                      <span className={styles.tierBadge}>T{p.source_tier}</span>
                    </span>
                  </td>
                </tr>
              ))}
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
              <li>Global-only mode: no local market data available</li>
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
