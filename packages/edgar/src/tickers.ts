import type { Company, Result, Ticker } from "@repo/core";
import { ok, refuse } from "@repo/core";
import { DAY_MS, fetchRefusal, fetchSec } from "./http.js";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

/** Zero-pad a numeric CIK to the canonical 10-digit form. */
export function padCik(cik: number | string): string {
  return String(cik).padStart(10, "0");
}

/**
 * Find a ticker in SEC's company_tickers.json payload, which is an object keyed
 * by row index: `{ "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } }`.
 */
export function findCompany(json: unknown, ticker: Ticker): Company | undefined {
  if (typeof json !== "object" || json === null) return undefined;
  const want = ticker.trim().toUpperCase();
  for (const row of Object.values(json)) {
    if (typeof row !== "object" || row === null) continue;
    const { cik_str, ticker: rowTicker, title } = row as Record<string, unknown>;
    if (typeof cik_str !== "number" || typeof rowTicker !== "string") continue;
    if (rowTicker.toUpperCase() !== want) continue;
    return {
      cik: padCik(cik_str),
      ticker: rowTicker.toUpperCase(),
      name: typeof title === "string" ? title : rowTicker.toUpperCase(),
    };
  }
  return undefined;
}

/** ticker → CIK via SEC's company_tickers.json. Refuses `unknown-ticker`. */
export async function resolveTicker(ticker: Ticker): Promise<Result<Company>> {
  const outcome = await fetchSec(TICKERS_URL, {
    key: "company_tickers.json",
    maxAgeMs: DAY_MS,
  });
  if (outcome.kind !== "ok") return fetchRefusal("SEC's company directory", outcome);

  let json: unknown;
  try {
    json = JSON.parse(outcome.body);
  } catch {
    return refuse("fetch-failed", "SEC's company directory came back malformed.");
  }

  const company = findCompany(json, ticker);
  if (!company) {
    return refuse(
      "unknown-ticker",
      `"${ticker.trim().toUpperCase()}" is not in SEC EDGAR's directory of US-listed companies — check the ticker symbol.`,
    );
  }
  return ok(company);
}
