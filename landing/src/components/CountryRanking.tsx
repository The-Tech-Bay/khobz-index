import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { CountryData } from "../types";
import {
  splitRankingRecords,
  type MapRecord,
  type RankingFilterMode,
} from "../lib/rankingFilters";
import { qualityShortLabel } from "../lib/localCoverage";
import { RankingFilters } from "./RankingFilters";
import styles from "./CountryRanking.module.css";

interface Props {
  records: Record<string, MapRecord>;
  countries: Record<string, CountryData>;
  filterMode?: RankingFilterMode;
}

function RankingList({
  items,
  startRank,
  maxUsd,
  muted,
}: {
  items: MapRecord[];
  startRank: number;
  maxUsd: number;
  muted?: boolean;
}) {
  const half = Math.ceil(items.length / 2);
  const affordable = items.slice(0, half);
  const expensive = items.slice(half);

  return (
    <div className={styles.grid}>
      <div className={styles.column}>
        <h3 className={styles.columnTitle}>Most affordable</h3>
        <ol className={styles.list}>
          {affordable.map((r, i) => (
            <li key={r.code} className={styles.item} data-muted={muted ? "true" : undefined}>
              <Link to={`/country/${r.code}`} className={styles.link}>
                <span className={styles.rank}>{startRank + i}</span>
                <span className={styles.name}>{r.name}</span>
                {r.quality !== "full" && (
                  <span className={styles.qualityTag} data-quality={r.quality}>
                    {qualityShortLabel(r.quality)}
                  </span>
                )}
                <span className={styles.bar}>
                  <span
                    className={muted ? styles.barFillMuted : styles.barFill}
                    style={{ width: `${(r.kki_value_usd / maxUsd) * 100}%` }}
                  />
                </span>
                <span className={styles.value}>${r.kki_value_usd.toFixed(2)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.column}>
        <h3 className={styles.columnTitle}>Most expensive</h3>
        <ol className={styles.list} start={startRank + half + 1}>
          {expensive.map((r, i) => (
            <li key={r.code} className={styles.item} data-muted={muted ? "true" : undefined}>
              <Link to={`/country/${r.code}`} className={styles.link}>
                <span className={styles.rank}>{startRank + half + i + 1}</span>
                <span className={styles.name}>{r.name}</span>
                {r.quality !== "full" && (
                  <span className={styles.qualityTag} data-quality={r.quality}>
                    {qualityShortLabel(r.quality)}
                  </span>
                )}
                <span className={styles.bar}>
                  <span
                    className={muted ? styles.barFillMuted : styles.barFillExpensive}
                    style={{ width: `${(r.kki_value_usd / maxUsd) * 100}%` }}
                  />
                </span>
                <span className={styles.value}>${r.kki_value_usd.toFixed(2)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function CountryRanking({ records, countries, filterMode: controlledMode }: Props) {
  const [internalMode, setInternalMode] = useState<RankingFilterMode>("local_only");
  const mode = controlledMode ?? internalMode;
  const setMode = controlledMode ? () => {} : setInternalMode;

  const split = useMemo(
    () => splitRankingRecords(records, mode, countries),
    [records, mode, countries],
  );

  const maxUsd = useMemo(() => {
    const values = [...split.primary, ...split.fallback].map((r) => r.kki_value_usd);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [split]);

  const [fallbackOpen, setFallbackOpen] = useState(false);

  return (
    <div>
      {controlledMode === undefined && (
        <RankingFilters mode={mode} onChange={setMode} />
      )}

      {split.primary.length > 0 ? (
        <RankingList items={split.primary} startRank={1} maxUsd={maxUsd} />
      ) : (
        <p className={styles.emptyNote}>No countries match this filter for the selected month.</p>
      )}

      {mode !== "include_global" && split.fallback.length > 0 && (
        <details
          className={styles.fallbackSection}
          open={fallbackOpen}
          onToggle={(e) => setFallbackOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className={styles.fallbackSummary}>
            Global fallback only — insufficient local basket coverage ({split.fallback.length}{" "}
            countries)
          </summary>
          <p className={styles.fallbackNote}>
            These countries share the same global commodity track in USD. Identical values reflect
            shared global pricing, not equal local food costs.
          </p>
          <RankingList items={split.fallback} startRank={1} maxUsd={maxUsd} muted />
        </details>
      )}

      <p className={styles.footnote}>
        Rankings compare USD KKI for countries with an accepted local basket leg. Global-fallback
        countries use only the shared commodity track until local coverage clears the 60% weight
        threshold.
      </p>
    </div>
  );
}
