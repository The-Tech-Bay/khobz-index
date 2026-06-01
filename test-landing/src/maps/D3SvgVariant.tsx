import { useMemo, useState, useCallback } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { ScaleSequential } from "d3-scale";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
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

const WIDTH = 800;
const HEIGHT = 400;

export function D3SvgVariant({ records, colorScale, isDark }: Props) {
  const noDataColor = isDark ? NO_DATA_DARK : NO_DATA_LIGHT;
  const strokeColor = isDark ? STROKE_DARK : STROKE_LIGHT;
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    record: SampleRecord;
  } | null>(null);

  const { pathGenerator, countries } = useMemo(() => {
    const projection = geoEqualEarth()
      .scale(PROJECTION.scale)
      .center(PROJECTION.center)
      .translate([WIDTH / 2, HEIGHT / 2]);

    const pathGenerator = geoPath(projection);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = WORLD_TOPO as any;
    const collection = feature(topo, topo.objects.countries);
    const geoFeatures = (collection as unknown as { features: Feature<Geometry>[] })
      .features;

    return { pathGenerator, countries: geoFeatures };
  }, []);

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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="D3 SVG world map">
        <rect width={WIDTH} height={HEIGHT} fill="transparent" />
        <g>
          {countries.map((geo: Feature<Geometry>, index: number) => {
            const alpha2 = getAlpha2({
              id: geo.id,
              properties: geo.properties ?? undefined,
            });
            const record = alpha2 ? records[alpha2] : undefined;
            const d = pathGenerator(geo);
            if (!d) return null;

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
              <path
                key={alpha2 ?? `geo-${index}`}
                d={d}
                fill={fill}
                stroke={
                  isMoroccoTerritoryAlpha2(alpha2) ? fill : strokeColor
                }
                strokeWidth={0.5}
                className={styles.countryPath}
                data-has-data={record ? "true" : "false"}
                onMouseMove={(e) => {
                  if (alpha2) handleHover(alpha2, e);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  setTooltip(null);
                }}
              />
            );
          })}
        </g>
      </svg>

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
