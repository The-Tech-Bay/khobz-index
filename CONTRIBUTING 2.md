# Contributing to the Karama Khobz Index (KKI)

Thank you for your interest in contributing. KKI is an open methodology and open dataset — contributions that improve accuracy, coverage, or transparency are welcome.

---

## Ways to Contribute

### Code contributions (source adapters, calculation engine, tooling)

1. Fork this repository
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Install tooling (`bun install`) — installs Git hooks via **Lefthook**
4. Make your changes
5. Run checks locally:
   - `bun run lint` — Biome linter
   - `bun run format:check` — formatter (CI parity)
   - `bun run typecheck` — `tsc --noEmit`
   - `bun run test` — unit tests only (`tests/unit`, **no live APIs**)
   - `LIVE_API=1 bun run test:live` — opt-in integration tests (`tests/live`, `@live`)
6. Commit with a clear message explaining **why** the change exists (pre-commit runs Biome on staged files)
7. Open a Pull Request against `main`

### Data contributions (new regional basket proposals)

1. Open an Issue using the **Basket Proposal** template
2. Include: region, proposed items, caloric calculation, data source availability
3. The BDFL will review and may request a sensitivity analysis before merging

### Source adapter contributions

1. Open an Issue describing the new data source
2. Include: provider reliability tier, publication cadence, API/bulk-CSV access, coverage map
3. If approved, implement the adapter following the existing pattern in `src/`

### Methodology changes

Methodology changes follow a lightweight RFC process:

1. Open an Issue with the title prefix `[RFC]`
2. Describe the proposed change, motivation, and impact on existing published data
3. Allow 14 days for community discussion
4. The BDFL makes the final decision and documents rationale in the merged PR

Minor methodology patches (v1.x: source substitution, alpha tuning) require an RFC Issue.
Major methodology revisions (v2.0: basket composition changes) require an RFC Issue + at least one external review.

---

## Code Style

- **Runtime:** Bun (`>= 1.2`)
- **Language:** TypeScript (strict mode via `tsconfig.json`)
- **Lint / format:** [Biome](https://biomejs.dev/) (`bun run lint`, `bun run format`, `bun run format:check`)
- **Git hooks:** [Lefthook](https://github.com/evilmartians/lefthook) (`pre-commit`: Biome check + write on staged files)
- **Tests:** `bun:test` — default CI runs **fixture-only** unit tests under `tests/unit`. Live HTTP integration tests live under `tests/live` with `describe('@live', …)` and run only with `LIVE_API=1` (see `bun run test:live`).
- **No `any` types** — use explicit types or `unknown` with type guards

---

## Commit Messages

Follow the "why not what" principle:

- Good: `fix: correct LBMA gold price date offset causing 1-day lag in KKI calculation`
- Bad: `update gold.ts`

---

## Versioned Methodology Discipline

A critical rule for all contributors:

> **Never retroactive recalculation.** A KKI number published under v1.0 stays v1.0 forever. If you change the methodology, it becomes v1.1+ and applies only to future calculations.

This means:
- Bug fixes to historical data are published as corrections alongside the original, never overwriting
- Source substitutions produce a new minor version
- Basket revisions produce a new major version

---

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). Be respectful, constructive, and assume good faith.

---

## Questions?

Open an Issue or reach out to the maintainer ([@i-bkf](https://github.com/i-bkf)).
