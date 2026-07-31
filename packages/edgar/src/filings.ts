import type { Cik, FilingRef, Result } from "@repo/core";
import { ok, refuse } from "@repo/core";
import { DAY_MS, fetchRefusal, fetchSec } from "./http.js";

/** Column arrays from `submissions/CIK{cik}.json` → `filings.recent`, newest first. */
export type RecentFilings = {
  accessionNumber: string[];
  form: string[];
  filingDate: string[];
  reportDate: string[];
  primaryDocument: string[];
};

const FUND_FORMS = new Set(["N-CSR", "N-CSRS", "N-CEN", "N-1A", "NPORT-P", "485BPOS"]);

/**
 * Pick the most recent 10-K from a filer's recent filings. Amendments (10-K/A)
 * are skipped deliberately: they are often partial and the original filing —
 * still present in the list — carries the full sections.
 */
export function selectLatestTenK(
  companyName: string,
  cik: Cik,
  recent: RecentFilings,
): Result<FilingRef> {
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== "10-K") continue;
    const accessionNumber = recent.accessionNumber[i];
    const primaryDocument = recent.primaryDocument[i];
    if (!accessionNumber || !primaryDocument) continue;
    return ok({
      accessionNumber,
      form: "10-K",
      filingDate: recent.filingDate[i] ?? "",
      reportDate: recent.reportDate[i] ?? "",
      documentUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber.replace(/-/g, "")}/${primaryDocument}`,
    });
  }

  const forms = new Set(recent.form);
  if (forms.has("20-F")) {
    return refuse(
      "no-10k",
      `${companyName} files Form 20-F as a foreign private issuer, not a 10-K.`,
    );
  }
  if (forms.has("40-F")) {
    return refuse(
      "no-10k",
      `${companyName} files Form 40-F as a Canadian issuer, not a 10-K.`,
    );
  }
  if ([...forms].some((f) => FUND_FORMS.has(f))) {
    return refuse(
      "no-10k",
      `${companyName} is a registered fund and files fund reports, not 10-Ks.`,
    );
  }
  return refuse("no-10k", `${companyName} has no 10-K among its recent SEC filings.`);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v : ""));
}

export function parseSubmissions(
  json: unknown,
): { name: string; recent: RecentFilings } | undefined {
  if (typeof json !== "object" || json === null) return undefined;
  const root = json as Record<string, unknown>;
  const filings = root.filings;
  if (typeof filings !== "object" || filings === null) return undefined;
  const recent = (filings as Record<string, unknown>).recent;
  if (typeof recent !== "object" || recent === null) return undefined;
  const cols = recent as Record<string, unknown>;
  return {
    name: typeof root.name === "string" ? root.name : "This filer",
    recent: {
      accessionNumber: stringArray(cols.accessionNumber),
      form: stringArray(cols.form),
      filingDate: stringArray(cols.filingDate),
      reportDate: stringArray(cols.reportDate),
      primaryDocument: stringArray(cols.primaryDocument),
    },
  };
}

/** Most recent 10-K. Refuses `no-10k` for 20-F/40-F filers and funds. */
export async function getLatestFiling(cik: Cik): Promise<Result<FilingRef>> {
  const outcome = await fetchSec(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    key: `submissions-CIK${cik}.json`,
    maxAgeMs: DAY_MS,
  });
  if (outcome.kind !== "ok")
    return fetchRefusal("the filer's submission history", outcome);

  let json: unknown;
  try {
    json = JSON.parse(outcome.body);
  } catch {
    return refuse("fetch-failed", "SEC's submissions feed came back malformed.");
  }

  const parsed = parseSubmissions(json);
  if (!parsed) {
    return refuse("fetch-failed", "SEC's submissions feed came back malformed.");
  }
  return selectLatestTenK(parsed.name, cik, parsed.recent);
}
