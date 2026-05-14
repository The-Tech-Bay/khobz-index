/**
 * Month-range iteration for `--backfill`, `--from`, `--to`.
 */

/** Previous calendar month (UTC), YYYY-MM. */
export function defaultPreviousUtcMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const prev = new Date(Date.UTC(y, m - 1, 1));
  const yy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function ymToWorldBankSlice(ym: string): string {
  const [yRaw, mRaw] = ym.split('-');
  const y = yRaw ?? '1970';
  const mNum = Number(mRaw ?? 1);
  const m = String(Number.isFinite(mNum) ? mNum : 1).padStart(2, '0');
  return `${y}M${m}`;
}

export function worldBankMonthRange(fromYm: string, toYm: string): string {
  return `${ymToWorldBankSlice(fromYm)}:${ymToWorldBankSlice(toYm)}`;
}

/** Inclusive `[fromYm, toYm]` at month granularity (UTC boundaries). */
export function expandInclusiveMonths(fromYm: string, toYm: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(fromYm) || !/^\d{4}-\d{2}$/.test(toYm)) {
    throw new Error(`Invalid month ISO: "${fromYm}".."${toYm}"`);
  }
  const fy = Number(fromYm.slice(0, 4));
  const fm = Number(fromYm.slice(5, 7));
  const ty = Number(toYm.slice(0, 4));
  const tm = Number(toYm.slice(5, 7));
  if (
    !Number.isFinite(fy) ||
    !Number.isFinite(fm) ||
    !Number.isFinite(ty) ||
    !Number.isFinite(tm)
  ) {
    throw new Error(`Invalid month ISO: "${fromYm}".."${toYm}"`);
  }
  let cur = new Date(Date.UTC(fy, fm - 1, 1));
  const end = new Date(Date.UTC(ty, tm - 1, 1));
  if (cur.getTime() > end.getTime()) {
    throw new Error(`Month range inverted: "${fromYm}" > "${toYm}"`);
  }
  const out: string[] = [];
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    out.push(`${y}-${mm}`);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return out;
}
