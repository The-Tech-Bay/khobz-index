#!/usr/bin/env bun
/**
 * Pre-mirror gate: duplicate clutter, stale public domains, prohibited consumer framing.
 * Run from khobz-index/ via `bun run mirror:verify`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** Filenames like `README 2.md` or `.gitignore 2` — launch clutter. */
const DUPLICATE_NAME = /\s2(\.|$)/;

const STALE_DOMAIN_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /karama\.thebay\.ma\/khobz/i, label: 'legacy karama.thebay.ma/khobz' },
  { pattern: /khobz-index-landing\.pages\.dev/i, label: 'ops preview pages.dev host' },
  { pattern: /kki-api\.example\.workers\.dev/i, label: 'placeholder API host' },
  { pattern: /smail-elboukfaoui\.workers\.dev/i, label: 'personal Worker host' },
  { pattern: /\bi-bkf\/karama\b/i, label: 'private monorepo slug i-bkf/karama' },
];

/** Consumer/public surfaces — not src/, tests/, or shipping history docs. */
const PUBLIC_SURFACE_GLOBS = [
  'README.md',
  'docs/methodology.md',
  'data/README.md',
  'landing/index.html',
  'landing/src/pages',
  'landing/src/components/Layout.tsx',
  'landing/src/components/SalaryCalculator.tsx',
  'landing/src/components/CountryRanking.tsx',
  'landing/src/components/RankingFilters.tsx',
  'landing/src/components/PreviewSheet.tsx',
  'SECURITY.md',
  'CONTRIBUTING.md',
] as const;

/** Paths where stale-domain hits are documented exceptions (scanners, history, ops notes). */
const STALE_DOMAIN_ALLOW_SUFFIXES = [
  'docs/shipping v1/',
  'docs/ops/runbook.md',
  'docs/ops/public-release-checklist.md',
  'scripts/verify-landing-urls.sh',
  'scripts/verify-mirror-readiness.ts',
  'ship-todo.md',
] as const;

/** Positive disclaimers — allowed even if they mention banned words. */
const DISCLAIMER_MARKERS = [
  'not a coin',
  'not a token',
  'not a cryptocurrency',
  'not an investment',
  'not a currency or investment product',
  'not a wallet',
  'not a lending app',
  'published reference index',
] as const;

const PROHIBITED_CONSUMER_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbuy\s+kk\b/i, label: 'buy KK' },
  { pattern: /\bcryptocurrency\b/i, label: 'cryptocurrency' },
  { pattern: /\blending\s+app\b/i, label: 'lending app' },
  { pattern: /\bwallet\b/i, label: 'wallet (consumer)' },
  { pattern: /\binvestment\s+product\b/i, label: 'investment product' },
];

export interface MirrorReadinessResult {
  ok: boolean;
  errors: string[];
}

async function walkFiles(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'build') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

export function isDuplicateClutterFilename(name: string): boolean {
  return DUPLICATE_NAME.test(name);
}

export function hasAllowedDisclaimer(text: string): boolean {
  const lower = text.toLowerCase();
  return DISCLAIMER_MARKERS.some((m) => lower.includes(m));
}

export function isStaleDomainAllowedPath(relPath: string): boolean {
  return STALE_DOMAIN_ALLOW_SUFFIXES.some((s) => relPath.includes(s));
}

export function scanTextForViolations(
  relPath: string,
  text: string,
): { stale: string[]; prohibited: string[] } {
  const stale: string[] = [];
  const prohibited: string[] = [];

  if (!isStaleDomainAllowedPath(relPath)) {
    for (const { pattern, label } of STALE_DOMAIN_PATTERNS) {
      if (pattern.test(text)) stale.push(label);
    }
  }

  const isConsumerSurface =
    relPath.startsWith('landing/src/') ||
    relPath === 'README.md' ||
    relPath === 'docs/methodology.md' ||
    relPath === 'data/README.md' ||
    relPath === 'landing/index.html';

  if (isConsumerSurface && !hasAllowedDisclaimer(text)) {
    for (const { pattern, label } of PROHIBITED_CONSUMER_PATTERNS) {
      if (pattern.test(text)) prohibited.push(label);
    }
  }

  return { stale, prohibited };
}

export async function verifyMirrorReadiness(root = ROOT): Promise<MirrorReadinessResult> {
  const errors: string[] = [];
  const allFiles = await walkFiles(root);

  for (const abs of allFiles) {
    const rel = relative(root, abs);
    const base = rel.split('/').pop() ?? rel;
    if (isDuplicateClutterFilename(base)) {
      errors.push(`duplicate clutter file: ${rel}`);
    }
  }

  async function scanFile(rel: string): Promise<void> {
    try {
      const text = await readFile(join(root, rel), 'utf8');
      const { stale, prohibited } = scanTextForViolations(rel, text);
      for (const s of stale) errors.push(`${rel}: stale domain — ${s}`);
      for (const p of prohibited) errors.push(`${rel}: prohibited framing — ${p}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return;
      throw err;
    }
  }

  for (const surface of PUBLIC_SURFACE_GLOBS) {
    if (surface.endsWith('/pages')) {
      const pagesDir = join(root, surface);
      try {
        const pages = await readdir(pagesDir);
        for (const p of pages) {
          if (!p.endsWith('.tsx')) continue;
          await scanFile(`${surface}/${p}`);
        }
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') throw err;
      }
      continue;
    }
    await scanFile(surface);
  }

  return { ok: errors.length === 0, errors };
}

async function main(): Promise<void> {
  const result = await verifyMirrorReadiness();
  if (result.ok) {
    console.info('[mirror:verify] OK — no duplicate clutter or public-surface violations');
    process.exit(0);
  }
  console.error('[mirror:verify] FAILED:');
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (import.meta.main) {
  await main();
}
