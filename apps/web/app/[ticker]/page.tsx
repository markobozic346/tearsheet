import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RatiosTable } from "../../components/ratios-table";
import { RefusalPanel } from "../../components/refusal-panel";
import { SignalsSkeleton } from "../../components/signal-cards";
import { Signals } from "../../components/signals";
import { TickerForm } from "../../components/ticker-form";
import { getRatios } from "../../lib/data";

type TearsheetPageProps = {
  params: Promise<{ ticker: string }>;
};

export async function generateMetadata({
  params,
}: TearsheetPageProps): Promise<Metadata> {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} filing tearsheet`,
    description: `Deterministic ratios and source-grounded 10-K signals for ${ticker.toUpperCase()}.`,
  };
}

export default async function TearsheetPage({ params }: TearsheetPageProps) {
  const { ticker: routeTicker } = await params;
  const ticker = routeTicker.trim().toUpperCase();
  const ratiosResult = await getRatios(ticker);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label="Tearsheet home">
          <span>TS</span>
          <strong>TEARSHEET</strong>
          <small>10-K / ONE GLANCE</small>
        </Link>
        <TickerForm compact currentTicker={ticker} />
      </header>

      <main className="tearsheet">
        {ratiosResult.ok ? (
          <>
            <header className="company-header">
              <div>
                <p className="eyebrow">Filed company / {ratiosResult.data.company.cik}</p>
                <h1>{ratiosResult.data.company.name}</h1>
              </div>
              <div className="company-header__filing">
                <div>
                  <span>{ratiosResult.data.company.ticker}</span>
                  <small>Exchange ticker</small>
                </div>
                <div>
                  <span>{ratiosResult.data.filing.form}</span>
                  <small>Filed {ratiosResult.data.filing.filingDate}</small>
                </div>
                <a
                  href={ratiosResult.data.filing.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original filing ↗
                </a>
              </div>
            </header>

            <section className="ratios-section" aria-labelledby="ratios-heading">
              <header className="section-heading">
                <div>
                  <p className="eyebrow">Phase 01 / deterministic facts</p>
                  <h2 id="ratios-heading">The filed position</h2>
                </div>
                <p className="phase-status phase-status--done">
                  <span aria-hidden="true" /> XBRL settled
                </p>
              </header>
              <RatiosTable ratios={ratiosResult.data.ratios} />
            </section>

            <Suspense fallback={<SignalsSkeleton />}>
              <Signals ticker={ticker} />
            </Suspense>
          </>
        ) : (
          <div className="refusal-layout">
            <p className="refusal-layout__ticker">{ticker || "?"}</p>
            <RefusalPanel refusal={ratiosResult.refusal} />
            <Link href="/" className="text-link">
              Search another ticker ↙
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
