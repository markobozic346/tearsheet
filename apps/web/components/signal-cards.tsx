import type { FilingRef, Section, Signal, SignalCategory } from "@repo/core";

const categoryMeta: { id: SignalCategory; label: string; code: string }[] = [
  { id: "risk", label: "Risk", code: "RSK" },
  { id: "strategy", label: "Strategy", code: "STR" },
  { id: "financial-health", label: "Financial health", code: "FIN" },
  { id: "red-flag", label: "Red flag", code: "FLG" },
];

type SourceExcerpt = {
  before: string;
  quote: string;
  after: string;
  clippedBefore: boolean;
  clippedAfter: boolean;
};

export function buildSourceExcerpt(
  section: Section,
  signal: Signal,
  radius = 180,
): SourceExcerpt | null {
  if (section.id !== signal.locator.sectionId) {
    return null;
  }

  const quoteStart = signal.locator.offset;
  const quoteEnd = quoteStart + signal.quote.length;
  if (section.text.slice(quoteStart, quoteEnd) !== signal.quote) {
    return null;
  }

  const roughStart = Math.max(0, quoteStart - radius);
  const firstSpace = section.text.indexOf(" ", roughStart);
  const excerptStart =
    roughStart === 0 || firstSpace === -1 ? roughStart : firstSpace + 1;
  const roughEnd = Math.min(section.text.length, quoteEnd + radius);
  const lastSpace = section.text.lastIndexOf(" ", roughEnd);
  const excerptEnd =
    roughEnd === section.text.length || lastSpace <= quoteEnd ? roughEnd : lastSpace;

  return {
    before: section.text.slice(excerptStart, quoteStart),
    quote: signal.quote,
    after: section.text.slice(quoteEnd, excerptEnd),
    clippedBefore: excerptStart > 0,
    clippedAfter: excerptEnd < section.text.length,
  };
}

type SignalCardsProps = {
  filing: FilingRef;
  sections: Section[];
  signals: Signal[];
};

export function SignalCards({ filing, sections, signals }: SignalCardsProps) {
  return (
    <div className="signal-groups">
      {categoryMeta.map((category) => {
        const categorySignals = signals.filter(
          (signal) => signal.category === category.id,
        );
        if (categorySignals.length === 0) {
          return null;
        }

        return (
          <section
            className={`signal-group signal-group--${category.id}`}
            key={category.id}
          >
            <header className="signal-group__header">
              <span>{category.code}</span>
              <h3>{category.label}</h3>
              <span>{String(categorySignals.length).padStart(2, "0")}</span>
            </header>
            <div className="signal-group__cards">
              {categorySignals.map((signal) => {
                const section = sections.find(
                  (candidate) => candidate.id === signal.locator.sectionId,
                );
                const excerpt = section ? buildSourceExcerpt(section, signal) : null;

                if (!section || !excerpt) {
                  return null;
                }

                const sourceId = `source-${signal.locator.sectionId}-${signal.locator.offset}`;

                return (
                  <article className="signal-card" key={sourceId}>
                    <p className="signal-card__claim">{signal.claim}</p>
                    <blockquote>“{signal.quote}”</blockquote>
                    <details className="source-trace" id={sourceId}>
                      <summary>
                        <span>Trace to source</span>
                        <span aria-hidden="true">↘</span>
                      </summary>
                      <div className="source-trace__body">
                        <div className="source-trace__meta">
                          <div>
                            <span>{section.title}</span>
                            <span>
                              Section offset{" "}
                              {signal.locator.offset.toLocaleString("en-US")}
                            </span>
                          </div>
                          <a href={filing.documentUrl} target="_blank" rel="noreferrer">
                            Open SEC filing ↗
                          </a>
                        </div>
                        <p>
                          {excerpt.clippedBefore ? "…" : null}
                          {excerpt.before}
                          <mark>{excerpt.quote}</mark>
                          {excerpt.after}
                          {excerpt.clippedAfter ? "…" : null}
                        </p>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SignalsSkeleton() {
  return (
    <section className="signals-section signals-section--loading" aria-busy="true">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Phase 02 / grounded signal</p>
          <h2>Reading the filing</h2>
        </div>
        <p className="phase-status phase-status--working">
          <span aria-hidden="true" /> Verifying exact quotes
        </p>
      </header>
      <div className="signal-skeleton" role="status" aria-label="Signals are loading">
        {categoryMeta.map((category, index) => (
          <div className="signal-skeleton__column" key={category.id}>
            <span>{category.code}</span>
            <i style={{ animationDelay: `${index * 120}ms` }} />
            <i style={{ animationDelay: `${index * 120 + 80}ms` }} />
            <i style={{ animationDelay: `${index * 120 + 160}ms` }} />
          </div>
        ))}
      </div>
    </section>
  );
}
