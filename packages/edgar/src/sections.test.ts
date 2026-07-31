import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { htmlToText } from "./html.js";
import { locateSections } from "./sections.js";

/** Deterministic filler prose: ~150 chars per sentence, no "Item" tokens. */
function prose(topic: string, sentences: number): string {
  return Array.from(
    { length: sentences },
    (_, i) =>
      `${topic} consideration ${i + 1}: demand, supply chains, competition, regulation, and execution can each shift outcomes in ways management cannot fully predict.`,
  ).join(" ");
}

const TOC_LINES = [
  "Example Corp. Annual Report on Form 10-K",
  "Table of Contents",
  "Part I",
  "Item 1. Business 3",
  "Item 1A. Risk Factors 5",
  "Item 1B. Unresolved Staff Comments 17",
  "Item 2. Properties 18",
  "Item 3. Legal Proceedings 18",
  "Part II",
  "Item 5. Market for Registrant's Common Equity 19",
  "Item 7. Management's Discussion and Analysis of Financial Condition and Results of Operations 21",
  "Item 7A. Quantitative and Qualitative Disclosures About Market Risk 27",
  "Item 8. Financial Statements and Supplementary Data 28",
];

function makeFiling({
  riskFactorsBody = prose("The business faces material risks;", 40),
  mdnaBody = prose("Fiscal year results reflect", 35),
}: {
  riskFactorsBody?: string;
  mdnaBody?: string;
} = {}): string {
  return [
    ...TOC_LINES,
    "Part I",
    "Item 1. Business",
    prose("The company designs and sells products;", 30),
    "Item 1A. Risk Factors",
    riskFactorsBody,
    "Item 1B. Unresolved Staff Comments",
    "None.",
    "Item 2. Properties",
    prose("Headquarters and facilities", 10),
    "Part II",
    "Item 7. Management's Discussion and Analysis of Financial Condition and Results of Operations",
    mdnaBody,
    "Item 7A. Quantitative and Qualitative Disclosures About Market Risk",
    prose("Interest rate and currency exposure", 8),
    "Item 8. Financial Statements and Supplementary Data",
    prose("The consolidated statements", 10),
  ].join("\n");
}

describe("locateSections", () => {
  it("finds both sections past the TOC, with offsets that slice back to the text", () => {
    const text = makeFiling();
    const result = locateSections(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [riskFactors, mdna] = result.data;
    expect(riskFactors?.id).toBe("risk-factors");
    expect(mdna?.id).toBe("mdna");
    if (!riskFactors || !mdna) return;

    // The real heading, not the TOC row "Item 1A. Risk Factors 5".
    const tocEntry = text.indexOf("Item 1A. Risk Factors 5");
    expect(riskFactors.charStart).toBeGreaterThan(tocEntry);
    expect(text.slice(riskFactors.charStart, riskFactors.charEnd)).toMatch(
      /^Item 1A\. Risk Factors\n/,
    );
    expect(riskFactors.title).toBe("Item 1A. Risk Factors");

    // Nearest valid end: stops at Item 1B, doesn't swallow Properties or MD&A.
    const body = text.slice(riskFactors.charStart, riskFactors.charEnd);
    expect(body).not.toContain("Item 1B.");
    expect(body).not.toContain("Item 7.");
    expect(body.length).toBeGreaterThan(2000);
  });

  it("bounds MD&A at Item 7A, not at the end of the filing", () => {
    const text = makeFiling();
    const result = locateSections(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mdna = result.data.find((s) => s.id === "mdna");
    expect(mdna).toBeDefined();
    if (!mdna) return;
    const body = text.slice(mdna.charStart, mdna.charEnd);
    expect(body).toMatch(/^Item 7\. Management's Discussion/);
    expect(body).not.toContain("Item 7A.");
    expect(body).not.toContain("Item 8.");
    // lastIndexOf: the real Item 7A heading, not its TOC row.
    expect(mdna.charEnd).toBeLessThanOrEqual(text.lastIndexOf("Item 7A. Quantitative"));
  });

  it("rejects a TOC-like stub as section-not-found instead of returning it", () => {
    // The real Item 1A is a stub, so the only substantial "Item 1A" text in the
    // document is the TOC row — a naive first-match would return that.
    const text = makeFiling({ riskFactorsBody: "Not applicable." });
    const result = locateSections(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("section-not-found");
    expect(result.refusal.message).toContain("Item 1A");
  });

  it("refuses on a document that is only a table of contents", () => {
    const text = TOC_LINES.join("\n");
    const result = locateSections(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("section-not-found");
  });

  it("refuses when a section body is tables rather than prose", () => {
    const numbers = Array.from(
      { length: 400 },
      (_, i) => `2024 ${i * 37} 2023 ${i * 41} 2022 ${i * 43}`,
    ).join(" ");
    const text = makeFiling({ mdnaBody: numbers });
    const result = locateSections(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("section-not-found");
    expect(result.refusal.message).toContain("Item 7");
  });

  it("is not fooled by running page headers stamped on every page", () => {
    // MSFT-style: "PART I" + "Item 1A" repeated at the top of every page. The
    // repeated lines are neither section starts nor boundaries.
    const pageHeader = ["PART I", "Item 1A"];
    const chunk = () => prose("The business faces material risks;", 15);
    const text = [
      ...TOC_LINES,
      "PART I",
      "Item 1. Business",
      prose("The company designs and sells products;", 30),
      ...pageHeader,
      "ITEM 1A. RISK FACTORS",
      chunk(),
      ...pageHeader,
      chunk(),
      ...pageHeader,
      chunk(),
      ...pageHeader,
      chunk(),
      "ITEM 1B. UNRESOLVED STAFF COMMENTS",
      "None.",
      "ITEM 2. PROPERTIES",
      prose("Headquarters and facilities", 10),
      "PART II",
      "ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION AND RESULTS OF OPERATIONS",
      prose("Fiscal year results reflect", 35),
      "ITEM 7A. QUANTITATIVE AND QUALITATIVE DISCLOSURES ABOUT MARKET RISK",
      prose("Interest rate and currency exposure", 8),
    ].join("\n");

    const result = locateSections(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const riskFactors = result.data.find((s) => s.id === "risk-factors");
    if (!riskFactors) throw new Error("expected risk-factors");
    const body = text.slice(riskFactors.charStart, riskFactors.charEnd);
    expect(body).toMatch(/^ITEM 1A\. RISK FACTORS/);
    // Spans all four page-sized chunks instead of stopping at the first header.
    expect(body.length).toBeGreaterThan(4 * 2000);
    expect(body).not.toContain("ITEM 1B.");
  });

  it("accepts a long heading line, like Costco's MD&A with its units suffix", () => {
    const heading =
      "Item 7—Management's Discussion and Analysis of Financial Condition and Results of Operations (amounts in millions, except per share, share, percentages and warehouse counts)";
    const text = [
      ...TOC_LINES,
      "Part I",
      "Item 1. Business",
      prose("The company designs and sells products;", 30),
      "Item 1A—Risk Factors",
      prose("The business faces material risks;", 40),
      "Item 1B—Unresolved Staff Comments",
      "None.",
      "Item 2—Properties",
      prose("Headquarters and facilities", 10),
      "Part II",
      heading,
      prose("Fiscal year results reflect", 35),
      "Item 7A—Quantitative and Qualitative Disclosures About Market Risk",
      prose("Interest rate and currency exposure", 8),
    ].join("\n");

    const result = locateSections(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mdna = result.data.find((s) => s.id === "mdna");
    if (!mdna) throw new Error("expected mdna");
    expect(text.slice(mdna.charStart, mdna.charEnd)).toMatch(/^Item 7—Management/);
    expect(mdna.title).toBe(heading);
  });

  it("locates sections in an HTML filing end to end", () => {
    const paragraphs = (body: string) => `<div><span>${body}</span></div>`;
    const tocRows = TOC_LINES.slice(3)
      .map((line) => {
        const m = /^(.*)\s(\d+)$/.exec(line);
        return m
          ? `<tr><td>${m[1]}</td><td>${m[2]}</td></tr>`
          : `<tr><td>${line}</td></tr>`;
      })
      .join("");
    const html = [
      "<html><head><title>10-K</title></head><body>",
      "<ix:header>hidden xbrl noise 123456789</ix:header>",
      `<table>${tocRows}</table>`,
      "<div>Part I</div>",
      "<div>Item 1. Business</div>",
      paragraphs(prose("The company designs and sells products;", 30)),
      "<div><b>Item 1A.</b> <b>Risk&nbsp;Factors</b></div>",
      paragraphs(prose("The business faces material risks;", 40)),
      "<div>Item 1B. Unresolved Staff Comments</div><div>None.</div>",
      "<div>Item 2. Properties</div>",
      paragraphs(prose("Headquarters and facilities", 10)),
      "<div>Part II</div>",
      "<div>Item 7. Management&rsquo;s Discussion and Analysis of Financial Condition and Results of Operations</div>",
      paragraphs(prose("Fiscal year results reflect", 35)),
      "<div>Item 7A. Quantitative and Qualitative Disclosures About Market Risk</div>",
      paragraphs(prose("Interest rate and currency exposure", 8)),
      "</body></html>",
    ].join("\n");

    const text = htmlToText(html);
    expect(text).not.toContain("hidden xbrl noise");

    const result = locateSections(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [riskFactors, mdna] = result.data;
    if (!riskFactors || !mdna) throw new Error("expected both sections");
    expect(text.slice(riskFactors.charStart, riskFactors.charEnd)).toMatch(
      /^Item 1A\. Risk Factors/,
    );
    expect(text.slice(mdna.charStart, mdna.charEnd)).toMatch(
      /^Item 7\. Management’s Discussion/,
    );
  });

  it("matches the committed fixture's shape for a good extraction", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("../../../fixtures/aapl-10k-sections.json", import.meta.url),
        "utf8",
      ),
    ) as {
      sections: {
        id: string;
        title: string;
        text: string;
        charStart: number;
        charEnd: number;
      }[];
    };
    expect(fixture.sections.map((s) => s.id)).toEqual(["risk-factors", "mdna"]);
    for (const section of fixture.sections) {
      // The fixture generator has a known ±1 offset quirk; shape, not bytes.
      expect(
        Math.abs(section.charEnd - section.charStart - section.text.length),
      ).toBeLessThanOrEqual(1);
      expect(section.charStart).toBeGreaterThan(0);
      expect(typeof section.title).toBe("string");
    }
  });
});
