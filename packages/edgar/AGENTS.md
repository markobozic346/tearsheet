# packages/edgar — agent rules

The typed SEC client. Everything that touches the network lives here and nowhere else.

- **No LLM, ever.** This package does fetching and parsing. If a problem here seems to want
  a model, it doesn't — it wants a better heuristic or an honest refusal.
- **Cache everything.** Filings are immutable once filed. A given accession number is
  fetched from SEC at most once, then read from disk.
- **Identify yourself.** Every request sends `SEC_USER_AGENT`. Stay under ~10 req/s — SEC's
  fair-access policy is enforced with blocks.
- **The table-of-contents trap.** "Item 1A. Risk Factors" appears in the TOC as well as at
  the real section. Naive first-match regex returns a 40-character TOC entry, and the
  extractor downstream will dutifully find signal in nothing. Guard against it and test it.
- **Refuse specifically.** `unknown-ticker`, `no-10k`, `no-xbrl-facts`, `section-not-found`,
  `fetch-failed` — each with a message naming the real cause. A short or suspicious section
  extraction is `section-not-found`, not a success.
- **XBRL tags vary by filer.** Resolve each concept through an ordered fallback list and
  record which one hit in `sourceConcepts`.
