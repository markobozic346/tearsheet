import { describe, expect, it } from "vitest";

import aaplFacts from "../../../fixtures/aapl-companyfacts.json" with { type: "json" };
import { computeRatios } from "./ratios";
import type { Ratio, RatioId, XbrlFact } from "./types";

const REVENUE_CONCEPT = "RevenueFromContractWithCustomerExcludingAssessedTax";
const COST_CONCEPT = "CostOfGoodsAndServicesSold";
const CASH_FLOW_CONCEPT = "NetCashProvidedByUsedInOperatingActivities";

function ratioById(ratios: Ratio[], id: RatioId): Ratio {
  const ratio = ratios.find((candidate) => candidate.id === id);

  if (!ratio) {
    throw new Error(`Missing ratio: ${id}`);
  }

  return ratio;
}

describe("computeRatios", () => {
  it("computes all eight ratios when the company has operating cash burn", () => {
    const factsWithBurn: XbrlFact[] = aaplFacts.map((fact) =>
      fact.concept === CASH_FLOW_CONCEPT ? { ...fact, value: -fact.value } : fact,
    );

    const ratios = computeRatios(factsWithBurn);

    expect(ratios).toHaveLength(8);
    expect(ratios.every((ratio) => ratio.value !== null)).toBe(true);
    expect(ratioById(ratios, "revenue").value).toBe(416_161_000_000);
    expect(ratioById(ratios, "net-income").value).toBe(112_010_000_000);
    expect(ratioById(ratios, "net-margin").value).toBeCloseTo(
      112_010_000_000 / 416_161_000_000,
    );
    expect(ratioById(ratios, "cash").value).toBe(35_934_000_000);
    expect(ratioById(ratios, "runway").value).toBeCloseTo(
      35_934_000_000 / (111_482_000_000 / 12),
    );
    expect(ratioById(ratios, "liabilities-to-assets").value).toBeCloseTo(
      285_508_000_000 / 359_241_000_000,
    );
  });

  it("computes AAPL gross margin in a sane band", () => {
    const grossMargin = ratioById(computeRatios(aaplFacts), "gross-margin");

    expect(grossMargin.value).not.toBeNull();
    expect(grossMargin.value).toBeGreaterThan(0.4);
    expect(grossMargin.value).toBeLessThan(0.5);
  });

  it("computes revenue growth from the two most recent fiscal-year ends", () => {
    const revenueGrowth = ratioById(computeRatios(aaplFacts), "revenue-growth");
    const expectedGrowth = (416_161_000_000 - 391_035_000_000) / 391_035_000_000;

    expect(revenueGrowth.value).toBeCloseTo(expectedGrowth);
    expect(revenueGrowth.period).toBe("FY2025");
  });

  it("returns a noted null revenue growth when the prior fiscal year is missing", () => {
    const factsWithGapYear = aaplFacts.filter(
      (fact) => fact.concept !== REVENUE_CONCEPT || fact.end !== "2024-09-28",
    );

    const revenueGrowth = ratioById(computeRatios(factsWithGapYear), "revenue-growth");

    expect(revenueGrowth.value).toBeNull();
    expect(revenueGrowth.note).toBe(
      `Revenue growth requires ${REVENUE_CONCEPT} or Revenues or SalesRevenueNet for two consecutive fiscal years.`,
    );
  });

  it("describes zero revenue as belonging to the prior year", () => {
    const factsWithZeroPriorRevenue: XbrlFact[] = aaplFacts.map((fact) =>
      fact.concept === REVENUE_CONCEPT && fact.end === "2024-09-28"
        ? { ...fact, value: 0 }
        : fact,
    );

    const revenueGrowth = ratioById(
      computeRatios(factsWithZeroPriorRevenue),
      "revenue-growth",
    );

    expect(revenueGrowth.value).toBeNull();
    expect(revenueGrowth.note).toBe(
      "Prior-year revenue is zero, so revenue growth cannot be calculated.",
    );
  });

  it("returns a noted null gross margin when cost of revenue is missing", () => {
    const factsWithoutCost = aaplFacts.filter((fact) => fact.concept !== COST_CONCEPT);

    const grossMargin = ratioById(computeRatios(factsWithoutCost), "gross-margin");

    expect(grossMargin.value).toBeNull();
    expect(grossMargin.note).toContain(COST_CONCEPT);
  });

  it("returns eight noted null ratios for an empty fact list", () => {
    const ratios = computeRatios([]);

    expect(ratios).toHaveLength(8);
    expect(
      ratios.every((ratio) => ratio.value === null && ratio.note !== undefined),
    ).toBe(true);
  });

  it("records the concepts that resolved in calculation order", () => {
    const ratios = computeRatios(aaplFacts);

    expect(ratioById(ratios, "revenue").sourceConcepts).toEqual([REVENUE_CONCEPT]);
    expect(ratioById(ratios, "revenue-growth").sourceConcepts).toEqual([REVENUE_CONCEPT]);
    expect(ratioById(ratios, "gross-margin").sourceConcepts).toEqual([
      REVENUE_CONCEPT,
      COST_CONCEPT,
    ]);
    expect(ratioById(ratios, "net-margin").sourceConcepts).toEqual([
      "NetIncomeLoss",
      REVENUE_CONCEPT,
    ]);
    expect(ratioById(ratios, "runway").sourceConcepts).toEqual([
      "CashAndCashEquivalentsAtCarryingValue",
      CASH_FLOW_CONCEPT,
    ]);
    expect(ratioById(ratios, "liabilities-to-assets").sourceConcepts).toEqual([
      "Liabilities",
      "Assets",
    ]);
  });

  it("records fallback concepts rather than their preferred alternatives", () => {
    const fallbackFacts: XbrlFact[] = aaplFacts.map((fact) => {
      if (fact.concept === REVENUE_CONCEPT) {
        return { ...fact, concept: "SalesRevenueNet" };
      }

      if (fact.concept === COST_CONCEPT) {
        return { ...fact, concept: "CostOfRevenue" };
      }

      return fact;
    });

    const ratios = computeRatios(fallbackFacts);

    expect(ratioById(ratios, "revenue").sourceConcepts).toEqual(["SalesRevenueNet"]);
    expect(ratioById(ratios, "gross-margin").sourceConcepts).toEqual([
      "SalesRevenueNet",
      "CostOfRevenue",
    ]);
  });

  it("returns a noted null runway for positive operating cash flow", () => {
    const runway = ratioById(computeRatios(aaplFacts), "runway");

    expect(runway.value).toBeNull();
    expect(runway.note).toContain("positive");
  });

  it("is independent of comparative-fact input order", () => {
    expect(computeRatios([...aaplFacts].reverse())).toEqual(computeRatios(aaplFacts));
  });
});
