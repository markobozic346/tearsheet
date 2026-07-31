import { extractSignals } from "@repo/agents";
import type { FilingRef, Refusal, Result, Tearsheet } from "@repo/core";
import { computeRatios } from "@repo/core";
import { getLatestFiling, getSections, getXbrlFacts, resolveTicker } from "@repo/edgar";
import { unstable_cache } from "next/cache";

export type RatiosData = Pick<Tearsheet, "company" | "filing" | "ratios">;
export type SignalsData = Pick<Tearsheet, "filing" | "sections" | "signals">;

/** Lets a refusal escape `unstable_cache` uncached — only successes persist. */
class RefusalCarrier extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.message);
  }
}

/**
 * The expensive phase — section extraction plus the model read — cached forever
 * in Next's data cache. The filing argument keys the entry, so this runs once
 * per accession number: filings are immutable, and a new 10-K is a new key.
 */
const cachedExtraction = unstable_cache(
  async (filing: FilingRef): Promise<SignalsData> => {
    const sections = await getSections(filing);
    if (!sections.ok) {
      throw new RefusalCarrier(sections.refusal);
    }

    const signals = await extractSignals(sections.data);
    if (!signals.ok) {
      throw new RefusalCarrier(signals.refusal);
    }

    return { filing, sections: sections.data, signals: signals.data };
  },
  ["signal-extraction"],
  { revalidate: false },
);

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

  try {
    return { ok: true, data: await cachedExtraction(filing.data) };
  } catch (error) {
    if (error instanceof RefusalCarrier) {
      return { ok: false, refusal: error.refusal };
    }
    throw error;
  }
}
