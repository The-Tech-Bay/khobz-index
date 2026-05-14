import { useMemo } from "react";
import { Link } from "react-router";
import styles from "./CountryRanking.module.css";

interface MapRecord {
  code: string;
  name: string;
  currency: string;
  kki_value: number;
  kki_value_usd: number;
  quality: string;
}

interface Props {
  records: Record<string, MapRecord>;
}

export function CountryRanking({ records }: Props) {
  const sorted = useMemo(() => {
    return Object.values(records).sort((a, b) => a.kki_value_usd - b.kki_value_usd);
  }, [records]);

  const maxUsd = sorted.length > 0 ? sorted[sorted.length - 1]!.kki_value_usd : 1;

  return (
    <div className={styles.grid}>
      <div className={styles.column}>
        <h3 className={styles.columnTitle}>Most affordable</h3>
        <ol className={styles.list}>
          {sorted.slice(0, Math.ceil(sorted.length / 2)).map((r, i) => (
            <li key={r.code} className={styles.item}>
              <Link to={`/country/${r.code}`} className={styles.link}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.name}>{r.name}</span>
                <span className={styles.bar}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${(r.kki_value_usd / maxUsd) * 100}%` }}
                  />
                </span>
                <span className={styles.value}>
                  ${r.kki_value_usd.toFixed(2)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.column}>
        <h3 className={styles.columnTitle}>Most expensive</h3>
        <ol className={styles.list} start={Math.ceil(sorted.length / 2) + 1}>
          {sorted.slice(Math.ceil(sorted.length / 2)).map((r, i) => (
            <li key={r.code} className={styles.item}>
              <Link to={`/country/${r.code}`} className={styles.link}>
                <span className={styles.rank}>{Math.ceil(sorted.length / 2) + i + 1}</span>
                <span className={styles.name}>{r.name}</span>
                <span className={styles.bar}>
                  <span
                    className={styles.barFillExpensive}
                    style={{ width: `${(r.kki_value_usd / maxUsd) * 100}%` }}
                  />
                </span>
                <span className={styles.value}>
                  ${r.kki_value_usd.toFixed(2)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
