/**
 * Morocco is rendered as one official national territory in the public landing map.
 * Some generic world map datasets expose Western Sahara as ISO `EH` / numeric `732`.
 * The landing experience normalizes those features to `MA` so hover, color, click,
 * and ranking semantics all resolve to Morocco.
 */
export function normalizeMapAlpha2(alpha2: string | undefined): string | undefined {
  if (!alpha2) return undefined;
  const upper = alpha2.toUpperCase();
  if (upper === "EH" || upper === "ESH" || upper === "732") return "MA";
  return upper;
}

export function isMoroccoTerritoryAlpha2(alpha2: string | undefined): boolean {
  return normalizeMapAlpha2(alpha2) === "MA";
}
