import type { FilingRef, Result, Section, SectionId } from "@repo/core";
import { ok, refuse } from "@repo/core";
import { htmlToText } from "./html.js";
import { fetchRefusal, fetchSec } from "./http.js";

/**
 * Locating "Item 1A" / "Item 7" in a 10-K is the part that varies wildly by
 * filer. The trap: every item heading also appears in the table of contents
 * (and sometimes in cross-references), so a first-match regex returns a
 * ~40-character TOC entry and downstream extraction "succeeds" on nothing.
 *
 * Strategy: collect every line that looks like an item heading, then for each
 * candidate start take the span to the NEAREST following end-boundary heading
 * and accept it only if the span is plausible prose — long enough to be a real
 * section, not so long it swallowed half the filing, and mostly letters rather
 * than table digits. TOC entries fail the length check by construction (the
 * next TOC line is a few dozen characters away). An implausible extraction is
 * a refusal, never a success.
 */

type ItemHeading = {
  /** Char offset of the line start within the full extracted text. */
  offset: number;
  /** Normalized item id, e.g. "1a", "7" — empty for "PART II"-style lines. */
  item: string;
  line: string;
  /** Text on the heading line after the item number. */
  rest: string;
  /** The following line, for headings split like "Item 1A." / "Risk Factors". */
  nextLine: string;
  isPart: boolean;
  /** Trailing page number, or packed among other headings: a TOC row, not a section. */
  tocLike: boolean;
  /** Identical line text recurs across the document: a running page header. */
  repeated: boolean;
};

/** A heading line: optional "Part I" prefix, then "Item 7." / "Item 1A —" etc. */
const ITEM_LINE =
  /^(?:part\s+[ivx]{1,4}\b[\s.,:;·—–-]*)?item\s*(\d{1,2})\s*\.?\s*([a-c])?(?![a-z0-9])\s*(?:[.:;·—–-]\s*)*(.*)$/i;

/** A bare "PART II" line — a hard section boundary when item headings are missing. */
const PART_LINE = /^part\s+[ivx]{1,4}\b[\s.,:;·—–-]{0,10}$/i;

/**
 * Real headings are short; a prose paragraph mentioning "Item 1A" is not.
 * Generous because some run long: Costco's MD&A heading is ~170 chars with its
 * "(amounts in millions, …)" suffix.
 */
const MAX_HEADING_LINE_LENGTH = 220;

/** "Item 1A. Risk Factors 5" — a TOC row keeps its page number after extraction. */
const TOC_PAGE_NUMBER = /[\s.]\d{1,4}$/;

/** TOC rows are packed together; a real heading is followed by prose, not headings. */
const TOC_LOOKAHEAD_CHARS = 500;
const TOC_MIN_FOLLOWING_HEADINGS = 2;

/**
 * Some filers stamp a running header ("PART I" / "Item 1A") on every page; a
 * heading line whose exact text recurs this often is an artifact, not a
 * section start or a boundary.
 */
const PAGE_HEADER_MIN_REPEATS = 3;

const MIN_SECTION_CHARS = 2000;
const MAX_SECTION_FRACTION = 0.6;
const MIN_LETTER_FRACTION = 0.45;

type SectionSpec = {
  id: SectionId;
  label: string;
  item: string;
  titleRe: RegExp;
  endItems: readonly string[];
};

const SPECS: readonly SectionSpec[] = [
  {
    id: "risk-factors",
    label: "Item 1A (Risk Factors)",
    item: "1a",
    titleRe: /risk\s*factors/i,
    endItems: ["1b", "1c", "2"],
  },
  {
    id: "mdna",
    label: "Item 7 (Management's Discussion and Analysis)",
    item: "7",
    titleRe: /management|discussion\s+and\s+analysis/i,
    endItems: ["7a", "8"],
  },
];

export function findItemHeadings(text: string): ItemHeading[] {
  const headings: ItemHeading[] = [];
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.length <= MAX_HEADING_LINE_LENGTH) {
      const m = ITEM_LINE.exec(line);
      if (m) {
        headings.push({
          offset,
          item: `${m[1]}${(m[2] ?? "").toLowerCase()}`,
          line,
          rest: m[3] ?? "",
          nextLine: lines[i + 1] ?? "",
          isPart: false,
          tocLike: false,
          repeated: false,
        });
      } else if (PART_LINE.test(line)) {
        headings.push({
          offset,
          item: "",
          line,
          rest: "",
          nextLine: "",
          isPart: true,
          tocLike: false,
          repeated: false,
        });
      }
    }
    offset += line.length + 1;
  }
  const lineCounts = new Map<string, number>();
  for (const heading of headings) {
    lineCounts.set(heading.line, (lineCounts.get(heading.line) ?? 0) + 1);
  }
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (!heading) continue;
    let following = 0;
    for (let j = i + 1; j < headings.length; j++) {
      const later = headings[j];
      if (!later || later.offset - heading.offset >= TOC_LOOKAHEAD_CHARS) break;
      following++;
    }
    // Page number goes on `rest`, not the line: a bare "Item 7" ends in a digit
    // that is the item number itself, not a page reference.
    heading.tocLike =
      TOC_PAGE_NUMBER.test(heading.rest) || following >= TOC_MIN_FOLLOWING_HEADINGS;
    heading.repeated = (lineCounts.get(heading.line) ?? 0) >= PAGE_HEADER_MIN_REPEATS;
  }
  return headings;
}

function letterFraction(s: string): number {
  if (s.length === 0) return 0;
  const letters = s.match(/[a-z]/gi)?.length ?? 0;
  return letters / s.length;
}

type Located = Omit<Section, "text">;

function locateOne(
  text: string,
  headings: ItemHeading[],
  spec: SectionSpec,
): { section: Located } | { problem: string } {
  const matches = headings.filter((h) => h.item === spec.item);
  if (matches.length === 0) {
    return { problem: `no ${spec.label} heading was found` };
  }
  const nonToc = matches.filter((h) => !h.tocLike);
  if (nonToc.length === 0) {
    return {
      problem: `every ${spec.label} heading looks like a table-of-contents entry`,
    };
  }
  // Running page headers are not section starts. If the filer stamps the full
  // heading on every page, the first stamped occurrence sits on the section's
  // first page — keep that one as a last resort.
  let candidates = nonToc.filter((h) => !h.repeated);
  if (candidates.length === 0) candidates = nonToc.slice(0, 1);

  let fallback: Located | undefined;
  for (const candidate of candidates) {
    // Nearest valid end: the first later heading that starts the next section.
    // Repeated lines are page headers, not the next section starting.
    const end = headings.find(
      (h) =>
        h.offset > candidate.offset &&
        !h.repeated &&
        (h.isPart || spec.endItems.includes(h.item)),
    );
    if (!end) continue;

    let charEnd = end.offset;
    while (charEnd > candidate.offset && /\s/.test(text.charAt(charEnd - 1))) charEnd--;
    const span = charEnd - candidate.offset;

    // A TOC entry's span to the next TOC line is tiny; a runaway boundary is huge.
    if (span < MIN_SECTION_CHARS) continue;
    if (span > text.length * MAX_SECTION_FRACTION) continue;
    if (letterFraction(text.slice(candidate.offset, charEnd)) < MIN_LETTER_FRACTION) {
      continue;
    }

    const next = candidate.nextLine.length <= 100 ? candidate.nextLine : "";
    const titleMatches =
      spec.titleRe.test(candidate.rest) ||
      (candidate.rest === "" && spec.titleRe.test(next));
    const title = (candidate.rest === "" ? `${candidate.line} ${next}` : candidate.line)
      .replace(/\s+\d{1,3}$/, "")
      .trim();
    const section: Located = {
      id: spec.id,
      title,
      charStart: candidate.offset,
      charEnd,
    };
    if (titleMatches) return { section };
    fallback ??= section;
  }

  if (fallback) return { section: fallback };
  return {
    problem: `no ${spec.label} heading is followed by a plausible section body, so this filer likely incorporates the section by reference rather than printing it under the item heading`,
  };
}

/**
 * Locate Item 1A and Item 7 boundaries in extracted filing text. Pure — the
 * network-free core of `getSections`, and where the TOC trap is defused.
 */
export function locateSections(text: string): Result<Located[]> {
  const headings = findItemHeadings(text);
  const located: Located[] = [];
  const problems: string[] = [];
  for (const spec of SPECS) {
    const result = locateOne(text, headings, spec);
    if ("section" in result) located.push(result.section);
    else problems.push(result.problem);
  }
  if (problems.length > 0) {
    return refuse(
      "section-not-found",
      `Couldn't confidently extract this 10-K's sections: ${problems.join("; and ")}. Refusing rather than returning the wrong span.`,
    );
  }
  const [riskFactors, mdna] = located;
  if (riskFactors && mdna && riskFactors.charEnd > mdna.charStart) {
    return refuse(
      "section-not-found",
      "Item 1A and Item 7 boundaries overlap in this filing's HTML — refusing rather than extracting from an ambiguous span.",
    );
  }
  return ok(located);
}

/**
 * Extract Item 1A (Risk Factors) and Item 7 (MD&A) as plain text.
 *
 * Must not confuse a table-of-contents entry for the section itself — refuses
 * `section-not-found` rather than returning a stub.
 */
export async function getSections(filing: FilingRef): Promise<Result<Section[]>> {
  const docName = filing.documentUrl.split("/").pop() ?? "primary-document.htm";
  const outcome = await fetchSec(filing.documentUrl, {
    // Filings are immutable: one fetch per accession, ever.
    key: `filings/${filing.accessionNumber.replace(/-/g, "")}-${docName}`,
    maxAgeMs: Number.POSITIVE_INFINITY,
  });
  if (outcome.kind !== "ok") return fetchRefusal("the 10-K filing document", outcome);

  const text = htmlToText(outcome.body);
  const located = locateSections(text);
  if (!located.ok) return located;
  return ok(
    located.data.map((section) => ({
      ...section,
      text: text.slice(section.charStart, section.charEnd),
    })),
  );
}
