/**
 * KKI release versioning (v1.1 additive provenance + staleness cap).
 *
 * - `FORMULA_VERSION`: hybrid math unchanged (α·LOCAL + (1−α)·GLOBAL).
 * - `METHODOLOGY_VERSION`: data-generation / provenance rules (forward-fill cap, labeling).
 * - `CORRECTION_TYPE`: machine tag for additive corrections without a formula revision.
 */

export const FORMULA_VERSION = '1.0.0';
export const METHODOLOGY_VERSION = '1.1.0';
export const CORRECTION_TYPE = 'additive_provenance_and_staleness_cap' as const;
