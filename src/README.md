# KKI Source Code

Pipeline, adapters, calculation engine, storage I/O, **static archive** (GitHub / IPFS / IA), and the Cloudflare Workers closed KKI API (`src/api/`).

## Layout (`stack.md` §6.2)

```
src/
  shared/       Zod schemas + adapter types (`schema.ts`); ISO → region map (`countries.ts`)
  adapters/    Re-exports shared types + `createAdapter` stub (per-source modules later)
  engine/      Re-exports `IndexRecord` types + `calculateKKI` stub → full hybrid formula
  storage/      R2 snapshot + manifest reader/writer (§3.4B)
  archive/      §3.6B static publisher: GitHub Release + Pinata + Internet Archive (`runMonthlyArchive`)
  api/          Hono Worker: closed KKI API (`wrangler dev`, §3.5B); deploy polish §3.8B
  pipeline/     Orchestrator (`run.ts`)
```

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict)
- **Tests:** bun:test

## Status

§3.1B.2: `src/shared/schema.ts` (stack.md §2.1 + data-schema.md §1–§3) and `src/shared/countries.ts`; unit tests parse canonical example JSON from `data-schema.md` §2.3 / §3.4.
