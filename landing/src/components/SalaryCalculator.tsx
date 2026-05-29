import { useMemo, useState } from "react";
import { getCountries, getLatestMonth, formatMonth } from "../data";
import { useFixtureDataRequired } from "../data/FixtureProvider";
import { calculatePurchasingPower } from "../lib/purchasingPower";
import styles from "./SalaryCalculator.module.css";

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })} ${currency}`;
}

function confidenceLabel(confidence: string): string {
  if (confidence === "observed") return "Observed";
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Estimated";
  return "Low confidence";
}

export function SalaryCalculator() {
  const fixture = useFixtureDataRequired();
  const countries = getCountries(fixture);
  const latestMonth = getLatestMonth(fixture);
  const [countryCode, setCountryCode] = useState("MA");
  const [amount, setAmount] = useState("5000");
  const [originDate, setOriginDate] = useState("1995");
  const [comparisonDate, setComparisonDate] = useState(latestMonth);

  const country = countries[countryCode];
  const numericAmount = Number(amount);

  const result = useMemo(() => {
    if (!country) return null;
    return calculatePurchasingPower({
      amount: numericAmount,
      countryCode,
      records: country.records,
      originMonth: originDate,
      comparisonMonth: comparisonDate,
    });
  }, [country, countryCode, numericAmount, originDate, comparisonDate]);

  const sortedCountries = useMemo(
    () => Object.entries(countries).sort((a, b) => a[1].name.localeCompare(b[1].name)),
    [countries],
  );

  return (
    <section className={styles.section} aria-label="Salary purchasing power calculator">
      <div className={styles.card}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Purchasing power calculator</span>
          <h2 className={styles.title}>What was that amount worth in today’s staple food purchasing power?</h2>
          <p className={styles.subtitle}>
            Convert a historical local-currency amount into today’s KK-equivalent
            purchasing power. CPI-chained and observed months are labelled separately —
            annual CPI does not imply monthly item-level precision.
          </p>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Country</span>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {sortedCountries.map(([code, c]) => (
                <option key={code} value={code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Amount</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
            />
          </label>

          <label className={styles.field}>
            <span>Original date</span>
            <input
              value={originDate}
              onChange={(e) => setOriginDate(e.target.value)}
              placeholder="1995 or 1995-06"
            />
          </label>

          <label className={styles.field}>
            <span>Compare with</span>
            <input
              value={comparisonDate}
              onChange={(e) => setComparisonDate(e.target.value)}
              placeholder={latestMonth}
            />
          </label>
        </div>

        <div className={styles.resultBox}>
          {country && result ? (
            <>
              <div className={styles.resultLabel}>
                {formatMoney(numericAmount, country.currency)} in {originDate}
              </div>
              <div className={styles.resultValue}>
                ≈ {formatMoney(result.equivalentAmount, country.currency)}
              </div>
              <div className={styles.resultSubline}>
                Today’s equivalent purchasing power ({formatMonth(result.comparison.month)}) · ≈{" "}
                {result.kkEquivalent.toFixed(1)} KK at origin KKI
              </div>
              <div className={styles.badgeRow}>
                <span className={styles.methodBadge}>{result.origin.method.replace(/_/g, " ")}</span>
                <span className={styles.confidenceBadge}>
                  {confidenceLabel(result.origin.confidence)} · {result.origin.sourcePeriodicity}
                </span>
              </div>
              <p className={styles.note}>{result.origin.note}</p>
            </>
          ) : (
            <p className={styles.note}>
              Historical calculator data is not yet available for this country/date.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
