# Decision guide — D1 through D4 (KKI public ship)

**Audience:** Non-expert stakeholders choosing how to launch KKI as a **standalone public index**  
**Date:** 2026-05-26  
**Context:** Phase 0 audit and Phase 1 copy pass are done. Four human choices still block Phases 2–7 from finishing cleanly.  
**Related docs:** [Phase 0 summary](./phase0-readiness-summary.md) · [Phase 1 status](./phase1-identity-alignment.md) · [Ship plan](../../ship-todo.md)

---

## How to use this guide

1. Read all four decisions once — they interact (especially **D1 + D3 + D4**).
2. Answer the “Questions to ask yourself” for each decision.
3. Record your choices in this file (add a **Decisions recorded** section at the bottom) or in your project tracker.
4. Hand the recorded answers to whoever runs Phases 2–7. **Do not assume defaults were chosen unless written down.**

**What these decisions are *not*:** They do not change the KKI formula, data pipeline, or legal status. They only decide **where the public project lives**, **how it talks about Karama**, **where deep research docs live**, and **what happens to an old web URL**.

---

## Quick dependency map

| Decision | Phases / tasks that wait for an answer |
|----------|----------------------------------------|
| **D1** Repo topology | 5.1, 5.4, 6.1; GitHub links in landing footer, `data/README.md`, README CI section |
| **D2** README “Used By” | 1.1 (final), 5.2 README standalone framing |
| **D3** Long-form research doc | 2.2, 2.3–2.4 (if copied), 3.2 Methodology page link, many architecture doc cross-links |
| **D4** Legacy URL | 3.1 SEO/metadata, 3.3 mobile `learnMoreUrl`, 4.1 domain wiring, press boilerplate in `channel-copy.md` |

**Can proceed without waiting:** Phase 2 Task 2.1 (`docs/methodology.md` rewrite) can start anytime. Phase 2.2+ and most URL/link work should wait for **D1**, **D3**, and **D4**.

---

## D1 — Public repo topology

### 1. What you're deciding

Whether KKI’s public GitHub home is its **own repository** or a **folder inside the Karama monorepo**.

### 2. Why it matters now

Every “View on GitHub”, citation URL, CI secret location, and workflow path must match the final home. Until D1 is settled, agents cannot safely mass-update links in **Phase 5.1** (topology), **Phase 5.4** (workflows), or **Phase 6.1** (`data/README.md` citation URLs).

### 3. Options

| | **A — Standalone repo** `The-Tech-Bay/khobz-index` | **B — Monorepo path** `The-Tech-Bay/karama/tree/main/khobz-index` |
|---|------|------|
| **Pros** | Clear open-data credibility; own Issues/Stars/Releases; matches ship plan and landing footer (`Layout.tsx` already points here); workflows already exist under `khobz-index/.github/workflows/` | One checkout for Karama + KKI; parent `docs/kki/` links stay valid without copying; simpler for a solo dev who never splits |
| **Cons** | One-time export (`git subtree split`); parent-only docs must be copied or relinked (**D3**); two places to sync if development stays in monorepo | README CI section currently **contradicts** local workflows; public visitors see a private-app monorepo; weaker “independent index” story |
| **Effort** | Medium (export + secret migration + link sweep) | Low short-term; ongoing confusion for external contributors |
| **Reversibility** | Hard — splitting is easier than merging back cleanly | Medium — can still split later, but public links may already point at monorepo paths |
| **Risk** | Sync drift if monorepo remains dev source without a mirror process | External researchers bookmark monorepo paths tied to a **private** parent repo narrative |

### 4. What each option changes (concrete examples)

| Surface | Option A (standalone) | Option B (monorepo) |
|---------|----------------------|---------------------|
| `README.md` CI block | Points to `khobz-index/.github/workflows/` in **this** repo | Keeps “workflows live in parent `.github/workflows/`” |
| `data/README.md` | `https://github.com/The-Tech-Bay/khobz-index/releases/...` | `https://github.com/The-Tech-Bay/karama/tree/main/khobz-index/data/...` |
| GitHub Actions secrets | Stored on **`khobz-index`** repo | Stored on **`karama`** repo (current runbook mentions `i-bkf/karama`) |
| `landing/src/components/Layout.tsx` | Footer link unchanged | Footer link would need rewrite to monorepo path |
| Research doc links | Broken until **D3** copies parent `docs/kki/*` | Links like `../../../docs/kki/kki_research.md` keep working **inside** monorepo only |

### 5. Recommended default

**Option A — standalone `The-Tech-Bay/khobz-index`.**

**Caveat:** If you are **months away** from any public GitHub push and all work stays in the private monorepo, Option B avoids premature link churn — but you will still need Option A (or equivalent) before journalists treat KKI as an independent open index.

### 6. Suggested combo (standalone public index goal)

**A** — always pair with **D3-A** (copy research into the public tree) and **D4-A or D4-B** (new canonical domain either way).

### 7. Questions to ask yourself

- Do we want external economists/journalists to cite **`github.com/The-Tech-Bay/khobz-index`** without mentioning the Karama app repo?
- Are we willing to run **`git subtree split`** (or equivalent) once before launch, and document how monorepo ↔ public repo stay in sync?
- Where should Cloudflare/GitHub **secrets** live long term — on the public index repo or the private app repo?
- Is the landing footer GitHub link (`The-Tech-Bay/khobz-index`) already the brand we want to keep?

---

## D2 — README “Used By Karama” section

### 1. What you're deciding

How the README mentions **Karama** — as a short credit, a separate integration note, or not at all.

### 2. Why it matters now

Phase 0 found the current **Used By** block reads like a **runtime dependency** (“promise-tracking app that uses KKI”). That blocks **Phase 1.1** completion and **Phase 5.2** (README must stand alone for open-source visitors). The ship plan also says: **do not remove Karama attribution entirely** — rewrite as origin/creator context.

### 3. Options

| | **A — Attribution footnote** | **B — Integration appendix** | **C — Maximum neutral attribution** |
|---|------|------|------|
| **Pros** | Keeps origin story in one glance; satisfies “created by Karama”; minimal README length | README reads fully standalone; Karama details moved to `docs/integration/karama.md` (or similar); good for OSS norms | Maximum “neutral index” framing; no app coupling; still allows one institutional origin line |
| **Cons** | Easy to misread as “you need Karama to use KKI” if wording isn’t careful | Extra doc to maintain; one more link to keep current | If the origin line is removed entirely, it violates the ship rule and makes the Karama name harder to explain |
| **Effort** | Low (rewrite 2–3 sentences) | Low–medium (new short doc + README link) | Low |
| **Reversibility** | High | High | Medium (harder to explain “Karama Khobz Index” name later) |
| **Risk** | Stakeholders still confuse index with app | Appendix may be ignored | Press/legal may ask why brand name includes “Karama” with no explanation |

### 4. What each option changes (concrete examples)

| Surface | Option A | Option B | Option C |
|---------|----------|----------|----------|
| `README.md` § Used By | e.g. “**Origin:** Created by the Karama project. **Also used by:** the Karama promise-tracking app (optional consumer).” | Replace section with “See [Karama integration](./docs/integration/karama.md)” | Delete § Used By entirely; keep only a neutral line such as “Published by The Tech Bay. Originally developed through the Karama project.” |
| `docs/methodology.md` | May add one line: “KKI is published independently of any single app.” | Same + integration doc covers JWT/API consumer | No origin pointer |
| Press / communication kit | Still say “Karama Khobz Index” with creator context | Same | Must rely on name alone |
| Current link | Today: `[Karama](https://karama.thebay.ma)` — URL also depends on **D4** | Integration doc links to app + API docs | — |

### 5. Recommended default

**Option A — attribution footnote**, tightened so it cannot be read as a dependency.

Example shape (not final copy):

> **Origin:** KKI was created by the [Karama](https://karama.thebay.ma) project.  
> **Optional consumer:** The Karama app uses KKI for inflation anchoring; journalists and researchers can use the public landing page and data archive without the app.

**Caveat:** If README length and “pure data product” tone matter more than a visible footnote, **Option B** is a close second and equally compliant with ship rules.

### 6. Suggested combo (standalone public index goal)

**A, B, or C-with-origin-line** — never remove Karama origin entirely for a launch that keeps the **Karama Khobz Index** public name.

Pair with **D4**: link to **`https://khobz-index.thebay.ma`** for public KKI, not legacy `/khobz` path.

### 7. Questions to ask yourself

- Should a journalist opening the README understand KKI **without** installing Karama?
- Is “Created by Karama” important for brand continuity and the index name?
- Do we want API/JWT integration details in the README or in a separate integration doc?
- Are we okay linking to the Karama **app** site, or only to neutral pages (landing + GitHub)?

---

## D3 — Long-form research document on the public site

### 1. What you're deciding

Where **`kki_research.md`** (500+ lines of methodology, risks, API/architecture spec) lives for **public** visitors — inside the public repo, summarized only, or on another website.

### 2. Why it matters now

The landing **Methodology** page already links to  
`github.com/The-Tech-Bay/khobz-index/blob/main/docs/kki/kki_research.md` — but that file **does not exist** in `khobz-index/` today (it lives in the parent repo `docs/kki/`). That link **404s** after standalone export unless you fix placement. This blocks **Phase 2.2**, **Phase 3.2**, and link checks in **Phase 7**.

The research doc also contains **Karama app context** (settlement, closed API) mixed with science — Phase 2 must mark **implemented vs roadmap** before publication.

### 3. Options

| | **A — Copy/split into public repo** | **B — Public methodology only** | **C — External host** (e.g. `docs.thebay.ma`) |
|---|------|------|------|
| **Pros** | One GitHub home for “open methodology”; satisfies researcher expectations; enables Phase 2.2–2.4 in tree | Fastest; no duplicate maintenance of 500 lines; `docs/methodology.md` becomes single public spec | Can keep monorepo as authoring source; pretty rendering possible |
| **Cons** | Must split “implemented v1.0” vs “roadmap”; several parent docs (`kki-data-quality.md`, etc.) may also need copying | Loses depth (index theory, failure modes, risk register); Methodology page link must change | **Third URL** to maintain; weaker “everything on GitHub” OSS story; citation fragmentation |
| **Effort** | Medium–high (copy + annotate + fix ~15 cross-links in `stack.md`, `data-schema.md`, etc.) | Low | Medium (hosting + redirect policy + sync) |
| **Reversibility** | High (files stay in repo) | High | Medium (URLs in the wild) |
| **Risk** | Overstates pipeline if Phase 2.2 labeling skipped | Experts may assume project hides detail | Link rot if subdomain neglected |

### 4. What each option changes (concrete examples)

| Surface | Option A | Option B | Option C |
|---------|----------|----------|----------|
| `landing/src/pages/MethodologyPage.tsx` | Link stays GitHub → `docs/kki/kki_research.md` in public repo | Link → `docs/methodology.md` on GitHub or on-site Methodology page only | Link → external HTTPS URL |
| `docs/methodology.md` footer | “Canonical research: `docs/kki/kki_research.md`” (in-repo) | Becomes the deepest public doc | Points off-repo |
| `docs/architecture/stack.md` | ~10 links to `../../../docs/kki/kki_research.md` become in-repo paths | Links removed or point to methodology | Links to external host |
| `data/README.md` | Can cite in-repo research §7.2 for archive/API policy | Cites methodology only | Cites external URL |
| Phase 2.2 scope | Full reconcile of research + roadmap markers | Minimal (methodology only) | Editorial pass on hosted copy |

### 5. Recommended default

**Option A — copy/split into public repo** with explicit **Implemented in v1.0** / **Roadmap** banners (Phase 2.2).

**Caveat:** If launch deadline is tight and audience is general public (not academic), **Option B** is acceptable for v1 launch **if** you commit to publishing deep research in a follow-up release — but fix the Methodology page link in the same pass to avoid a 404.

### 6. Suggested combo (standalone public index goal)

**A**, with **`docs/methodology.md`** as the readable front door and **`docs/kki/kki_research.md`** as the deep reference — both in **`The-Tech-Bay/khobz-index`**.

Requires **D1-A** (standalone repo) or copies become orphaned in monorepo-only paths.

### 7. Questions to ask yourself

- Will journalists or academics expect a **long GitHub methodology paper**, not just a landing FAQ?
- Can we afford Phase 2.2 effort to label **implemented vs planned** before copying?
- Is any content in `kki_research.md` still **private product strategy** that should stay out of the public repo?
- Do we want **one URL** (GitHub) for citations, or are we okay with split hosting?

---

## D4 — Legacy URL `karama.thebay.ma/khobz`

### 1. What you're deciding

What happens to the **old KKI path on the Karama app domain** when the standalone landing moves to **`https://khobz-index.thebay.ma`**.

### 2. Why it matters now

Many surfaces still declare the legacy URL as **canonical** (search engines and social previews follow this):

- `landing/index.html` — canonical, Open Graph, Twitter, JSON-LD
- `docs/methodology.md` — “methodology landing page at karama.thebay.ma/khobz”
- Mobile app i18n — `learnMoreUrl` (parent repo)
- Press boilerplate in `channel-copy.md`

Until D4 is settled, **Phase 3.1** (SEO), **Phase 3.3** (app links), and **Phase 4.1** (Cloudflare domain + redirect rule) cannot be completed consistently.

**Target identity (already agreed in ship plan):** public landing **`https://khobz-index.thebay.ma`**. There is no public KKI API for v1; any API hostname remains private/internal unless a later release explicitly opens it.

### 3. Options

| | **A — Redirect legacy → new domain** | **B — Hard cutover (no redirect)** |
|---|------|------|
| **Pros** | Bookmarks, old press links, and app deep links keep working; SEO equity transfers; you can still **update all new copy** to `khobz-index.thebay.ma` | Cleanest story (“one canonical URL”); no long-term dependency on app domain for index |
| **Cons** | Requires Cloudflare redirect rule on Karama zone; legacy URL may linger in analytics | **Broken links** anywhere still pointing at `/khobz`; bad UX if Karama app still opens old URL |
| **Effort** | Low infra (redirect rule) + medium copy sweep (same as B for new surfaces) | Medium copy sweep only; no redirect setup |
| **Reversibility** | High (remove redirect later) | Medium (once cut, old URL dead) |
| **Risk** | Users briefly see domain change in browser bar | 404s for shared links; SEO duplicate-content if both URLs serve content without redirect |

**Important:** Option A is **not** “keep using legacy URL in new copy.” It means: **publish everything new on `khobz-index.thebay.ma`**, and **redirect** old paths for compatibility.

### 4. What each option changes (concrete examples)

| Surface | Both options (new canonical) | Option A additionally | Option B only |
|---------|-------------------------------|----------------------|---------------|
| `landing/index.html` | `canonical`, `og:url`, JSON-LD → `https://khobz-index.thebay.ma/` | — | Legacy URL must disappear everywhere with no safety net |
| Cloudflare | Custom domain on Pages project `khobz-index-landing` | Redirect `karama.thebay.ma/khobz*` → new domain | No redirect |
| `apps/mobile/.../i18n/*.ts` | `learnMoreUrl` → `https://khobz-index.thebay.ma` | Old links still work via redirect | Old app versions break until updated |
| `docs/ops/runbook.md` | Production URLs updated | Documents redirect for ops | Documents cutover date |
| `channel-copy.md` | Press boilerplate uses new domain | May mention “formerly at …” once | Must not mention legacy URL |
| `kilocalorie-index.thebay.ma` | Optional scientific-name alias → `https://khobz-index.thebay.ma` | Same redirect posture as legacy URL | Redirect can still exist even if legacy Karama path is hard-cut |

### 5. Recommended default

**Option A — redirect + hard update of all new canonical/OG/app links** to `khobz-index.thebay.ma`.

**Caveat:** Choose **Option B** only if you control **every** consumer (app store build, press kit, bookmarks) and can update them **before** launch day with zero external links outstanding.

### 6. Suggested combo (standalone public index goal)

**A** — new canonical everywhere, legacy path redirects for ≥12 months (document sunset in runbook).

Independent of **D1** and **D2**; pairs with **D2-A/B** (README links to landing, not `/khobz`).

### 7. Questions to ask yourself

- Does anything **live in production** still link to `karama.thebay.ma/khobz` (app, emails, press)?
- Who can add a **Cloudflare redirect** on the Karama zone?
- Do we need private/internal API docs updated in the same release window (**Phase 4.2**) without presenting an official public API?
- Are we willing to accept a **visible domain change** for users hitting old links (redirect) vs broken links (cutover)?

---

## Recommended combination for a typical standalone launch

For the stated goal — **standalone public index** with scientific credibility and minimal broken links:

| Decision | Recommended choice | One-line why |
|----------|-------------------|--------------|
| **D1** | **A** — `The-Tech-Bay/khobz-index` | Matches ship plan, landing footer, and open-data expectations |
| **D2** | **A** — attribution footnote (or **B** if you prefer a separate integration doc) | Keeps “Karama Khobz Index” honest without implying app dependency |
| **D3** | **A** — copy/split research into public repo with v1.0 vs roadmap labels | Fixes Methodology 404 and supports serious citations |
| **D4** | **A** — redirect legacy `/khobz` + new canonical on `khobz-index.thebay.ma` | Protects existing links while establishing standalone domain |

**Execution order after decisions are recorded:**

1. **D1 + D4** — unlock domain and GitHub mass edits (Phases 4, 5.1, 5.4, 3.1, 3.3).
2. **D3** — unlock research copy + Phase 2.2–2.4 and Methodology link fix.
3. **D2** — finalize README (Phase 5.2).
4. Phase 2 Task 2.1 (`methodology.md`) can run in parallel once D3 direction is known.

---

## Decisions recorded

| ID | Choice (A / B / C) | Date | Owner | Notes |
|----|-------------------|------|-------|-------|
| D1 | A — standalone repo | 2026-05-26 | Smail | Public GitHub home will be `The-Tech-Bay/khobz-index`, exported from the inline monorepo directory when launch-ready. |
| D2 | C — maximum neutral index, with minimal origin attribution | 2026-05-26 | Smail | README should avoid “Used By Karama” dependency framing. Use neutral institutional wording such as “Published by The Tech Bay. Originally developed through the Karama project.” |
| D3 | A — copy/split research into public repo | 2026-05-26 | Smail | Keep GitHub and landing page as the go-to public references for researchers and scientists; label implemented v1.0 vs roadmap before publication. |
| D4 | B — hard cutover | 2026-05-26 | Smail | Canonical landing is `https://khobz-index.thebay.ma`; no `.com` purchase for now. Add `https://kilocalorie-index.thebay.ma` as a scientific-name redirect to the canonical landing. No public KKI API for v1. |

---

## References

- Ship operating rule: do not remove Karama attribution; rewrite as origin — [`ship-todo.md`](../../ship-todo.md) § Operating Rules
- Public repo export path: `git subtree split --prefix=khobz-index` — [`ship-todo.md`](../../ship-todo.md) § Public Repo Export Strategy
- Current README “Used By”: [`README.md`](../../README.md)
- Broken research link: [`landing/src/pages/MethodologyPage.tsx`](../../landing/src/pages/MethodologyPage.tsx)
- Legacy canonical URLs: [`landing/index.html`](../../landing/index.html)
