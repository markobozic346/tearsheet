# Tearsheet

> A 10-K in one glance — every number auditable, every claim traceable to the source.

Enter a ticker and get a one-page briefing on the company: the key financial ratios,
computed exactly from official SEC filings, alongside AI-extracted "signal" from the
qualitative sections of the 10-K — where **every claim links back to the exact paragraph
it came from.**

I built this because doing fundamental research by hand, the slow part is never the
numbers — it's the prose. A 10-K is 100+ pages of risk factors and management commentary.
The signal is in there, but reading it doesn't scale. Tearsheet surfaces the few things
that matter, without ever asking you to trust a number it made up.

---

## The core idea: deterministic / generative split

The whole system is organised around one belief: **an LLM should never be the source of a
number, and never be believed without a citation.**

- **Numbers are deterministic.** Every ratio comes from SEC's structured XBRL data
  (`companyfacts`). The LLM does no arithmetic. Values are auditable, reproducible, and
  traceable to a filed figure.
- **Prose is generative — but grounded.** The agent reads only the qualitative sections
  (Risk Factors, MD&A) and returns discrete signal items, each carrying the verbatim
  source quote and a locator back into the filing. Every quote is validated against the
  source text in code; anything that can't be found is dropped. No free-floating summaries.

This is a deliberate line drawn where LLMs are safe (reading, extracting, citing) versus
where they're dangerous (computing, asserting without a source).

---

## Data source: SEC EDGAR

Official SEC API — free, no key, not scraping. Requires a descriptive `User-Agent` header
and staying under ~10 req/s.

| Purpose | Endpoint |
|---|---|
| ticker → CIK | `https://www.sec.gov/files/company_tickers.json` |
| filing list | `https://data.sec.gov/submissions/CIK{cik}.json` |
| structured numbers | `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json` |
| full filing text | `https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{doc}` |

Filings are immutable once filed, so responses are cached to disk — the app never hits the
network for data it has already seen.

---

## Architecture

Turborepo, with the backend logic living in packages and the web app composing them.

```
tearsheet/
├── apps/
│   └── web/              Next.js — tearsheet UI + route handlers
├── packages/
│   ├── edgar/            typed SEC client: CIK resolve, filings, XBRL facts,
│   │                     section extraction, on-disk cache, rate limiting
│   ├── core/             domain types + ratio calculators (pure, deterministic, tested)
│   └── agents/           Mastra — the "signal extractor" agent + workflow
└── turbo.json
```

**Dependency direction:** `web → {edgar, core, agents}` and `agents → {edgar, core}`.
`core` depends on nothing — it's pure logic and the easy-to-test heart of the system.

The package boundary around `agents` is intentional: agent runs are long, bursty, and
cost-sensitive, so in production it lifts cleanly into a standalone Mastra service with its
own process and scaling. Today it's called in-process for simplicity; the seam is already
where the future service split goes.

### The ratios (`packages/core`)

Pure functions over XBRL facts — no I/O, no LLM. They answer the four questions of
fundamental analysis:

| Ratio | Answers |
|---|---|
| Revenue + YoY growth | Is it growing? |
| Gross margin | Do the unit economics work? |
| Net income / margin | Does it earn? |
| Cash & runway | Can it survive? |
| Liabilities / Assets | What does it owe? |

XBRL tags are not uniform across companies, so each concept resolves through an ordered
fallback list, and the UI degrades gracefully when a figure isn't disclosed — it says so
rather than guessing.

### The agent (`packages/agents`)

Section-targeted (Risk Factors + MD&A only, not the whole filing) for cost, latency, and
precision. Returns typed signal items:

```ts
type Signal = {
  claim: string;        // one-sentence extracted insight
  category: "risk" | "strategy" | "financial-health" | "red-flag";
  quote: string;        // verbatim span from the filing
  locator: string;      // section + offset for click-to-source
};
```

---

## Getting started

```bash
pnpm install
pnpm dev
```

Set a `User-Agent` for SEC requests (their fair-access policy requires a real contact):

```bash
# .env
SEC_USER_AGENT="Your Name your@email.com"
ANTHROPIC_API_KEY="sk-ant-..."
```

Then open the app and enter a ticker.

---

## Status

A focused prototype. The core loop — ticker → filings → deterministic ratios → grounded
signal with click-to-source — works end to end. Streaming, multi-company comparison, and
earnings-call transcript ingestion are natural next steps, not yet built.
