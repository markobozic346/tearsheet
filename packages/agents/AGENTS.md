# packages/agents — agent rules

The signal extractor. The only package allowed to call a model.

- **No arithmetic. No numbers.** This package extracts prose and citations. It never
  computes, compares, ranks, or estimates a figure — that's `@repo/core`'s job, in pure
  TypeScript. A `claim` may quote a number that appears in the filing; it may never
  assert one the model produced.
- **Sections only, never the whole filing.** Input is Risk Factors and MD&A as extracted
  text. Sending the full document is a cost, latency, and precision regression.
- **Structured output only.** `generateObject` from the AI SDK with a Zod schema. No
  free-text parsing, no JSON-from-a-string.
- **`validateQuotes` is the trust boundary.** Every returned signal passes it. It is a pure
  function so it can be tested without a model — keep it that way, and never let a model
  call leak into it.
- **Drop, don't repair.** A quote that isn't found verbatim is discarded. Do not trim,
  normalise whitespace into a match, fuzzy-match, or re-prompt to "fix" it. Returning three
  verified signals beats returning eight with one invented.
- **No live model calls in tests.**
