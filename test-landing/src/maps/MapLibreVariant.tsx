import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ScaleSequential } from "d3-scale";
import type { SampleRecord } from "../lib/sampleData";
import {
  HOVER_FILL,
  NO_DATA_DARK,
  NO_DATA_LIGHT,
  STROKE_DARK,
  STROKE_LIGHT,
} from "../lib/colorScale";
import { WORLD_GEOJSON, getAlpha2 } from "../lib/geoLookup";
import styles from "./maps.module.css";

interface Props {
  records: Record<string, SampleRecord>;
  colorScale: ScaleSequential<string>;
  isDark: boolean;
}

const SOURCE_ID = "countries";
const FILL_LAYER_ID = "countries-fill";
const STROKE_LAYER_ID = "countries-stroke";

function enrichGeoJson(
  records: Record<string, SampleRecord>,
  colorScale: ScaleSequential<string>,
  noDataColor: string,
) {
  return {
    type: "FeatureCollection" as const,
    features: WORLD_GEOJSON.features.map((feature) => {
      const alpha2 = getAlpha2(feature);
      const record = alpha2 ? records[alpha2] : undefined;
      const usd = record?.kki_value_usd ?? null;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          alpha2: alpha2 ?? "",
          name: record?.name ?? feature.properties?.name ?? "",
          kki_usd: usd,
          fill_color: usd !== null ? colorScale(usd) : noDataColor,
          has_data: usd !== null,
        },
      };
    }),
  };
}

export function MapLibreVariant({ records, colorScale, isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    usd: number;
  } | null>(null);

  const noDataColor = isDark ? NO_DATA_DARK : NO_DATA_LIGHT;
  const strokeColor = isDark ? STROKE_DARK : STROKE_LIGHT;
  const bgColor = isDark ? "#0c0e11" : "#fcfaf6";

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": bgColor },
          },
        ],
      },
      center: [10, 15],
      zoom: 0.8,
      minZoom: 0.5,
      maxZoom: 6,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      const data = enrichGeoJson(records, colorScale, noDataColor);

      map.addSource(SOURCE_ID, { type: "geojson", data });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": ["get", "fill_color"],
          "fill-opacity": 1,
        },
      });

      map.addLayer({
        id: STROKE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": strokeColor,
          "line-width": 0.6,
        },
      });

      map.on("mousemove", FILL_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.has_data) {
          map.getCanvas().style.cursor = "";
          setTooltip(null);
          return;
        }
        map.getCanvas().style.cursor = "pointer";
        map.setPaintProperty(FILL_LAYER_ID, "fill-color", [
          "case",
          ["==", ["get", "alpha2"], feature.properties.alpha2],
          HOVER_FILL,
          ["get", "fill_color"],
        ]);
        setTooltip({
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
          name: String(feature.properties.name),
          usd: Number(feature.properties.kki_usd),
        });
      });

      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        map.setPaintProperty(FILL_LAYER_ID, "fill-color", ["get", "fill_color"]);
        setTooltip(null);
      });

      setReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Initial mount only — colors refresh in effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(enrichGeoJson(records, colorScale, noDataColor));
    map.setPaintProperty("background", "background-color", bgColor);
    if (map.getLayer(STROKE_LAYER_ID)) {
      map.setPaintProperty(STROKE_LAYER_ID, "line-color", strokeColor);
    }
  }, [records, colorScale, noDataColor, strokeColor, bgColor, ready]);

  return (
    <div className={styles.mapFrame}>
      <div ref={containerRef} className={styles.maplibreHost} />
      {!ready ? <div className={styles.loading}>Loading WebGL map…</div> : null}
      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <strong>{tooltip.name}</strong>
          <span className={styles.tooltipUsd}>${tooltip.usd.toFixed(2)} USD / KK</span>
        </div>
      ) : null}
    </div>
  );
}
