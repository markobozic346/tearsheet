# packages/core — agent rules

The deterministic heart. This package is where every number in the product is produced.

- **Pure only.** No `fetch`, no `fs`, no network, no LLM, no clock, no randomness. Given
  the same facts, `computeRatios` returns the same ratios forever.
- **Imports nothing.** Not `@repo/edgar`, not `@repo/agents`, no runtime dependencies.
- **`src/types.ts` is FROZEN.** Three other packages compile against it right now.
- **Never guess a missing number.** If the filer didn't tag the concept, the `Ratio` gets
  `value: null` and a `note` naming the missing concept. Not `0`, not an estimate, not a
  value derived from a different period.
- **`sourceConcepts` is the audit trail.** Record the XBRL tags actually used, in the order
  resolved — that's what makes a figure traceable back to the filing.
- **No formatting.** Return raw numbers with a `unit`. Currency symbols, percentages, and
  rounding are the UI's job.
