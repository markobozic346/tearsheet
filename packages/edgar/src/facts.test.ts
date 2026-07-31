import { describe, expect, it } from "vitest";
import { extractAnnualFacts } from "./facts.js";

type Entry = {
  start?: string;
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
};

function companyfacts(concepts: Record<string, Entry[]>): unknown {
  const gaap: Record<string, { units: Record<string, Entry[]> }> = {};
  for (const [concept, entries] of Object.entries(concepts)) {
    gaap[concept] = { units: { USD: entries } };
  }
  return { entityName: "Example Corp.", facts: { "us-gaap": gaap } };
}

const fy = (year: number, val: number): Entry => ({
  start: `${year - 1}-10-01`,
  end: `${year}-09-30`,
  val,
  fy: year,
  fp: "FY",
  form: "10-K",
});

describe("extractAnnualFacts", () => {
  it("resolves revenue through the documented fallback order and records the tag that hit", () => {
    // Primary tag absent — the second one in the list must win.
    const facts = extractAnnualFacts(
      companyfacts({ Revenues: [fy(2024, 100)], NetIncomeLoss: [fy(2024, 10)] }),
    );
    expect(facts.map((f) => f.concept)).toContain("Revenues");
    expect(facts.map((f) => f.concept)).toContain("NetIncomeLoss");
  });

  it("prefers the primary revenue tag when both are present", () => {
    const facts = extractAnnualFacts(
      companyfacts({
        RevenueFromContractWithCustomerExcludingAssessedTax: [fy(2024, 100)],
        Revenues: [fy(2024, 999)],
      }),
    );
    const concepts = facts.map((f) => f.concept);
    expect(concepts).toContain("RevenueFromContractWithCustomerExcludingAssessedTax");
    expect(concepts).not.toContain("Revenues");
  });

  it("keeps only full-year durations — a Q4 tagged fp:FY in the 10-K is dropped", () => {
    const q4: Entry = {
      start: "2024-07-01",
      end: "2024-09-30",
      val: 25,
      fy: 2024,
      fp: "FY",
      form: "10-K",
    };
    const tenQ: Entry = { ...fy(2024, 75), form: "10-Q" };
    const facts = extractAnnualFacts(
      companyfacts({ Revenues: [q4, tenQ, fy(2024, 100)] }),
    );
    expect(facts).toHaveLength(1);
    expect(facts[0]?.value).toBe(100);
    expect(facts[0]?.fiscalYear).toBe(2024);
  });

  it("keeps instant (balance-sheet) facts, which have no start date", () => {
    const instant: Entry = {
      end: "2024-09-30",
      val: 500,
      fy: 2024,
      fp: "FY",
      form: "10-K",
    };
    const facts = extractAnnualFacts(companyfacts({ Assets: [instant] }));
    expect(facts).toEqual([
      {
        concept: "Assets",
        value: 500,
        unit: "USD",
        fiscalYear: 2024,
        fiscalPeriod: "FY",
        end: "2024-09-30",
        form: "10-K",
      },
    ]);
  });

  it("returns [] for filers without us-gaap facts (ETFs, dei-only payloads)", () => {
    expect(extractAnnualFacts({ facts: { dei: {} } })).toEqual([]);
    expect(extractAnnualFacts({})).toEqual([]);
    expect(extractAnnualFacts(null)).toEqual([]);
  });
});
