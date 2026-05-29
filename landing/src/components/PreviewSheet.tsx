import { qualityShortLabel } from "../lib/localCoverage";
import styles from "./PreviewSheet.module.css";

interface MapRecord {
  code: string;
  name: string;
  currency: string;
  kki_value: number;
  kki_value_usd: number;
  quality: string;
}

interface Props {
  open: boolean;
  record: MapRecord | null;
  onExplore: () => void;
}

export function PreviewSheet({ open, record, onExplore }: Props) {
  const visible = Boolean(open && record);

  return (
    <div
      className={styles.sheet}
      data-open={visible ? "true" : "false"}
      aria-hidden={!visible}
      role="dialog"
      aria-live="polite"
      aria-label={record?.name ?? "Country preview"}
    >
      {!record ? null : (
        <>
          <div className={styles.handle} aria-hidden />
          <p className={styles.country}>{record.name}</p>
          <p className={styles.primary}>
            <span className={styles.amount}>
              1 KK = {record.kki_value.toFixed(2)} {record.currency}
            </span>
          </p>
          <p className={styles.secondary}>
            ≈ ${record.kki_value_usd.toFixed(2)} USD (daily staple basket)
          </p>
          {record.quality !== "full" && (
            <p className={styles.quality} data-quality={record.quality}>
              {qualityShortLabel(record.quality)}
            </p>
          )}
          <button type="button" className={styles.cta} onClick={onExplore}>
            Explore {record.name}
          </button>
        </>
      )}
    </div>
  );
}
