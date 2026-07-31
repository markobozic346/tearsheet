import type { Section, Signal } from "@repo/core";
import { describe, expect, it } from "vitest";

import fixture from "../../../fixtures/aapl-10k-sections.json" with { type: "json" };

import { validateQuotes } from "./validate.js";

const riskFixture = fixture.sections.find(({ id }) => id === "risk-factors");
const mdnaFixture = fixture.sections.find(({ id }) => id === "mdna");

if (!riskFixture || !mdnaFixture) {
  throw new Error("AAPL fixture must contain Risk Factors and MD&A sections.");
}

const sections: Section[] = [
  { ...riskFixture, id: "risk-factors" },
  { ...mdnaFixture, id: "mdna" },
];

const quote =
  "Macroeconomic conditions, including inflation, interest rates and currency fluctuations, have directly and indirectly impacted, and could in the future materially impact, the Company’s results of operations and financial condition.";

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    claim: "Macroeconomic conditions could materially affect results.",
    category: "risk",
    quote,
    locator: { sectionId: "mdna", offset: 999 },
    ...overrides,
  };
}

describe("validateQuotes", () => {
  it("keeps a verbatim quote and stamps its exact section offset", () => {
    const [validated] = validateQuotes([signal()], sections);

    expect(validated).toEqual({
      ...signal(),
      locator: {
        sectionId: "mdna",
        offset: mdnaFixture.text.indexOf(quote),
      },
    });
  });

  it("drops a quote that is absent", () => {
    expect(
      validateQuotes([signal({ quote: "This sentence was never filed." })], sections),
    ).toEqual([]);
  });

  it.each([
    ["whitespace", quote.replace("interest rates", "interest  rates")],
    ["truncated word", quote.replace("conditions", "condition")],
  ])("drops a near-miss caused by %s without repairing it", (_case, nearMiss) => {
    expect(validateQuotes([signal({ quote: nearMiss })], sections)).toEqual([]);
  });

  it("drops a quote that cites the wrong section", () => {
    expect(
      validateQuotes(
        [signal({ locator: { sectionId: "risk-factors", offset: 0 } })],
        sections,
      ),
    ).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(validateQuotes([], sections)).toEqual([]);
    expect(validateQuotes([signal()], [])).toEqual([]);
  });
});
