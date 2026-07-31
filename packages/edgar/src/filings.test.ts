import { describe, expect, it } from "vitest";
import { type RecentFilings, selectLatestTenK } from "./filings.js";
import { findCompany, padCik } from "./tickers.js";

function recent(
  rows: { form: string; accession?: string; doc?: string }[],
): RecentFilings {
  return {
    accessionNumber: rows.map(
      (r, i) => r.accession ?? `0000000000-25-${String(i).padStart(6, "0")}`,
    ),
    form: rows.map((r) => r.form),
    filingDate: rows.map(() => "2025-10-31"),
    reportDate: rows.map(() => "2025-09-27"),
    primaryDocument: rows.map((r) => r.doc ?? "doc.htm"),
  };
}

describe("selectLatestTenK", () => {
  it("picks the most recent 10-K and builds the archive document URL", () => {
    const result = selectLatestTenK(
      "Apple Inc.",
      "0000320193",
      recent([
        { form: "8-K" },
        { form: "10-Q" },
        { form: "10-K", accession: "0000320193-25-000079", doc: "aapl-20250927.htm" },
        { form: "10-K", accession: "0000320193-24-000123", doc: "aapl-20240928.htm" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accessionNumber).toBe("0000320193-25-000079");
    expect(result.data.form).toBe("10-K");
    expect(result.data.documentUrl).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
    );
  });

  it("skips 10-K/A amendments in favor of the original 10-K", () => {
    const result = selectLatestTenK(
      "Example Corp.",
      "0000000001",
      recent([
        { form: "10-K/A", accession: "0000000001-25-000002" },
        { form: "10-K", accession: "0000000001-25-000001" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accessionNumber).toBe("0000000001-25-000001");
  });

  it("refuses no-10k for a 20-F foreign private issuer, naming the form", () => {
    const result = selectLatestTenK(
      "Shell plc",
      "0000000002",
      recent([{ form: "20-F" }, { form: "6-K" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("no-10k");
    expect(result.refusal.message).toContain("Shell plc");
    expect(result.refusal.message).toContain("20-F");
  });

  it("refuses no-10k for a fund that files fund reports", () => {
    const result = selectLatestTenK(
      "SPDR S&P 500 ETF Trust",
      "0000000003",
      recent([{ form: "N-CSR" }, { form: "NPORT-P" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("no-10k");
    expect(result.refusal.message).toContain("fund");
  });

  it("refuses no-10k with a plain message when there is simply no 10-K", () => {
    const result = selectLatestTenK(
      "Example Corp.",
      "0000000004",
      recent([{ form: "8-K" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("no-10k");
  });
});

describe("findCompany", () => {
  const directory = {
    "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
    "1": { cik_str: 789019, ticker: "MSFT", title: "Microsoft Corp" },
  };

  it("resolves a ticker case-insensitively and zero-pads the CIK", () => {
    expect(findCompany(directory, "aapl")).toEqual({
      cik: "0000320193",
      ticker: "AAPL",
      name: "Apple Inc.",
    });
  });

  it("returns undefined for an unknown ticker", () => {
    expect(findCompany(directory, "ZZZZ")).toBeUndefined();
  });

  it("pads CIKs to ten digits", () => {
    expect(padCik(320193)).toBe("0000320193");
  });
});
