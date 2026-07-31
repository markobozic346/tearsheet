import { describe, expect, it } from "vitest";
import { formatRatioValue } from "./ratios-table";

describe("formatRatioValue", () => {
  it("formats the display units in the web layer", () => {
    expect(formatRatioValue(391_000_000_000, "usd")).toBe("$391.0B");
    expect(formatRatioValue(0.462, "percent")).toBe("46.2%");
    expect(formatRatioValue(18, "months")).toBe("18 months");
    expect(formatRatioValue(0.79, "ratio")).toBe("0.79×");
  });

  it("keeps negative currency signs outside the dollar symbol", () => {
    expect(formatRatioValue(-3_200_000_000, "usd")).toBe("−$3.2B");
  });

  it("uses the singular month label", () => {
    expect(formatRatioValue(1, "months")).toBe("1 month");
  });
});
