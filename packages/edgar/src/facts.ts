import type { Cik, Result, XbrlFact } from "@repo/core";
import { ok, refuse } from "@repo/core";
import { DAY_MS, fetchRefusal, fetchSec } from "./http.js";

/**
 * XBRL tags vary by filer, so each concept resolves through an ordered fallback
 * list — first tag with usable annual facts wins, and the winning tag is what
 * appears in each returned `XbrlFact.concept` (and, downstream, in a ratio's
 * `sourceConcepts` audit trail). Order matches the table in the core issue.
 */
export const CONCEPT_FALLBACKS: readonly (readonly string[])[] = [
  ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  ["CostOfGoodsAndServicesSold", "CostOfRevenue"],
  ["NetIncomeLoss"],
  ["OperatingIncomeLoss"],
  ["CashAndCashEquivalentsAtCarryingValue"],
  ["NetCashProvidedByUsedInOperatingActivities"],
  ["Liabilities"],
  ["Assets"],
];

const ANNUAL_FORMS = new Set(["10-K", "10-K/A"]);

/**
 * A 10-K also tags Q4 durations with `fp: "FY"`; a real annual period spans the
 * year. Instant concepts (balance-sheet items) have no `start` and always pass.
 */
const MIN_ANNUAL_DURATION_DAYS = 300;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function collectConcept(conceptNode: unknown, concept: string): XbrlFact[] {
  const units = asRecord(asRecord(conceptNode)?.units);
  if (!units) return [];
  const out: XbrlFact[] = [];
  for (const [unit, entries] of Object.entries(units)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      const entry = asRecord(raw);
      if (!entry) continue;
      const { val, fy, fp, form, end, start } = entry;
      if (typeof val !== "number" || typeof fy !== "number") continue;
      if (fp !== "FY" || typeof form !== "string" || !ANNUAL_FORMS.has(form)) continue;
      if (typeof end !== "string") continue;
      if (typeof start === "string") {
        const days = (Date.parse(end) - Date.parse(start)) / (24 * 60 * 60 * 1000);
        if (!(days >= MIN_ANNUAL_DURATION_DAYS)) continue;
      }
      out.push({
        concept,
        value: val,
        unit,
        fiscalYear: fy,
        fiscalPeriod: fp,
        end,
        form,
      });
    }
  }
  return out;
}

/**
 * Flatten a companyfacts payload into annual `XbrlFact`s, resolving each concept
 * group through its fallback list. Returns `[]` when no group resolves (ETFs,
 * trusts, filers with dei-only facts).
 */
export function extractAnnualFacts(companyfacts: unknown): XbrlFact[] {
  const gaap = asRecord(asRecord(asRecord(companyfacts)?.facts)?.["us-gaap"]);
  if (!gaap) return [];
  const out: XbrlFact[] = [];
  for (const group of CONCEPT_FALLBACKS) {
    for (const concept of group) {
      const facts = collectConcept(gaap[concept], concept);
      if (facts.length > 0) {
        out.push(...facts);
        break;
      }
    }
  }
  return out;
}

/** Structured numbers from companyfacts. Refuses `no-xbrl-facts`. */
export async function getXbrlFacts(cik: Cik): Promise<Result<XbrlFact[]>> {
  const outcome = await fetchSec(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    { key: `companyfacts-CIK${cik}.json`, maxAgeMs: DAY_MS },
  );
  if (outcome.kind === "http-error" && outcome.status === 404) {
    return refuse(
      "no-xbrl-facts",
      "This filer has no structured XBRL facts in SEC EDGAR — typical for ETFs, trusts, and filings made before 2009.",
    );
  }
  if (outcome.kind !== "ok") return fetchRefusal("the filer's XBRL facts", outcome);

  let json: unknown;
  try {
    json = JSON.parse(outcome.body);
  } catch {
    return refuse("fetch-failed", "SEC's XBRL facts feed came back malformed.");
  }

  const facts = extractAnnualFacts(json);
  if (facts.length === 0) {
    const name = asRecord(json)?.entityName;
    const who = typeof name === "string" && name ? name : "This filer";
    return refuse(
      "no-xbrl-facts",
      `${who} has no annual US-GAAP XBRL facts in SEC EDGAR — nothing to compute ratios from.`,
    );
  }
  return ok(facts);
}
