import type { Section, Signal } from "@repo/core";

/**
 * Drop any signal whose `quote` does not appear verbatim in its cited section,
 * and stamp the surviving ones with the offset where it was found.
 *
 * This is the trust boundary of the whole system, and it is deliberately a pure
 * function so it can be tested without calling a model.
 *
 * STUB — implemented in the `agents` issue.
 */
export function validateQuotes(_signals: Signal[], _sections: Section[]): Signal[] {
  return [];
}
