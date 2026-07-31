import { extractSignals } from "@repo/agents";
import type { Result, Tearsheet } from "@repo/core";
import { computeRatios } from "@repo/core";
import { getLatestFiling, getSections, getXbrlFacts, resolveTicker } from "@repo/edgar";

export type RatiosData = Pick<Tearsheet, "company" | "filing" | "ratios">;
export type SignalsData = Pick<Tearsheet, "filing" | "sections" | "signals">;

/**
 * The live pipeline behind the deterministic phase: SEC EDGAR facts through
 * the pure ratio engine. Every step can refuse; the refusal is returned as-is
 * for the UI to render verbatim.
 */
export async function getRatios(ticker: string): Promise<Result<RatiosData>> {
  const company = await resolveTicker(ticker);
  if (!company.ok) {
    return company;
  }

  const filing = await getLatestFiling(company.data.cik);
  if (!filing.ok) {
    return filing;
  }

  const facts = await getXbrlFacts(company.data.cik);
  if (!facts.ok) {
    return facts;
  }

  return {
    ok: true,
    data: {
      company: company.data,
      filing: filing.data,
      ratios: computeRatios(facts.data),
    },
  };
}

/**
 * The live pipeline behind the grounded phase: section extraction, model
 * read, then in-code quote validation. Unverifiable signals never arrive here.
 */
export async function getSignals(ticker: string): Promise<Result<SignalsData>> {
  const company = await resolveTicker(ticker);
  if (!company.ok) {
    return company;
  }

  const filing = await getLatestFiling(company.data.cik);
  if (!filing.ok) {
    return filing;
  }

  const sections = await getSections(filing.data);
  if (!sections.ok) {
    return sections;
  }

  const signals = await extractSignals(sections.data);
  if (!signals.ok) {
    return signals;
  }

  return {
    ok: true,
    data: {
      filing: filing.data,
      sections: sections.data,
      signals: signals.data,
    },
  };
}
