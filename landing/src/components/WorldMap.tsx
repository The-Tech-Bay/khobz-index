import { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router";
import { scaleSequential } from "d3-scale";
import { interpolateRgbBasis } from "d3-interpolate";
import type { MapProjectionConfig } from "./RegionPicker";
import { PreviewSheet } from "./PreviewSheet";
import { useTouchDevice } from "../hooks/useTouchDevice";
import { recordsForColorScale } from "../lib/rankingFilters";
import { qualityShortLabel } from "../lib/localCoverage";
import styles from "./WorldMap.module.css";

const MapChart = lazy(() => import("./MapChart"));

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
  selectedMonth: string;
  projectionConfig: MapProjectionConfig;
}

const COLOR_RANGE = ["#3E9470", "#56AB87", "#E5AB4F", "#C57A1F", "#C53434"];

export function useKkiColorScale(records: Record<string, MapRecord>) {
  return useMemo(() => {
    const scaledRecords = recordsForColorScale(records);
    const values = Object.values(scaledRecords).map((r) => r.kki_value_usd);
    if (values.length === 0) return { scale: () => "#EBE3D6", min: 0, max: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const scale = scaleSequential<string>()
      .domain([min, max])
      .interpolator(interpolateRgbBasis(COLOR_RANGE));
    return { scale, min, max };
  }, [records]);
}

export function WorldMap({ records, selectedMonth, projectionConfig }: Props) {
  const navigate = useNavigate();
  const isTouch = useTouchDevice();
  const { scale, min, max } = useKkiColorScale(records);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    record: MapRecord;
  } | null>(null);

  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const projectionSig = `${projectionConfig.scale}:${projectionConfig.center[0]},${projectionConfig.center[1]}`;

  useEffect(() => {
    setPreviewCode(null);
    setHoveredCode(null);
    setTooltip(null);
  }, [selectedMonth, projectionSig]);

  const previewRecord =
    previewCode !== null ? (records[previewCode.toUpperCase()] ?? null) : null;

  const handleHover = useCallback(
    (code: string, event: React.MouseEvent) => {
      if (isTouch) return;
      const upper = code.toUpperCase();
      const r = records[upper];
      if (r) {
        setHoveredCode(upper);
        setTooltip({ x: event.clientX, y: event.clientY, record: r });
      }
    },
    [records, isTouch],
  );

  const handleLeave = useCallback(() => {
    setHoveredCode(null);
    setTooltip(null);
  }, []);

  const handleCountryClick = useCallback(
    (code: string) => {
      const upper = code.toUpperCase();
      const r = records[upper];
      if (!r) return;

      if (isTouch) {
        const same = previewCode?.toUpperCase() === upper;
        if (same) {
          navigate(`/country/${upper}`);
          setPreviewCode(null);
          setTooltip(null);
          return;
        }
        setPreviewCode(upper);
        setTooltip(null);
        return;
      }

      navigate(`/country/${upper}`);
    },
    [records, isTouch, navigate, previewCode],
  );

  const handleNeutralClick = useCallback(() => {
    if (!isTouch) return;
    setPreviewCode(null);
    setTooltip(null);
  }, [isTouch]);

  const handleExplore = useCallback(() => {
    if (previewRecord === null) return;
    const upper = previewRecord.code.toUpperCase();
    navigate(`/country/${upper}`);
    setPreviewCode(null);
  }, [previewRecord, navigate]);

  const selectedAlpha2ForMap = isTouch && previewCode !== null ? previewCode : null;

  return (
    <div className={styles.wrapper}>
      <Suspense
        fallback={
          <div className={styles.loading} role="status">
            Loading map...
          </div>
        }
      >
        <MapChart
          records={records}
          colorScale={scale}
          projectionConfig={projectionConfig}
          selectedAlpha2={selectedAlpha2ForMap}
          hoveredAlpha2={hoveredCode}
          onHover={handleHover}
          onLeave={handleLeave}
          onCountryClick={handleCountryClick}
          onNeutralClick={isTouch ? handleNeutralClick : undefined}
        />
      </Suspense>

      {tooltip !== null ? (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
          role="tooltip"
        >
          <strong>{tooltip.record.name}</strong>
          <span className={styles.tooltipValue}>
            1 KK = {tooltip.record.kki_value.toFixed(2)}{" "}
            {tooltip.record.currency}
          </span>
          <span className={styles.tooltipUsd}>
            ≈ ${tooltip.record.kki_value_usd.toFixed(2)} USD
          </span>
          {tooltip.record.quality !== "full" && (
            <span className={styles.tooltipQuality} data-quality={tooltip.record.quality}>
              {qualityShortLabel(tooltip.record.quality)}
            </span>
          )}
        </div>
      ) : null}

      <div className={styles.legend} aria-label="Color scale legend">
        <span className={styles.legendLabel}>
          ${min.toFixed(2)}
        </span>
        <div className={styles.legendBar} />
        <span className={styles.legendLabel}>
          ${max.toFixed(2)}
        </span>
      </div>
      <div className={styles.legendCaption}>
        Daily cost in USD for countries with local basket coverage. Pale areas use global fallback estimates.
      </div>

      {isTouch ? (
        <PreviewSheet
          open={previewRecord !== null}
          record={previewRecord}
          onExplore={handleExplore}
        />
      ) : null}
    </div>
  );
}
