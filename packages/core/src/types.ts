/**
 * FROZEN CONTRACT — do not edit without coordinating across every worktree.
 *
 * Four packages are built in parallel against these types. Changing a shape here
 * silently breaks a worktree that has no way to find out until merge. If something
 * is genuinely missing, say so in the issue rather than widening a type locally.
 */

/** Uppercase exchange ticker, e.g. "AAPL". */
export type Ticker = string;

/** 10-digit zero-padded SEC Central Index Key, e.g. "0000320193". */
export type Cik = string;

// ---------------------------------------------------------------------------
// Refusal — a first-class outcome, not an exception
// ---------------------------------------------------------------------------

/**
 * Why a tearsheet (or part of one) could not be produced. The system refuses with
 * a specific reason rather than rendering something it can't stand behind.
 */
export type RefusalReason =
  | "unknown-ticker" // not in SEC's company_tickers.json
  | "no-10k" // filer exists but files 20-F/40-F, or has no 10-K
  | "no-xbrl-facts" // no companyfacts (ETFs, trusts, pre-2009)
  | "concept-not-disclosed" // filer didn't tag this concept
  | "section-not-found" // Item 1A/7 boundaries not confidently located
  | "fetch-failed"; // network/SEC error

export type Refusal = {
  reason: RefusalReason;
  /** User-facing sentence naming the specific reason. Shown in the UI verbatim. */
  message: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false; refusal: Refusal };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const refuse = <T>(reason: RefusalReason, message: string): Result<T> => ({
  ok: false,
  refusal: { reason, message },
});

// ---------------------------------------------------------------------------
// EDGAR primitives
// ---------------------------------------------------------------------------

export type Company = {
  cik: Cik;
  ticker: Ticker;
  name: string;
};

export type FilingRef = {
  accessionNumber: string;
  /** "10-K", "10-K/A", … */
  form: string;
  /** ISO date the filing was submitted. */
  filingDate: string;
  /** ISO date of the period covered. */
  reportDate: string;
  /** Absolute URL to the primary filing document. */
  documentUrl: string;
};

/** One tagged numeric fact from XBRL companyfacts. */
export type XbrlFact = {
  /** us-gaap concept name, e.g. "RevenueFromContractWithCustomerExcludingAssessedTax". */
  concept: string;
  value: number;
  /** "USD", "shares", … */
  unit: string;
  fiscalYear: number;
  /** "FY", "Q1", … */
  fiscalPeriod: string;
  /** ISO end date of the period. */
  end: string;
  form: string;
};

export type SectionId = "risk-factors" | "mdna";

/** A qualitative section extracted from a filing, as plain text. */
export type Section = {
  id: SectionId;
  /** Heading as it appeared in the filing, e.g. "Item 1A. Risk Factors". */
  title: string;
  text: string;
  /** Character offsets into the filing's full extracted text. */
  charStart: number;
  charEnd: number;
};

// ---------------------------------------------------------------------------
// Ratios — deterministic, computed in core, never by a model
// ---------------------------------------------------------------------------

export type RatioId =
  | "revenue"
  | "revenue-growth"
  | "gross-margin"
  | "net-income"
  | "net-margin"
  | "cash"
  | "runway"
  | "liabilities-to-assets";

export type RatioUnit = "usd" | "percent" | "months" | "ratio";

export type Ratio = {
  id: RatioId;
  /** Human label, e.g. "Gross margin". */
  label: string;
  /** null when the filer didn't disclose the inputs — never a guess, never 0. */
  value: number | null;
  unit: RatioUnit;
  /** Period the value covers, e.g. "FY2024". */
  period: string;
  /**
   * XBRL concepts actually used to compute this value, in the order resolved.
   * This is the audit trail — every number traces back to a filed tag.
   */
  sourceConcepts: string[];
  /** Present when value is null: which concept was missing. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Signal — generative, but grounded
// ---------------------------------------------------------------------------

export type SignalCategory = "risk" | "strategy" | "financial-health" | "red-flag";

export type Signal = {
  /** One-sentence extracted insight. */
  claim: string;
  category: SignalCategory;
  /** Verbatim span from the filing. Validated in code; unverifiable items are dropped. */
  quote: string;
  locator: {
    sectionId: SectionId;
    /** Character offset of `quote` within that section's text. */
    offset: number;
  };
};

// ---------------------------------------------------------------------------
// The assembled page
// ---------------------------------------------------------------------------

export type Tearsheet = {
  company: Company;
  filing: FilingRef;
  ratios: Ratio[];
  /** Empty with a refusal recorded when sections couldn't be located. */
  signals: Signal[];
  sections: Section[];
  /** Set when signals are absent for a stated reason. */
  signalsRefusal?: Refusal;
};
