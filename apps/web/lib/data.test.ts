import { describe, expect, it } from "vitest";
import { getRatios, getSignals } from "./data";

describe("fixture data seam", () => {
  it("normalizes the supported ticker", async () => {
    const result = await getRatios(" aapl ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.company.ticker).toBe("AAPL");
      expect(result.data.filing.form).toBe("10-K");
      expect(result.data.ratios).toHaveLength(8);
      expect(result.data.ratios.find((ratio) => ratio.id === "runway")).toMatchObject({
        value: null,
        note: "Operating cash flow is positive for FY2025, so the company has no cash burn.",
      });
    }
  });

  it("returns a specific fixture refusal for unsupported tickers", async () => {
    const result = await getRatios("msft");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.reason).toBe("unknown-ticker");
      expect(result.refusal.message).toBe(
        "MSFT is not present in the committed preview fixture. Try AAPL.",
      );
    }
  });

  it("returns only quotes that match their exact locator", async () => {
    const result = await getSignals("AAPL");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.signals).not.toHaveLength(0);
    for (const signal of result.data.signals) {
      const section = result.data.sections.find(
        (candidate) => candidate.id === signal.locator.sectionId,
      );
      expect(section).toBeDefined();
      expect(
        section?.text.slice(
          signal.locator.offset,
          signal.locator.offset + signal.quote.length,
        ),
      ).toBe(signal.quote);
    }
  });
});
