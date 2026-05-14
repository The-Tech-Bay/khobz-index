#!/usr/bin/env bun
/**
 * One-shot Cloudflare bind from parent repository `.env` (folder containing `khobz-index/`; `../.env` from `khobz-index/`).
 * R2 bucket → KV namespace (--update-config) → Worker secret → deploy Worker → build + Pages deploy.
 *
 * Required in parent `../.env` (relative to `khobz-index/`): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SUPABASE_PROJECT_REF
 * (skip placeholder values like `<your-...>`).
 *
 * Optional: `--sync-github` — after success, push secrets to GitHub Actions (`CLOUDFLARE_*`, `KKI_KV_NAMESPACE_ID` from wrangler.jsonc).
 *
 * Usage (from khobz-index): `bun run scripts/cf-provision-and-deploy.ts`
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const khobzRoot = join(import.meta.dir, '..');
const repoRoot = join(khobzRoot, '..');

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    const key = s.slice(0, i).trim();
    let val = s.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!val) continue;
    if (/<[^>\s]+>/.test(val)) continue;
    out[key] = val;
  }
  return out;
}

function readKvIdFromWranglerJsonc(): string | null {
  const p = join(khobzRoot, 'wrangler.jsonc');
  const raw = readFileSync(p, 'utf8');
  const stripped = raw.replace(/\/\/[^\n]*/g, '');
  const j = JSON.parse(stripped) as { kv_namespaces?: Array<{ id: string }> };
  for (const entry of j.kv_namespaces ?? []) {
    const id = entry.id?.trim();
    if (!id || id === '00000000000000000000000000000000') continue;
    if (!/^[a-f0-9]{32}$/i.test(id)) continue;
    return id;
  }
  return null;
}

function parseRemoteSlug(): string | null {
  try {
    const proc = Bun.spawnSync(['git', 'remote', 'get-url', 'origin'], {
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) return null;
    const url = new TextDecoder().decode(proc.stdout).trim();
    const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!m) return null;
    return `${m[1]}/${m[2]}`;
  } catch {
    return null;
  }
}

async function run(
  cmd: string[],
  opts: {
    cwd: string;
    env: Record<string, string | undefined>;
    stdin?: string;
    quiet?: boolean;
  },
): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env } as Record<string, string>,
    stdin: opts.stdin != null ? new TextEncoder().encode(opts.stdin) : undefined,
    stdout: opts.quiet ? 'pipe' : 'inherit',
    stderr: opts.quiet ? 'pipe' : 'inherit',
  });
  return await proc.exited;
}

function pickCloudflareToken(fileEnv: Record<string, string>): string | undefined {
  for (const t of [fileEnv.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_API_TOKEN]) {
    if (!t?.trim()) continue;
    if (t.includes('your-cloudflare')) continue;
    if (/<[^>]+>/.test(t)) continue;
    if (t.trim().length < 30) continue;
    return t.trim();
  }
  return undefined;
}

function pickEnv(
  fileEnv: Record<string, string>,
  key: string,
  opts?: { minLen?: number },
): string | undefined {
  for (const t of [fileEnv[key], process.env[key]]) {
    if (!t?.trim()) continue;
    if (/<[^>]+>/.test(t)) continue;
    if (opts?.minLen && t.trim().length < opts.minLen) continue;
    return t.trim();
  }
  return undefined;
}

async function ghSecretSet(name: string, value: string, repo: string): Promise<void> {
  const code = await run(['gh', 'secret', 'set', name, '--repo', repo], {
    cwd: repoRoot,
    env: process.env as Record<string, string | undefined>,
    stdin: value,
    quiet: true,
  });
  if (code !== 0) {
    throw new Error(`gh secret set ${name} failed (exit ${code})`);
  }
  console.info(`GitHub secret ${name} updated for ${repo}.`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantSync = argv.includes('--sync-github') || process.env.KKI_SYNC_GITHUB_SECRETS === '1';
  const repoFromArg = argv[argv.indexOf('--sync-github') + 1];
  const ghRepo = repoFromArg ?? parseRemoteSlug();

  const fileEnv = parseEnvFile(join(repoRoot, '.env'));
  const token = pickCloudflareToken(fileEnv);
  const accountId = pickEnv(fileEnv, 'CLOUDFLARE_ACCOUNT_ID', { minLen: 16 });
  const supaRef = pickEnv(fileEnv, 'SUPABASE_PROJECT_REF', { minLen: 8 });

  if (!token) {
    console.error(
      'Missing usable CLOUDFLARE_API_TOKEN — put a real token in the parent repository .env (../.env from khobz-index; Cloudflare → My Profile → API Tokens; e.g. Edit Cloudflare Workers template). Export works too.',
    );
    process.exit(1);
  }
  if (!accountId) {
    console.error('Missing CLOUDFLARE_ACCOUNT_ID.');
    process.exit(1);
  }
  if (!supaRef) {
    console.error('Missing SUPABASE_PROJECT_REF.');
    process.exit(1);
  }

  const wranglerEnv: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: accountId,
  };

  if ((await run(['bunx', 'wrangler', 'whoami'], { cwd: khobzRoot, env: wranglerEnv })) !== 0) {
    process.exit(1);
  }

  const r2Exit = await run(
    ['bunx', 'wrangler', 'r2', 'bucket', 'create', 'khobz-index-snapshots'],
    { cwd: khobzRoot, env: wranglerEnv },
  );
  if (r2Exit !== 0) {
    console.warn(
      'wrangler r2 bucket create exited non-zero (bucket may already exist — continuing).',
    );
  }

  const kvExit = await run(
    [
      'bunx',
      'wrangler',
      'kv',
      'namespace',
      'create',
      'KKI_KV',
      '--binding',
      'KKI_KV',
      '--update-config',
      '--use-remote',
    ],
    { cwd: khobzRoot, env: wranglerEnv },
  );
  if (kvExit !== 0) {
    console.warn(
      'KV namespace create exited non-zero (namespace may exist — check wrangler.jsonc has a real 32-hex id).',
    );
  }

  let kvId = readKvIdFromWranglerJsonc();
  if (!kvId) {
    console.error(
      'No valid KV namespace id in wrangler.jsonc. Fix with: bunx wrangler kv namespace create KKI_KV --binding KKI_KV --update-config --use-remote',
    );
    process.exit(1);
  }

  if (
    (await run(['bunx', 'wrangler', 'secret', 'put', 'SUPABASE_PROJECT_REF'], {
      cwd: khobzRoot,
      env: wranglerEnv,
      stdin: supaRef,
    })) !== 0
  ) {
    process.exit(1);
  }

  if ((await run(['bunx', 'wrangler', 'deploy'], { cwd: khobzRoot, env: wranglerEnv })) !== 0) {
    process.exit(1);
  }

  const landing = join(khobzRoot, 'landing');
  if (
    (await run(['bun', 'install', '--frozen-lockfile'], { cwd: landing, env: process.env })) !== 0
  ) {
    process.exit(1);
  }
  if ((await run(['bun', 'run', 'build'], { cwd: landing, env: process.env })) !== 0) {
    process.exit(1);
  }

  const pagesProject = 'khobz-index-landing';
  const createExit = await run(
    ['bunx', 'wrangler', 'pages', 'project', 'create', pagesProject, '--production-branch', 'main'],
    { cwd: khobzRoot, env: wranglerEnv },
  );
  if (createExit !== 0) {
    console.warn(
      `wrangler pages project create exited non-zero (project "${pagesProject}" may already exist — continuing).`,
    );
  }

  if (
    (await run(
      ['bunx', 'wrangler', 'pages', 'deploy', 'landing/dist', '--project-name', pagesProject],
      { cwd: khobzRoot, env: wranglerEnv },
    )) !== 0
  ) {
    process.exit(1);
  }

  kvId = readKvIdFromWranglerJsonc() ?? kvId;
  console.info('\nDone — Worker + Pages deployed.');
  console.info(`KKI_KV_NAMESPACE_ID=${kvId}`);

  if (wantSync) {
    if (!ghRepo) {
      console.warn(
        '--sync-github requested but repo slug unknown; pass owner/repo or fix git remote.',
      );
      return;
    }
    try {
      await ghSecretSet('CLOUDFLARE_API_TOKEN', token, ghRepo);
      await ghSecretSet('CLOUDFLARE_ACCOUNT_ID', accountId, ghRepo);
      await ghSecretSet('KKI_KV_NAMESPACE_ID', kvId, ghRepo);
      console.info(`GitHub Actions secrets synced for ${ghRepo} (kki-weekly.yml).`);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    console.info(
      'Tip: re-run with --sync-github to push CLOUDFLARE_* and KKI_KV_NAMESPACE_ID to GitHub.',
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
