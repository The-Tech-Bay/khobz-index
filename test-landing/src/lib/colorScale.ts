import { useMemo } from "react";
import { scaleSequential } from "d3-scale";
import { interpolateRgbBasis } from "d3-interpolate";
import type { SampleRecord } from "./sampleData";

export const COLOR_RANGE = ["#3E9470", "#56AB87", "#E5AB4F", "#C57A1F", "#C53434"];

export const NO_DATA_LIGHT = "#EBE3D6";
export const NO_DATA_DARK = "#2C3038";
export const HOVER_FILL = "#DDD0BD";
export const STROKE_LIGHT = "#FCFAF6";
export const STROKE_DARK = "#1E2228";

export function useKkiColorScale(records: Record<string, SampleRecord>) {
  return useMemo(() => buildColorScale(records), [records]);
}

export function buildColorScale(records: Record<string, SampleRecord>) {
  const values = Object.values(records).map((r) => r.kki_value_usd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scale = scaleSequential<string>()
    .domain([min, max])
    .interpolator(interpolateRgbBasis(COLOR_RANGE));
  return { scale, min, max };
}
