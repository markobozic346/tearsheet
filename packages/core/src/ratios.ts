import type { Ratio, XbrlFact } from "./types.js";

/**
 * Compute every ratio from XBRL facts. Pure — no I/O, no LLM, no formatting.
 *
 * A concept the filer didn't tag yields `value: null` with a `note`, never a
 * guess and never 0.
 *
 * STUB — implemented in the `core` issue.
 */
export function computeRatios(_facts: XbrlFact[]): Ratio[] {
  return [];
}
