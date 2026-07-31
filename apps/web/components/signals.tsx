import { getSignals } from "../lib/data";
import { RefusalPanel } from "./refusal-panel";
import { SignalCards } from "./signal-cards";

type SignalsProps = {
  ticker: string;
};

export async function Signals({ ticker }: SignalsProps) {
  const result = await getSignals(ticker);

  return (
    <section className="signals-section" aria-labelledby="signals-heading">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Phase 02 / grounded signal</p>
          <h2 id="signals-heading">What the filing is saying</h2>
        </div>
        {result.ok ? (
          <p className="phase-status phase-status--done">
            <span aria-hidden="true" /> Quotes verified
          </p>
        ) : (
          <p className="phase-status phase-status--refused">
            <span aria-hidden="true" /> Extraction refused
          </p>
        )}
      </header>
      {result.ok ? (
        <SignalCards
          filing={result.data.filing}
          sections={result.data.sections}
          signals={result.data.signals}
        />
      ) : (
        <RefusalPanel refusal={result.refusal} title="Signals unavailable" />
      )}
    </section>
  );
}
