import type { Ratio, RatioUnit } from "@repo/core";

const compactNumber = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const monthNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatUsd(value: number): string {
  const sign = value < 0 ? "−" : "";
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    return `${sign}$${compactNumber.format(absoluteValue / 1_000_000_000)}B`;
  }
  if (absoluteValue >= 1_000_000) {
    return `${sign}$${compactNumber.format(absoluteValue / 1_000_000)}M`;
  }
  if (absoluteValue >= 1_000) {
    return `${sign}$${compactNumber.format(absoluteValue / 1_000)}K`;
  }

  return `${sign}$${compactNumber.format(absoluteValue)}`;
}

export function formatRatioValue(value: number, unit: RatioUnit): string {
  switch (unit) {
    case "usd":
      return formatUsd(value);
    case "percent":
      return `${compactNumber.format(value * 100)}%`;
    case "months": {
      const formatted = monthNumber.format(value);
      return `${formatted} ${value === 1 ? "month" : "months"}`;
    }
    case "ratio":
      return `${value.toFixed(2)}×`;
  }
}

type RatiosTableProps = {
  ratios: Ratio[];
};

export function RatiosTable({ ratios }: RatiosTableProps) {
  if (ratios.length === 0) {
    return (
      <div className="ratio-empty" role="status">
        <p className="eyebrow">Ratio engine / no output</p>
        <p>The committed XBRL fixture did not produce its ratio set.</p>
      </div>
    );
  }

  return (
    <ul className="ratios-grid" aria-label="Filed financial ratios">
      {ratios.map((ratio, index) => (
        <li className="ratio-cell" key={ratio.id}>
          <div className="ratio-cell__heading">
            <span className="ratio-cell__index">
              R{String(index + 1).padStart(2, "0")}
            </span>
            <h3>{ratio.label}</h3>
            <span className="ratio-cell__period">{ratio.period}</span>
          </div>
          {ratio.value === null ? (
            <div className="ratio-cell__missing">
              <strong>Not disclosed</strong>
              {ratio.note ? <p>{ratio.note}</p> : null}
            </div>
          ) : (
            <p className="ratio-cell__value">
              {formatRatioValue(ratio.value, ratio.unit)}
            </p>
          )}
          <p className="ratio-cell__source">
            <span>Filed {ratio.sourceConcepts.length > 1 ? "tags" : "tag"}</span>
            <code>{ratio.sourceConcepts.join(" + ") || "Not available"}</code>
          </p>
        </li>
      ))}
    </ul>
  );
}
