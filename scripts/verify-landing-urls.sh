#!/usr/bin/env bash
# Phase 4 — public landing URL verification (curl smoke checks)
set -euo pipefail

CANONICAL="https://khobz-index.thebay.ma"
ALIAS="https://kilocalorie-index.thebay.ma"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "OK: $1"; }

code=$(curl -sS -o /dev/null -w '%{http_code}' "$CANONICAL/")
[[ "$code" == "200" ]] || fail "$CANONICAL/ returned $code (expected 200)"
ok "$CANONICAL/ → $code"

canonical=$(curl -sS "$CANONICAL/" | rg -o 'rel="canonical" href="[^"]+"' | head -1 || true)
[[ "$canonical" == *"khobz-index.thebay.ma"* ]] || fail "missing canonical meta on $CANONICAL"
ok "canonical meta present"

code=$(curl -sS -o /dev/null -w '%{http_code}' "$CANONICAL/data/fixture/manifest.json")
[[ "$code" == "200" ]] || fail "fixture manifest returned $code"
ok "fixture manifest → $code"

# Alias must 301/308 to canonical (Pages middleware or zone redirect rule)
headers=$(curl -sSI "$ALIAS/country/MA")
status=$(echo "$headers" | head -1)
location=$(echo "$headers" | rg -i '^location:' | head -1 || true)
if echo "$status" | rg -q '301|308'; then
  [[ "$location" == *"khobz-index.thebay.ma/country/MA"* ]] || fail "alias redirect location wrong: $location"
  ok "$ALIAS/country/MA → redirect to canonical"
else
  fail "$ALIAS/country/MA → $status (expected 301/308 redirect; deploy landing/functions/_middleware.ts)"
fi

# D4-B: legacy path must not redirect to KKI canonical
legacy=$(curl -sSI "https://karama.thebay.ma/khobz" 2>/dev/null | head -1 || echo "unreachable")
if echo "$legacy" | rg -qi '301|302|308'; then
  loc=$(curl -sSI "https://karama.thebay.ma/khobz" 2>/dev/null | rg -i '^location:' || true)
  [[ "$loc" == *"khobz-index.thebay.ma"* ]] && fail "legacy /khobz redirects to KKI (D4-B violation): $loc"
fi
ok "legacy karama.thebay.ma/khobz does not redirect to KKI (or unreachable)"

echo "All Phase 4 landing URL checks passed."
