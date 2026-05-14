#!/usr/bin/env bun
/**
 * Fetch FAOSTAT Producer Prices bulk CSV and convert to the JSON envelope
 * format expected by `src/adapters/faostat.ts`.
 *
 * Usage:
 *   bun run scripts/fetch-faostat-prices.ts [--output data/reference/faostat-cp-backfill.json]
 *
 * What it does:
 *   1. Downloads the FAOSTAT "Prices_E_All_Data_(Normalized).zip" bulk export.
 *   2. Extracts the CSV, filters to LCU/tonne (element 5530) rows for our
 *      15 basket item codes, from 2018 onwards.
 *   3. Converts tonne → retail unit (kg or L) and maps FAOSTAT item codes
 *      to the adapter's expected codes (FAOSTAT_ITEM_TO_CPC keys).
 *   4. Spreads annual rows to each month of the year (linear interpolation
 *      between adjacent years when possible; flat fill for edge years).
 *   5. Writes `{ "data": [ ... ] }` JSON envelope to the output path.
 *
 * The pipeline reads this via FAOSTAT_CP_JSON_PATH env var.
 *
 * Called by:
 *   - `bun run pipeline:prefetch` (package.json script)
 *   - GitHub Actions `kki-weekly.yml` (pre-pipeline step)
 */

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BULK_URL =
  'https://fenixservices.fao.org/faostat/static/bulkdownloads/Prices_E_All_Data_(Normalized).zip';

const ELEMENT_LCU = '5530';
const MIN_YEAR = 2018;

/**
 * FAOSTAT PP item code → adapter item code (FAOSTAT_ITEM_TO_CPC key).
 * PP codes differ from legacy consumer-price codes for some commodities.
 */
const PP_TO_ADAPTER_ITEM: Record<string, string> = {
  '15': '16', // Wheat → wheat flour proxy
  '27': '31', // Rice → rice
  '56': '58', // Maize → maize flour proxy
  '125': '125', // Cassava
  '176': '176', // Beans dry
  '186': '186', // Lentils
  '201': '186', // Lentils dry (alternative code, merge)
  '236': '236', // Soybean
  '242': '191', // Groundnuts → peanuts
  '257': '257', // Cashew nuts
  '267': '268', // Sunflower seed → cooking oil proxy
  '882': '882', // Tea
  '1062': '1062', // Tobacco — keep for matching
  '156': '2543', // Sugar cane → sugar proxy
  '79': '1579', // Millet
  '83': '2905', // Sorghum
};

/** Items whose PP price is per tonne of raw commodity that proxies retail per-kg. */
const _TONNE_TO_KG_ITEMS = new Set(Object.keys(PP_TO_ADAPTER_ITEM));

/** Items where we divide by 1000 and then apply a retail markup factor. */
const RETAIL_MARKUP: Record<string, number> = {
  '15': 1.4, // wheat → flour milling markup
  '56': 1.3, // maize → flour
  '267': 2.0, // sunflower seed → bottled oil
  '156': 1.8, // sugar cane → refined sugar
};

const PP_ITEM_CODES = new Set(Object.keys(PP_TO_ADAPTER_ITEM));

const MONTHS_CODE_TO_NUM: Record<string, string> = {
  '7001': '01',
  '7002': '02',
  '7003': '03',
  '7004': '04',
  '7005': '05',
  '7006': '06',
  '7007': '07',
  '7008': '08',
  '7009': '09',
  '7010': '10',
  '7011': '11',
  '7012': '12',
  '7021': 'annual',
};

type ParsedRow = {
  area_code: string;
  area: string;
  item_code_pp: string;
  year: number;
  month_num: string;
  value: number;
  currency: string;
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function downloadAndExtract(outDir: string): Promise<string> {
  const zipPath = resolve(outDir, 'faostat-prices-bulk.zip');
  const csvName = 'Prices_E_All_Data_(Normalized).csv';
  const csvPath = resolve(outDir, csvName);

  if (existsSync(csvPath)) {
    console.info(`[fetch-faostat] Using cached CSV at ${csvPath}`);
    return csvPath;
  }

  console.info(`[fetch-faostat] Downloading ${BULK_URL} ...`);
  const res = await fetch(BULK_URL, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

  const ws = createWriteStream(zipPath);
  await pipeline(Readable.fromWeb(res.body as ReadableStream<Uint8Array>), ws);
  console.info(`[fetch-faostat] Downloaded ${zipPath} (${(ws.bytesWritten / 1e6).toFixed(1)} MB)`);

  console.info(`[fetch-faostat] Extracting ...`);
  const proc = Bun.spawn(['unzip', '-o', '-d', outDir, zipPath, csvName], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`unzip failed with code ${exitCode}`);

  try {
    unlinkSync(zipPath);
  } catch {}
  return csvPath;
}

function parseRelevantRows(csvPath: string): ParsedRow[] {
  console.info('[fetch-faostat] Parsing CSV (filtering to basket items, LCU, ≥2018) ...');
  const text = readFileSync(csvPath, 'utf8');
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 20) continue;
    const f = parseCSVLine(line);

    const m49Raw = (f[1] ?? '').replace(/'/g, '');
    const area = f[2] ?? '';
    const itemCode = f[3] ?? '';
    const elementCode = f[6] ?? '';
    const yearStr = f[9] ?? '';
    const monthsCode = f[10] ?? '';
    const valueStr = f[13] ?? '';
    const areaCode = m49Raw;

    if (elementCode !== ELEMENT_LCU) continue;
    if (!PP_ITEM_CODES.has(itemCode)) continue;

    const year = Number.parseInt(yearStr, 10);
    if (year < MIN_YEAR) continue;

    const val = Number.parseFloat(valueStr);
    if (!Number.isFinite(val) || val <= 0) continue;

    const monthNum = MONTHS_CODE_TO_NUM[monthsCode] ?? 'annual';

    rows.push({
      area_code: areaCode,
      area,
      item_code_pp: itemCode,
      year,
      month_num: monthNum,
      value: val,
      currency: 'LCU',
    });
  }

  console.info(`[fetch-faostat] Parsed ${rows.length} relevant rows`);
  return rows;
}

type EnvelopeRow = {
  area_code: string;
  area: string;
  item_code: string;
  item: string;
  element: string;
  year: string;
  months: string;
  value: number;
  unit: string;
  currency: string;
};

function convertToEnvelope(parsed: ParsedRow[]): EnvelopeRow[] {
  type AnnualKey = string;
  const annualMap = new Map<AnnualKey, { row: ParsedRow; monthlyPresent: boolean }>();
  const monthlyRows: ParsedRow[] = [];

  for (const r of parsed) {
    if (r.month_num === 'annual') {
      const k = `${r.area_code}:${r.item_code_pp}:${r.year}`;
      annualMap.set(k, { row: r, monthlyPresent: false });
    } else {
      monthlyRows.push(r);
      const k = `${r.area_code}:${r.item_code_pp}:${r.year}`;
      const ann = annualMap.get(k);
      if (ann) ann.monthlyPresent = true;
    }
  }

  const output: EnvelopeRow[] = [];

  for (const mr of monthlyRows) {
    output.push(toEnvelopeRow(mr, mr.month_num));
  }

  for (const [, { row, monthlyPresent }] of annualMap) {
    if (monthlyPresent) continue;

    const prevKey = `${row.area_code}:${row.item_code_pp}:${row.year - 1}`;
    const nextKey = `${row.area_code}:${row.item_code_pp}:${row.year + 1}`;
    const prev = annualMap.get(prevKey)?.row;
    const next = annualMap.get(nextKey)?.row;

    for (let m = 1; m <= 12; m++) {
      let val = row.value;
      if (prev && next) {
        const frac = (m - 0.5) / 12;
        val =
          prev.value +
          (next.value - prev.value) * ((row.year - prev.year - 1 + frac) / (next.year - prev.year));
        if (val <= 0) val = row.value;
      } else if (prev) {
        const frac = (m - 0.5) / 12;
        const trend = row.value - prev.value;
        val = row.value + trend * frac * 0.5;
      } else if (next) {
        const frac = (m - 0.5) / 12;
        const trend = next.value - row.value;
        val = row.value + trend * frac * 0.3;
      }
      output.push(toEnvelopeRow({ ...row, value: val }, String(m).padStart(2, '0')));
    }
  }

  // Forward-fill: extend each area+item's latest available data through
  // current month so the pipeline has local prices for recent periods
  // where FAOSTAT hasn't published yet.
  const nowDate = new Date();
  const fillToYear = nowDate.getFullYear();
  const fillToMonth = nowDate.getMonth() + 1;

  type LatestKey = string;
  const latestByAreaItem = new Map<
    LatestKey,
    { year: number; month: number; val: number; row: ParsedRow }
  >();

  for (const r of parsed) {
    const k = `${r.area_code}:${r.item_code_pp}`;
    const m = r.month_num === 'annual' ? 12 : Number.parseInt(r.month_num, 10);
    const existing = latestByAreaItem.get(k);
    if (!existing || r.year > existing.year || (r.year === existing.year && m > existing.month)) {
      latestByAreaItem.set(k, { year: r.year, month: m, val: r.value, row: r });
    }
  }

  let forwardFillCount = 0;
  for (const [, latest] of latestByAreaItem) {
    let y = latest.year;
    let m = latest.month + 1;
    if (m > 12) {
      y++;
      m = 1;
    }

    while (y < fillToYear || (y === fillToYear && m <= fillToMonth)) {
      output.push(
        toEnvelopeRow({ ...latest.row, year: y, value: latest.val }, String(m).padStart(2, '0')),
      );
      forwardFillCount++;
      m++;
      if (m > 12) {
        y++;
        m = 1;
      }
    }
  }

  console.info(
    `[fetch-faostat] Envelope: ${output.length} monthly rows (${forwardFillCount} forward-filled through ${fillToYear}-${String(fillToMonth).padStart(2, '0')})`,
  );
  return output;
}

function toEnvelopeRow(r: ParsedRow, mm: string): EnvelopeRow {
  const adapterItemCode = PP_TO_ADAPTER_ITEM[r.item_code_pp] ?? r.item_code_pp;
  let val = r.value / 1000;
  const markup = RETAIL_MARKUP[r.item_code_pp];
  if (markup) val *= markup;
  val = Math.round(val * 100) / 100;

  return {
    area_code: r.area_code,
    area: r.area,
    item_code: adapterItemCode,
    item: r.area,
    element: 'Producer prices (proxy)',
    year: String(r.year),
    months: mm,
    value: val,
    unit: r.item_code_pp === '267' ? 'LCU per L' : 'LCU per kg',
    currency: r.currency,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = '';
  for (const a of args) {
    if (a.startsWith('--output=')) outputPath = a.slice('--output='.length);
  }
  if (!outputPath) {
    outputPath = resolve(import.meta.dir, '../data/reference/faostat-pp-backfill.json');
  }

  const tmpDir = resolve(import.meta.dir, '../build');
  mkdirSync(tmpDir, { recursive: true });

  const csvPath = await downloadAndExtract(tmpDir);
  const parsed = parseRelevantRows(csvPath);
  const envelope = convertToEnvelope(parsed);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify({ data: envelope }, null, 0), 'utf8');
  const sizeMb = (Buffer.byteLength(JSON.stringify({ data: envelope })) / 1e6).toFixed(1);
  console.info(`[fetch-faostat] Wrote ${outputPath} (${sizeMb} MB, ${envelope.length} rows)`);
}

await main();
