import { memo, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import type { ScaleSequential } from "d3-scale";
import countries110m from "world-atlas/countries-110m.json";

import type { MapProjectionConfig } from "./RegionPicker";
import { isMoroccoTerritoryAlpha2, normalizeMapAlpha2 } from "../lib/moroccoMapNormalization";

const GEO_DATA = countries110m;

const DEFAULT_PROJECTION: MapProjectionConfig = {
  scale: 147,
  center: [10, 5],
};

const NO_DATA_COLOR_LIGHT = "#EBE3D6";
const NO_DATA_COLOR_DARK = "#2C3038";
const HOVER_FILL = "#DDD0BD";

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
  colorScale: ScaleSequential<string> | (() => string);
  projectionConfig?: MapProjectionConfig | undefined;
  selectedAlpha2?: string | null | undefined;
  hoveredAlpha2?: string | null | undefined;
  onHover: (code: string, event: React.MouseEvent) => void;
  onLeave: () => void;
  onCountryClick: (code: string) => void;
  onNeutralClick?: (() => void) | undefined;
}

const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "AF", "008": "AL", "012": "DZ", "024": "AO", "032": "AR",
  "036": "AU", "040": "AT", "050": "BD", "056": "BE", "068": "BO",
  "076": "BR", "100": "BG", "104": "MM", "116": "KH", "120": "CM",
  "124": "CA", "140": "CF", "144": "LK", "148": "TD", "152": "CL",
  "156": "CN", "170": "CO", "178": "CG", "180": "CD", "188": "CR",
  "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "208": "DK",
  "214": "DO", "218": "EC", "818": "EG", "222": "SV", "231": "ET",
  "246": "FI", "250": "FR", "266": "GA", "276": "DE", "288": "GH",
  "300": "GR", "320": "GT", "324": "GN", "328": "GY", "332": "HT",
  "340": "HN", "348": "HU", "356": "IN", "360": "ID", "364": "IR",
  "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI",
  "388": "JM", "392": "JP", "400": "JO", "398": "KZ", "404": "KE",
  "408": "KP", "410": "KR", "414": "KW", "418": "LA", "422": "LB",
  "426": "LS", "430": "LR", "434": "LY", "440": "LT", "442": "LU",
  "450": "MG", "454": "MW", "458": "MY", "466": "ML", "478": "MR",
  "484": "MX", "496": "MN", "504": "MA", "508": "MZ", "512": "OM",
  "516": "NA", "524": "NP", "528": "NL", "540": "NC", "554": "NZ",
  "558": "NI", "562": "NE", "566": "NG", "578": "NO", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH",
  "616": "PL", "620": "PT", "634": "QA", "642": "RO", "643": "RU",
  "646": "RW", "682": "SA", "686": "SN", "694": "SL", "702": "SG",
  "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA",
  "716": "ZW", "724": "ES", "729": "SD", "736": "SS", "740": "SR",
  "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "764": "TH",
  "768": "TG", "780": "TT", "784": "AE", "788": "TN", "792": "TR",
  "800": "UG", "804": "UA", "826": "GB", "834": "TZ", "840": "US",
  "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "894": "ZM",
  "887": "YE",
  "732": "MA",
};

function getAlpha2(geo: { id?: string; properties?: { ISO_A2?: string } }): string | undefined {
  if (geo.properties?.ISO_A2 && geo.properties.ISO_A2 !== "-99") {
    return normalizeMapAlpha2(geo.properties.ISO_A2);
  }
  if (geo.id) return normalizeMapAlpha2(ISO_NUMERIC_TO_ALPHA2[geo.id] ?? geo.id);
  return undefined;
}

function MapChart({
  records,
  colorScale,
  projectionConfig = DEFAULT_PROJECTION,
  selectedAlpha2,
  hoveredAlpha2,
  onHover,
  onLeave,
  onCountryClick,
  onNeutralClick,
}: Props) {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";
  const noDataColor = isDark ? NO_DATA_COLOR_DARK : NO_DATA_COLOR_LIGHT;
  const selectedUpper = selectedAlpha2?.toUpperCase() ?? null;
  const hoveredUpper = hoveredAlpha2?.toUpperCase() ?? null;

  const mergedProjection = useMemo(
    () => ({
      scale: projectionConfig.scale,
      center: projectionConfig.center as [number, number],
    }),
    [projectionConfig.center, projectionConfig.scale],
  );

  return (
    <ComposableMap
      projectionConfig={mergedProjection}
      style={{ width: "100%", height: "auto" }}
    >
      {onNeutralClick !== undefined ? (
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="transparent"
          style={{ outline: "none" }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onNeutralClick();
          }}
        />
      ) : null}
      <ZoomableGroup>
        <Geographies geography={GEO_DATA}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const alpha2 = getAlpha2(geo);
              const record = alpha2 ? records[alpha2] : undefined;
              const seq = colorScale as ScaleSequential<string>;
              const isMoroccoTerritory = isMoroccoTerritoryAlpha2(alpha2);

              const isHovered =
                alpha2 !== undefined &&
                hoveredUpper !== null &&
                alpha2.toUpperCase() === hoveredUpper &&
                Boolean(record);

              const fill =
                isHovered
                  ? HOVER_FILL
                  : record !== undefined
                    ? seq(record.kki_value_usd)
                    : noDataColor;

              const isSelected =
                alpha2 !== undefined &&
                selectedUpper !== null &&
                alpha2.toUpperCase() === selectedUpper &&
                Boolean(record);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={
                    isMoroccoTerritory
                      ? fill
                      : isSelected
                      ? (isDark ? "#56AB87" : "#2E7D5B")
                      : (isDark ? "#1E2228" : "#FCFAF6")
                  }
                  strokeWidth={
                    isMoroccoTerritory ? 0.5 : isSelected ? 1.75 : 0.5
                  }
                  tabIndex={record ? 0 : -1}
                  role={record ? "button" : undefined}
                  aria-pressed={isSelected ? true : undefined}
                  aria-label={
                    record !== undefined && alpha2 !== undefined
                      ? `${record.name}: ${record.kki_value.toFixed(2)} ${record.currency} per KK`
                      : undefined
                  }
                  onMouseMove={(e: React.MouseEvent) => {
                    if (alpha2 !== undefined) onHover(alpha2, e);
                  }}
                  onMouseLeave={onLeave}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (alpha2 !== undefined) onCountryClick(alpha2);
                  }}
                  style={{
                    default: { outline: "none", cursor: record !== undefined ? "pointer" : "default" },
                    hover: {
                      outline: "none",
                      fill: record !== undefined ? HOVER_FILL : noDataColor,
                      cursor: record !== undefined ? "pointer" : "default",
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
  );
}

export default memo(MapChart);
