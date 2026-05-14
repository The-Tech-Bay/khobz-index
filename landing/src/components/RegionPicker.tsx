import type { MapRegionId } from "../lib/mapRegionFilter";
import styles from "./RegionPicker.module.css";

export interface MapProjectionConfig {
  readonly scale: number;
  readonly center: [number, number];
}

const PROJECTION_BY_REGION: Readonly<Record<MapRegionId, MapProjectionConfig>> =
  Object.freeze({
    global: { scale: 147, center: [10, 5] },
    africa: { scale: 400, center: [20, 2] },
    mena: { scale: 600, center: [42, 28] },
    europe: { scale: 650, center: [15, 52] },
    asia: { scale: 350, center: [90, 30] },
    americas: { scale: 250, center: [-80, 10] },
  });

const OPTIONS: ReadonlyArray<{
  id: MapRegionId;
  label: string;
}> = Object.freeze([
  { id: "global", label: "Global" },
  { id: "africa", label: "Africa" },
  { id: "mena", label: "MENA" },
  { id: "europe", label: "Europe" },
  { id: "asia", label: "Asia" },
  { id: "americas", label: "Americas" },
]);

export function projectionForRegion(id: MapRegionId): MapProjectionConfig {
  return PROJECTION_BY_REGION[id];
}

interface Props {
  value: MapRegionId;
  onChange: (id: MapRegionId) => void;
  id?: string;
}

export function RegionPicker({ value, onChange, id }: Props) {
  return (
    <div className={styles.wrap} id={id}>
      <p className={styles.label} id={id ? `${id}-label` : undefined}>
        Map area
      </p>
      <div
        className={styles.scroll}
        role="tablist"
        aria-label="Map region"
        aria-labelledby={id ? `${id}-label` : undefined}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={value === opt.id}
            className={value === opt.id ? styles.pillActive : styles.pill}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
