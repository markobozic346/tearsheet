import type { Section, Signal } from "@repo/core";
import { describe, expect, it } from "vitest";
import { buildSourceExcerpt } from "./signal-cards";

const section: Section = {
  id: "risk-factors",
  title: "Item 1A. Risk Factors",
  text: "Context before. The exact filed words. Context after.",
  charStart: 100,
  charEnd: 153,
};

const signal: Signal = {
  claim: "A grounded claim.",
  category: "risk",
  quote: "The exact filed words.",
  locator: { sectionId: "risk-factors", offset: 16 },
};

describe("buildSourceExcerpt", () => {
  it("highlights the quote at the exact section-relative offset", () => {
    const excerpt = buildSourceExcerpt(section, signal, 50);

    expect(excerpt).not.toBeNull();
    expect(excerpt?.quote).toBe(signal.quote);
    expect(`${excerpt?.before}${excerpt?.quote}${excerpt?.after}`).toBe(section.text);
  });

  it("drops a signal when the quote does not match at its locator", () => {
    expect(
      buildSourceExcerpt(section, {
        ...signal,
        locator: { ...signal.locator, offset: signal.locator.offset + 1 },
      }),
    ).toBeNull();
  });

  it("drops a signal that names a different section", () => {
    expect(
      buildSourceExcerpt(section, {
        ...signal,
        locator: { ...signal.locator, sectionId: "mdna" },
      }),
    ).toBeNull();
  });
});
