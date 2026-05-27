# Task 0.1 — Karama-specific reference inventory

**Audit date:** 2026-05-26  
**Method:** Ripgrep over `khobz-index/` for ship-todo search terms; manual classification of each hit  
**Legend:**

| Action | Meaning |
|--------|---------|
| **keep (attribution)** | Correct brand/origin context; no change |
| **rewrite (standalone)** | Rephrase so KKI stands alone; Karama optional |
| **rewrite (domain)** | Update URL to target public domain |
| **keep (integration)** | Legitimate Track A / closed API coupling |
| **move (parent)** | Belongs in parent Karama docs only; remove or slim in public export |
| **delete (internal)** | Private/dev-only; remove before public repo |
| **fix (link)** | Broken or placeholder URL |

---

## Summary counts

| Action | Count |
|--------|------:|
| keep (attribution) | 18 |
| rewrite (standalone) | 12 |
| rewrite (domain) | 6 |
| keep (integration) | 7 |
| move (parent) | 4 |
| delete (internal) | 2 |
| fix (link) | 2 |

---

## Public surfaces (landing + README + public methodology)

Priority rows for **Phase 1–3**.

| Path | Reference (summary) | Action | Rationale | Phase |
|------|---------------------|--------|-----------|-------|
| `landing/index.html` | Canonical, OG, JSON-LD URLs → `https://karama.thebay.ma/khobz` | rewrite (domain) | Target domain is `khobz-index.thebay.ma` per ship-todo | 3.1, 4.1 |
| `landing/index.html` | Meta description "across **15+ countries**" | rewrite (standalone) | Fixture has **238** countries; needs defined coverage wording | 1.3 |
| `landing/index.html` | JSON-LD `"creator": "Karama"` | keep (attribution) | Origin attribution OK if not implying app dependency | — |
| `landing/src/pages/HomePage.tsx` | Title/hero "Karama Khobz Index" | keep (attribution) | Correct public product name | — |
| `landing/src/pages/MethodologyPage.tsx` | FAQ: "Weekly intermediate values … **for the Karama app**" | rewrite (standalone) | Reads as required app context; use closed API / registered clients wording | 3.2 |
| `landing/src/pages/MethodologyPage.tsx` | Link to `github.com/…/docs/kki/kki_research.md` | fix (link) | File **not in** `khobz-index/`; will 404 on standalone repo | 2.2, 5.1 |
| `landing/src/pages/MethodologyPage.tsx` | Source FAQ lists WFP as active tier | rewrite (standalone) | Overstates v1.0 pipeline vs FAOSTAT-primary truth (Phase 2) | 2.1 |
| `landing/src/components/Layout.tsx` | Footer "Karama Khobz Index (KKI)" | keep (attribution) | Correct brand | — |
| `landing/src/components/Layout.tsx` | GitHub → `The-Tech-Bay/khobz-index` | keep (attribution) | Matches recommended topology; pending D1 | 5.1 |
| `README.md` | Title + "not a token" disclaimer | keep (attribution) | Correct | — |
| `README.md` | Badge "countries-**85+**" | rewrite (standalone) | Ambiguous vs 238 fixture countries | 1.3 |
| `README.md` | "**Parent repository**" + links to `../.github/workflows/` | move (parent) | Monorepo-only; standalone repo uses `khobz-index/.github/` | 5.4 |
| `README.md` | LOCAL_basket: "FAOSTAT consumer prices (then WFP…)" | rewrite (standalone) | v1.0 truth is FAOSTAT producer proxy; WFP not primary live | 2.1 |
| `README.md` | "**Versioned methodology** — old **promises** always reference…" | rewrite (standalone) | Karama-app framing; use "published records" or footnote | 1.1 |
| `README.md` | **Used By** → Karama promise-tracking app | rewrite (standalone) | Reframe as optional consumer / origin (D2) | 1.1 |
| `README.md` | Link `../docs/kki/landing-mobile-map-ux.md` | move (parent) | Parent-only path; broken in standalone export | 5.1 |
| `docs/methodology.md` | Header: **draft, pre-publication** | rewrite (standalone) | Remove pre-public markers for launch | 2.1, 5.2 |
| `docs/methodology.md` | "methodology landing page at **karama.thebay.ma/khobz**" | rewrite (domain) | Stale domain | 4.1 |
| `docs/methodology.md` | §6 "All **promises** recorded under v1.0" | rewrite (standalone) | Karama product term; use anchor/publication language | 1.1, 2.1 |
| `docs/methodology.md` | Links to `../../../docs/kki/kki_research.md` | move (parent) | Parent doc; copy or stub in public repo (D3) | 2.2, 5.1 |
| `data/README.md` | "closed to **app traffic** only at MVP" | rewrite (standalone) | OK if generic "registered clients"; avoid Karama-only tone | 3.2 |
| `data/README.md` | `<org>/<repo>` placeholders | fix (link) | Replace after D1 | 6.1 |

---

## Domains and deployment URLs

| Path | Reference | Action | Rationale | Phase |
|------|-----------|--------|-----------|-------|
| `docs/ops/runbook.md` | API `khobz-index-api.**smail-elboukfaoui**.workers.dev` | delete (internal) | Personal dev hostname; do not replace with a public API URL for v1 | 4.2, 5.2 |
| `docs/ops/runbook.md` | Landing `khobz-index-landing.pages.dev`; custom domain deferred | rewrite (domain) | Target `khobz-index.thebay.ma` | 4.1 |
| `docs/ops/runbook.md` | Secrets repo **`i-bkf/karama`** | delete (internal) | Private monorepo slug; document public repo secrets after D1 | 5.2, 5.4 |
| `docs/ops/runbook.md` | KV namespace IDs in table | move (parent) | Operational; OK in private runbook, redact in public export | 5.2 |
| `docs/architecture/openapi.yaml` | Server `https://kki-api.**example**.workers.dev` | rewrite (internal) | Keep API docs private/internal for v1; do not present a public API URL | 4.2 |
| `docs/architecture/api-contract.md` | Public path cites `karama.thebay.ma/khobz` | rewrite (domain) | Update to `khobz-index.thebay.ma` | 4.1 |
| `wrangler.jsonc` | No public API custom domain | keep private | No public KKI API for v1; only add a public API route in a later release if explicitly approved | 4.2 |

---

## Architecture and API (integration — mostly keep)

| Path | Reference | Action | Rationale | Phase |
|------|-----------|--------|-----------|-------|
| `docs/architecture/openapi.yaml` | "Closed authenticated API for the **Karama backend**" | keep (integration) | Accurate closed API; add "Track A" label | — |
| `docs/architecture/api-contract.md` | Track A Worker, Supabase JWT exchange | keep (integration) | Implemented auth model | — |
| `docs/architecture/architecture.md` | Webhook to **Karama Worker**; Track A diagrams | keep (integration) | Ops integration; optional slim for public | 5.2 |
| `docs/architecture/stack.md` | Serves data to **Karama app** via Supabase-JWT | keep (integration) | Technical truth | — |
| `docs/architecture/data-schema.md` | Karama `kki_rate_cache`, promise anchor settlement | move (parent) | Track A data model; not KKI public schema | 2.1 |
| `docs/architecture/data-schema.md` | Links to `../../../docs/masterTODO.md` | move (parent) | Internal monorepo task tracking | 5.2 |
| `src/api/routes/auth.ts` | Supabase JWT verification | keep (integration) | Runtime code | — |
| `src/api/lib/jwks.ts` | Supabase JWKS | keep (integration) | Runtime code | — |
| `.env.example` | `SUPABASE_PROJECT_REF` comments | keep (integration) | Closed API config | — |
| `scripts/cf-provision-and-deploy.ts` | Parent repo `.env`, Supabase ref | keep (integration) | Dev/provision script | — |
| `docs/ops/first-run-2026-05-11.md` | Validate API with Supabase JWT | keep (integration) | Ops checklist | — |

---

## Source code (internal identifiers)

| Path | Reference | Action | Rationale | Phase |
|------|-----------|--------|-----------|-------|
| `src/storage/paths.ts` | `bundle/karama-kki-bundle.json` | keep (integration) | Internal artifact name; optional rename later (low priority) | — |
| `tests/unit/storage/store.test.ts` | Asserts `karama-kki-bundle.json` path | keep (integration) | Matches storage path | — |
| `src/archive/internet-archive.ts` | Meta creator "Karama Khobz Index" | keep (attribution) | Correct dataset attribution | — |
| `.github/workflows/publish.yml` | Metadata `creator:The Tech Bay / Karama` | keep (attribution) | Archive attribution | — |

---

## Governance and community

| Path | Reference | Action | Rationale | Phase |
|------|-----------|--------|-----------|-------|
| `GOVERNANCE.md` | BDFL **@i-bkf** | keep (attribution) | Standard OSS governance | — |
| `CONTRIBUTING.md` | Maintainer **@i-bkf** | keep (attribution) | Standard | — |
| `CODE_OF_CONDUCT.md` | Contact **@i-bkf** | keep (attribution) | Standard | — |
| `package.json` | description "Karama Khobz Index" | keep (attribution) | Correct | — |
| `landing/package.json` | same | keep (attribution) | Correct | — |

---

## Internal / ship meta (exclude from public export)

| Path | Reference | Action | Rationale | Phase |
|------|-----------|--------|-----------|-------|
| `ship-todo.md` | Full ship plan, monorepo notes | move (parent) | Keep in monorepo; optional copy to public repo | 5.1 |
| `docs/alignment-audit.md` | Cross-track masterTODO alignment | move (parent) | Internal reconciliation log | 5.2 |
| `docs/architecture/stack.md` | Links to `../../../docs/kki/`, masterTODO | move (parent) | Parent research paths | 5.1 |

---

## Search terms with zero in-tree hits

| Term | Result |
|------|--------|
| `confirm-web` | None (except `ship-todo.md` instruction list) |
| `apps/mobile` | None inside `khobz-index/` (parent i18n is Phase 3.3) |

---

## Prohibited language sweep (ship-todo Phase 7)

Consumer-facing prohibited terms (`coin`, `buy KK`, `crypto`, `wallet`, `investment`, `lending app`):

| Result | Notes |
|--------|-------|
| ✅ Clean | No problematic consumer copy |

Technical uses of "token" (OAuth, API bearer, `github.token`) and "crypto" (`crypto.subtle`, `@octokit/auth-token`) are **acceptable** — not product framing.

Existing **positive** disclaimers ("not a token or currency") in `README.md`, `data/README.md`, `docs/methodology.md` — **keep**.

---

## Acceptance criteria (Task 0.1)

| Criterion | Met? |
|-----------|------|
| Inventory table with path, reference, action, rationale | ✅ |
| No **unlisted** hidden parent dependencies in public docs | ⚠️ Gaps documented above |
| Public docs can be fixed without re-audit | ✅ This table is the backlog |

**Re-verify after Phase 3:** grep `Karama app`, `karama.thebay.ma`, `promise-tracking`, `../.github/workflows`.
