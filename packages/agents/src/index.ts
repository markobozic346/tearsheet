import type { Result, Section, Signal } from "@repo/core";

export { validateQuotes } from "./validate.js";

/**
 * Read the qualitative sections and return grounded signal items.
 *
 * Never computes or asserts a number. Every returned Signal has passed
 * `validateQuotes` — unverifiable items are dropped, not repaired.
 */
export async function extractSignals(_sections: Section[]): Promise<Result<Signal[]>> {
  throw new Error("not implemented");
}
