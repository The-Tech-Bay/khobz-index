import { useCallback, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import type { ScaleSequential } from "d3-scale";
import type { SampleRecord } from "../lib/sampleData";
import { PROJECTION } from "../lib/sampleData";
import {
  HOVER_FILL,
  NO_DATA_DARK,
  NO_DATA_LIGHT,
  STROKE_DARK,
  STROKE_LIGHT,
} from "../lib/colorScale";
import {
  WORLD_TOPO,
  getAlpha2,
  isMoroccoTerritoryAlpha2,
} from "../lib/geoLookup";
import styles from "./maps.module.css";

interface Props {
  records: Record<string, SampleRecord>;
  colorScale: ScaleSequential<string>;
  isDark: boolean;
}

export function SimpleMapsVariant({ records, colorScale, isDark }: Props) {
  const noDataColor = isDark ? NO_DATA_DARK : NO_DATA_LIGHT;
  const strokeColor = isDark ? STROKE_DARK : STROKE_LIGHT;
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    record: SampleRecord;
  } | null>(null);

  const handleHover = useCallback(
    (code: string, event: React.MouseEvent) => {
      const upper = code.toUpperCase();
      const record = records[upper];
      if (!record) return;
      setHovered(upper);
      setTooltip({ x: event.clientX, y: event.clientY, record });
    },
    [records],
  );

  return (
    <div className={styles.mapFrame}>
      <ComposableMap
        projectionConfig={{
          scale: PROJECTION.scale,
          center: PROJECTION.center,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup>
          <Geographies geography={WORLD_TOPO}>
            {({ geographies }: { geographies: Array<{ rsmKey: string } & object> }) =>
              geographies.map((geo) => {
                const alpha2 = getAlpha2(geo as Parameters<typeof getAlpha2>[0]);
                const record = alpha2 ? records[alpha2] : undefined;
                const isHovered =
                  alpha2 !== undefined &&
                  hovered === alpha2.toUpperCase() &&
                  Boolean(record);
                const fill = isHovered
                  ? HOVER_FILL
                  : record
                    ? colorScale(record.kki_value_usd)
                    : noDataColor;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={
                      isMoroccoTerritoryAlpha2(alpha2) ? fill : strokeColor
                    }
                    strokeWidth={0.5}
                    onMouseMove={(e: React.MouseEvent) => {
                      if (alpha2) handleHover(alpha2, e);
                    }}
                    onMouseLeave={() => {
                      setHovered(null);
                      setTooltip(null);
                    }}
                    style={{
                      default: {
                        outline: "none",
                        cursor: record ? "pointer" : "default",
                      },
                      hover: {
                        outline: "none",
                        fill: record ? HOVER_FILL : noDataColor,
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <strong>{tooltip.record.name}</strong>
          <span>${tooltip.record.kki_value_usd.toFixed(2)} USD / KK</span>
        </div>
      ) : null}
    </div>
  );
}
