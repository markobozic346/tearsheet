import type { Section, Signal } from "@repo/core";

/**
 * Drop any signal whose `quote` does not appear verbatim in its cited section,
 * and stamp the surviving ones with the offset where it was found.
 *
 * This is the trust boundary of the whole system, and it is deliberately a pure
 * function so it can be tested without calling a model.
 */
export function validateQuotes(signals: Signal[], sections: Section[]): Signal[] {
  const validated: Signal[] = [];

  for (const signal of signals) {
    if (signal.quote.length === 0) {
      continue;
    }

    const section = sections.find(({ id }) => id === signal.locator.sectionId);
    if (!section) {
      continue;
    }

    const offset = section.text.indexOf(signal.quote);
    if (offset === -1) {
      continue;
    }

    validated.push({
      ...signal,
      locator: {
        ...signal.locator,
        offset,
      },
    });
  }

  return validated;
}
