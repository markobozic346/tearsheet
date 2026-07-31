const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  middot: "·",
  sect: "§",
  para: "¶",
  copy: "©",
  reg: "®",
  trade: "™",
  cent: "¢",
  pound: "£",
  euro: "€",
  yen: "¥",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+[0-9]*);/gi, (whole, body: string) => {
    let codePoint: number | undefined;
    if (/^#x/i.test(body)) codePoint = Number.parseInt(body.slice(2), 16);
    else if (body.startsWith("#")) codePoint = Number.parseInt(body.slice(1), 10);
    if (codePoint !== undefined) {
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
        return whole;
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Convert an EDGAR filing document (HTML, usually inline-XBRL) to plain text.
 *
 * Deterministic on purpose: `Section.charStart`/`charEnd` index into this
 * output, so the same HTML must always yield the same text.
 *
 * Every block-element boundary becomes a newline, whitespace collapses, and
 * blank lines drop. Headings end up alone on a line and a TOC table row becomes
 * one line ("Item 1A. Risk Factors 5"), which is what the section locator
 * keys on.
 */
export function htmlToText(html: string): string {
  let s = html;
  // The inline-XBRL header holds hidden facts and metadata — noise for prose.
  s = s.replace(/<ix:header[\s\S]*?<\/ix:header\s*>/gi, " ");
  s = s.replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Newlines in HTML source are plain whitespace; only the tags below make lines.
  s = s.replace(/[\r\n\t\f\v]+/g, " ");
  s = s.replace(/<(?:br|hr)\b[^>]*>/gi, "\n");
  s = s.replace(
    /<\/?(?:p|div|tr|table|thead|tbody|tfoot|h[1-6]|li|ul|ol|dl|dt|dd|blockquote|section|article|header|footer|center)\b[^>]*>/gi,
    "\n",
  );
  s = s.replace(/<\/(?:td|th)\s*>/gi, " ");
  // Inline tags vanish without a space: filers split words across adjacent
  // spans ("RIS</span><span>K FACTORS"), and browsers render no gap there.
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/\u00a0/g, " ");
  const lines = s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
  return lines.join("\n");
}
