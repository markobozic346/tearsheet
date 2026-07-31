import type { Company, FilingRef, Section, XbrlFact } from "@repo/core";
import { ok, refuse } from "@repo/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRatios, getSignals } from "./data";

vi.mock("@repo/edgar", () => ({
  resolveTicker: vi.fn(),
  getLatestFiling: vi.fn(),
  getXbrlFacts: vi.fn(),
  getSections: vi.fn(),
}));

vi.mock("@repo/agents", () => ({
  extractSignals: vi.fn(),
}));

const edgar = vi.mocked(await import("@repo/edgar"));
const agents = vi.mocked(await import("@repo/agents"));

const company: Company = { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." };

const filing: FilingRef = {
  accessionNumber: "0000320193-25-000123",
  form: "10-K",
  filingDate: "2025-11-01",
  reportDate: "2025-09-27",
  documentUrl:
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000123/aapl.htm",
};

const fact: XbrlFact = {
  concept: "NetIncomeLoss",
  value: 112_010_000_000,
  unit: "USD",
  fiscalYear: 2025,
  fiscalPeriod: "FY",
  end: "2025-09-27",
  form: "10-K",
};

const section: Section = {
  id: "risk-factors",
  title: "Item 1A. Risk Factors",
  text: "The business faces material risks.",
  charStart: 0,
  charEnd: 34,
};

beforeEach(() => {
  vi.resetAllMocks();
  edgar.resolveTicker.mockResolvedValue(ok(company));
  edgar.getLatestFiling.mockResolvedValue(ok(filing));
  edgar.getXbrlFacts.mockResolvedValue(ok([fact]));
  edgar.getSections.mockResolvedValue(ok([section]));
  agents.extractSignals.mockResolvedValue(ok([]));
});

describe("getRatios", () => {
  it("threads company and filing through to computed ratios", async () => {
    const result = await getRatios("AAPL");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.company).toEqual(company);
      expect(result.data.filing).toEqual(filing);
      expect(result.data.ratios).toHaveLength(8);
      expect(result.data.ratios.find((ratio) => ratio.id === "net-income")?.value).toBe(
        112_010_000_000,
      );
    }
  });

  it.each([
    ["resolveTicker", () => edgar.resolveTicker, "unknown-ticker"],
    ["getLatestFiling", () => edgar.getLatestFiling, "no-10k"],
    ["getXbrlFacts", () => edgar.getXbrlFacts, "no-xbrl-facts"],
  ] as const)("passes a %s refusal through verbatim", async (_step, mock, reason) => {
    mock().mockResolvedValue(refuse(reason, "A sentence a user should read."));

    const result = await getRatios("AAPL");

    expect(result).toEqual({
      ok: false,
      refusal: { reason, message: "A sentence a user should read." },
    });
  });
});

describe("getSignals", () => {
  it("threads filing, sections, and validated signals", async () => {
    const result = await getSignals("AAPL");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.filing).toEqual(filing);
      expect(result.data.sections).toEqual([section]);
      expect(result.data.signals).toEqual([]);
    }
    expect(agents.extractSignals).toHaveBeenCalledWith([section]);
  });

  it.each([
    ["getSections", () => edgar.getSections, "section-not-found"],
    ["extractSignals", () => agents.extractSignals, "fetch-failed"],
  ] as const)("passes a %s refusal through verbatim", async (_step, mock, reason) => {
    mock().mockResolvedValue(refuse(reason, "A sentence a user should read."));

    const result = await getSignals("AAPL");

    expect(result).toEqual({
      ok: false,
      refusal: { reason, message: "A sentence a user should read." },
    });
  });
});
