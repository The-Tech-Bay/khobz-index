import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const HistoricalCpiKindSchema = z.enum(['food_cpi', 'headline_cpi']);
export type HistoricalCpiKind = z.infer<typeof HistoricalCpiKindSchema>;

export const HistoricalCpiObservationSchema = z.object({
  country_code: z.string().length(2),
  period: z.string().regex(/^\d{4}(-\d{2})?$/),
  value: z.number().positive(),
  kind: HistoricalCpiKindSchema,
  source_id: z.string().min(1),
  periodicity: z.enum(['monthly', 'annual']),
});

export type HistoricalCpiObservation = z.infer<typeof HistoricalCpiObservationSchema>;

const HistoricalCpiEnvelopeSchema = z.object({
  generated_at: z.string().datetime().optional(),
  observations: z.array(HistoricalCpiObservationSchema),
});

export type HistoricalCpiEnvelope = z.infer<typeof HistoricalCpiEnvelopeSchema>;

export function loadHistoricalCpiEnvelope(pathRaw: string): HistoricalCpiEnvelope {
  const abs = resolve(process.cwd(), pathRaw);
  if (!existsSync(abs)) {
    throw new Error(`Historical CPI file not found: ${abs}`);
  }
  return HistoricalCpiEnvelopeSchema.parse(JSON.parse(readFileSync(abs, 'utf8')));
}

export function loadHistoricalCpiEnvelopeFromEnv(): HistoricalCpiEnvelope | null {
  const pathRaw = (process.env.HISTORICAL_CPI_JSON_PATH ?? '').trim();
  if (pathRaw) return loadHistoricalCpiEnvelope(pathRaw);
  const bundled = 'data/reference/historical-cpi-envelope.json';
  try {
    return loadHistoricalCpiEnvelope(bundled);
  } catch {
    return null;
  }
}

export function observationsForCountry(
  envelope: HistoricalCpiEnvelope,
  countryCode: string,
  kind: HistoricalCpiKind,
): HistoricalCpiObservation[] {
  const cc = countryCode.toUpperCase();
  return envelope.observations
    .filter((o) => o.country_code.toUpperCase() === cc && o.kind === kind)
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function findCpiObservation(
  observations: readonly HistoricalCpiObservation[],
  targetMonth: string,
): HistoricalCpiObservation | null {
  const ym = targetMonth.slice(0, 7);
  const yyyy = ym.slice(0, 4);
  return (
    observations.find((o) => o.period === ym) ??
    observations.find((o) => o.period === yyyy) ??
    null
  );
}
