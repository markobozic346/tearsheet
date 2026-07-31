import { TickerForm } from "../components/ticker-form";

export default function Home() {
  return (
    <main className="landing">
      <div className="landing__grid" aria-hidden="true" />
      <header className="landing__header">
        <div className="wordmark wordmark--light">
          <span>TS</span>
          <strong>TEARSHEET</strong>
          <small>10-K / ONE GLANCE</small>
        </div>
        <p>SEC XBRL + grounded filing text</p>
      </header>

      <section className="landing__hero">
        <p className="eyebrow">Fundamental research / compressed</p>
        <h1>
          The numbers settle.
          <br />
          <em>The filing speaks.</em>
        </h1>
        <p className="landing__lede">
          A one-page view of the filed financial position and the few qualitative signals
          worth tracing—each one anchored to the exact words in the 10-K.
        </p>
        <TickerForm />
        <p className="landing__hint" id="ticker-hint">
          Preview data is available for <strong>AAPL</strong>.
        </p>
      </section>

      <aside className="landing__manifesto" aria-label="Tearsheet principles">
        <div>
          <span>01</span>
          <p>
            <strong>Filed, not invented.</strong>
            Every figure resolves from an SEC XBRL tag.
          </p>
        </div>
        <div>
          <span>02</span>
          <p>
            <strong>Quoted, not hand-waved.</strong>
            Every claim opens onto its verbatim filing span.
          </p>
        </div>
      </aside>

      <footer className="landing__footer">
        <span>Deterministic facts render first</span>
        <i aria-hidden="true" />
        <span>Grounded signal follows</span>
      </footer>
    </main>
  );
}
