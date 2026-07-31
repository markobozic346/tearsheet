# Tearsheet — agent rules

A 10-K in one glance. Read `README.md` for what this is. These are the invariants.
Nearest `AGENTS.md` wins — each package has its own with rules specific to it.

## The two rules that define this project

1. **A model never produces a number.** Every figure comes from SEC XBRL facts and is
   computed in `packages/core` by pure TypeScript. If you find yourself asking a model to
   calculate, compare, or estimate anything numeric, stop — that's the bug.
2. **A claim without a verifiable source is dropped, never repaired.** Every `Signal.quote`
   must appear verbatim in the section it cites. Unverifiable items are discarded in code
   before reaching the UI. Do not "fix up" a near-match, do not fuzzy-match, do not lower
   the bar to keep output non-empty.

## Refuse with a reason

Returning nothing with a specific reason beats returning something plausible. Use
`Result<T>` and the `RefusalReason` union in `packages/core/src/types.ts`. The UI renders
`Refusal.message` verbatim, so write it as a sentence a user should read — name the actual
cause ("Files 20-F, not 10-K"), never a generic failure.

## `packages/core/src/types.ts` is FROZEN

Four packages are built in parallel against it. Changing a shape breaks worktrees that
can't find out until merge. If something is genuinely missing, raise it in the issue
instead of widening the type locally.

## Boundaries

`core` imports nothing. `edgar` and `agents` depend only on `core`. `apps/web` composes
all three. Never introduce an import that reverses this.

## Commands

```bash
pnpm check        # biome + tsc + vitest — must be green before any PR
pnpm test         # vitest across the workspace
pnpm lint         # biome check --write
pnpm dev          # next dev on :3000
```

## Conventions

- Biome for lint and format. No ESLint, no Prettier — don't add them back.
- TypeScript is strict, `noUncheckedIndexedAccess` is on. No `any`, no non-null `!`.
- Tests are colocated as `*.test.ts` next to the code.
- Never call a live model in a test.
- SEC requires a descriptive `SEC_USER_AGENT` and ~10 req/s max. Filings are immutable, so
  everything fetched is cached to disk.

## Scope

Work is tracked in GitHub issues, one per package. Stay inside the files your issue names —
another agent is working in the next package right now, and overlapping edits collide.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `markobozic346/tearsheet`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
