#!/usr/bin/env bash
# One-time Cloudflare provisioning for §3.8B (R2 + KV). Requires: wrangler login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! bunx wrangler whoami >/dev/null 2>&1; then
  echo "error: not logged in. Run: cd khobz-index && bunx wrangler login" >&2
  exit 1
fi

echo "Creating R2 bucket (idempotent)..."
bunx wrangler r2 bucket create khobz-index-snapshots 2>/dev/null || echo "(bucket may already exist)"
echo ""
echo "Creating KV namespace KKI_KV — copy the id into khobz-index/wrangler.jsonc (kv_namespaces[0].id + preview_id):"
OUT="$(bunx wrangler kv namespace create KKI_KV 2>&1)" || true
echo "${OUT}"
echo ""
echo "Then set Worker secrets (non-interactive CI uses dashboard / wrangler secret put):"
echo "  bunx wrangler secret put SUPABASE_PROJECT_REF"
echo ""
echo "Deploy API:"
echo "  bun run deploy:api"
echo ""
echo "Add GitHub Actions secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, KKI_KV_NAMESPACE_ID"
