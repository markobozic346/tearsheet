import type {
  Cik,
  Company,
  FilingRef,
  Result,
  Section,
  Ticker,
  XbrlFact,
} from "@repo/core";

/** ticker → CIK via SEC's company_tickers.json. Refuses `unknown-ticker`. */
export async function resolveTicker(_ticker: Ticker): Promise<Result<Company>> {
  throw new Error("not implemented");
}

/** Most recent 10-K. Refuses `no-10k` for 20-F/40-F filers and funds. */
export async function getLatestFiling(_cik: Cik): Promise<Result<FilingRef>> {
  throw new Error("not implemented");
}

/** Structured numbers from companyfacts. Refuses `no-xbrl-facts`. */
export async function getXbrlFacts(_cik: Cik): Promise<Result<XbrlFact[]>> {
  throw new Error("not implemented");
}

/**
 * Extract Item 1A (Risk Factors) and Item 7 (MD&A) as plain text.
 *
 * Must not confuse a table-of-contents entry for the section itself — refuses
 * `section-not-found` rather than returning a stub.
 */
export async function getSections(_filing: FilingRef): Promise<Result<Section[]>> {
  throw new Error("not implemented");
}
