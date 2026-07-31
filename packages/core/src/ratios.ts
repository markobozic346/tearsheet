import type { Ratio, RatioId, RatioUnit, XbrlFact } from "./types";

const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const;
const COST_OF_REVENUE_CONCEPTS = ["CostOfGoodsAndServicesSold", "CostOfRevenue"] as const;
const NET_INCOME_CONCEPTS = ["NetIncomeLoss"] as const;
const CASH_CONCEPTS = ["CashAndCashEquivalentsAtCarryingValue"] as const;
const OPERATING_CASH_FLOW_CONCEPTS = [
  "NetCashProvidedByUsedInOperatingActivities",
] as const;
const LIABILITIES_CONCEPTS = ["Liabilities"] as const;
const ASSETS_CONCEPTS = ["Assets"] as const;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_FISCAL_YEAR_DAYS = 250;
const MAX_FISCAL_YEAR_DAYS = 400;

type FactContext = {
  fiscalYear: number;
  end: string;
};

type Resolution =
  | {
      ok: true;
      fact: XbrlFact;
      sourceConcepts: string[];
    }
  | {
      ok: false;
      note: string;
      sourceConcepts: string[];
    };

function isAnnualUsdFact(fact: XbrlFact): boolean {
  return (
    fact.fiscalPeriod === "FY" &&
    (fact.form === "10-K" || fact.form === "10-K/A") &&
    fact.unit === "USD"
  );
}

function periodLabel(context: FactContext | null): string {
  return context ? `FY${context.fiscalYear}` : "";
}

function missingConceptNote(
  concepts: readonly string[],
  context: FactContext | null,
): string {
  const period = periodLabel(context);
  const suffix = period ? ` for ${period}` : "";

  return `Missing XBRL concept ${concepts.join(" or ")}${suffix}.`;
}

function currentContext(facts: XbrlFact[]): FactContext | null {
  const firstFact = facts[0];

  if (!firstFact) {
    return null;
  }

  let fiscalYear = firstFact.fiscalYear;
  for (const fact of facts) {
    if (fact.fiscalYear > fiscalYear) {
      fiscalYear = fact.fiscalYear;
    }
  }

  const factsFromLatestFiling = facts.filter((fact) => fact.fiscalYear === fiscalYear);
  const firstLatestFact = factsFromLatestFiling[0];

  if (!firstLatestFact) {
    return null;
  }

  let end = firstLatestFact.end;
  for (const fact of factsFromLatestFiling) {
    if (fact.end > end) {
      end = fact.end;
    }
  }

  return { fiscalYear, end };
}

function resolveFact(
  facts: XbrlFact[],
  context: FactContext | null,
  concepts: readonly string[],
): Resolution {
  if (!context) {
    return {
      ok: false,
      note: missingConceptNote(concepts, context),
      sourceConcepts: [],
    };
  }

  for (const concept of concepts) {
    const candidates = facts.filter(
      (fact) =>
        fact.fiscalYear === context.fiscalYear &&
        fact.end === context.end &&
        fact.concept === concept,
    );
    const candidate = candidates[0];

    if (!candidate) {
      continue;
    }

    if (!Number.isFinite(candidate.value)) {
      return {
        ok: false,
        note: `XBRL concept ${concept} does not have a finite value for ${periodLabel(context)}.`,
        sourceConcepts: [concept],
      };
    }

    if (candidates.some((fact) => fact.value !== candidate.value)) {
      return {
        ok: false,
        note: `XBRL concept ${concept} has conflicting values for ${periodLabel(context)}.`,
        sourceConcepts: [concept],
      };
    }

    return {
      ok: true,
      fact: candidate,
      sourceConcepts: [concept],
    };
  }

  return {
    ok: false,
    note: missingConceptNote(concepts, context),
    sourceConcepts: [],
  };
}

function latestEnd(facts: XbrlFact[]): string | null {
  const firstFact = facts[0];

  if (!firstFact) {
    return null;
  }

  let end = firstFact.end;
  for (const fact of facts) {
    if (fact.end > end) {
      end = fact.end;
    }
  }

  return end;
}

function latestFiscalYear(facts: XbrlFact[]): number | null {
  const firstFact = facts[0];

  if (!firstFact) {
    return null;
  }

  let fiscalYear = firstFact.fiscalYear;
  for (const fact of facts) {
    if (fact.fiscalYear > fiscalYear) {
      fiscalYear = fact.fiscalYear;
    }
  }

  return fiscalYear;
}

function isImmediatelyPriorFiscalYearEnd(currentEnd: string, priorEnd: string): boolean {
  const daysBeforeCurrentEnd =
    (Date.parse(currentEnd) - Date.parse(priorEnd)) / MILLISECONDS_PER_DAY;

  return (
    Number.isFinite(daysBeforeCurrentEnd) &&
    daysBeforeCurrentEnd >= MIN_FISCAL_YEAR_DAYS &&
    daysBeforeCurrentEnd <= MAX_FISCAL_YEAR_DAYS
  );
}

function consecutiveRevenueYearsNote(): string {
  return `Revenue growth requires ${REVENUE_CONCEPTS.join(" or ")} for two consecutive fiscal years.`;
}

function resolvePriorRevenue(facts: XbrlFact[], current: FactContext | null): Resolution {
  if (!current) {
    return {
      ok: false,
      note: consecutiveRevenueYearsNote(),
      sourceConcepts: [],
    };
  }

  const priorRevenueFacts = facts.filter(
    (fact) =>
      REVENUE_CONCEPTS.some((concept) => concept === fact.concept) &&
      isImmediatelyPriorFiscalYearEnd(current.end, fact.end),
  );
  const latestFilingComparatives = priorRevenueFacts.filter(
    (fact) => fact.fiscalYear === current.fiscalYear,
  );
  const candidates =
    latestFilingComparatives.length > 0 ? latestFilingComparatives : priorRevenueFacts;
  const end = latestEnd(candidates);

  if (!end) {
    return {
      ok: false,
      note: consecutiveRevenueYearsNote(),
      sourceConcepts: [],
    };
  }

  const fiscalYear = latestFiscalYear(candidates.filter((fact) => fact.end === end));

  if (fiscalYear === null) {
    return {
      ok: false,
      note: consecutiveRevenueYearsNote(),
      sourceConcepts: [],
    };
  }

  return resolveFact(facts, { fiscalYear, end }, REVENUE_CONCEPTS);
}

function mergeSourceConcepts(...sources: string[][]): string[] {
  const merged: string[] = [];

  for (const source of sources) {
    for (const concept of source) {
      if (!merged.includes(concept)) {
        merged.push(concept);
      }
    }
  }

  return merged;
}

function scalarRatio(
  id: RatioId,
  label: string,
  unit: RatioUnit,
  period: string,
  resolution: Resolution,
): Ratio {
  if (!resolution.ok) {
    return {
      id,
      label,
      value: null,
      unit,
      period,
      sourceConcepts: resolution.sourceConcepts,
      note: resolution.note,
    };
  }

  return {
    id,
    label,
    value: resolution.fact.value,
    unit,
    period,
    sourceConcepts: resolution.sourceConcepts,
  };
}

/** Compute every ratio from annual 10-K XBRL facts without I/O or formatting. */
export function computeRatios(facts: XbrlFact[]): Ratio[] {
  const annualFacts = facts.filter(isAnnualUsdFact);
  const context = currentContext(annualFacts);
  const period = periodLabel(context);
  const revenue = resolveFact(annualFacts, context, REVENUE_CONCEPTS);
  const priorRevenue = resolvePriorRevenue(annualFacts, context);
  const costOfRevenue = resolveFact(annualFacts, context, COST_OF_REVENUE_CONCEPTS);
  const netIncome = resolveFact(annualFacts, context, NET_INCOME_CONCEPTS);
  const cash = resolveFact(annualFacts, context, CASH_CONCEPTS);
  const operatingCashFlow = resolveFact(
    annualFacts,
    context,
    OPERATING_CASH_FLOW_CONCEPTS,
  );
  const liabilities = resolveFact(annualFacts, context, LIABILITIES_CONCEPTS);
  const assets = resolveFact(annualFacts, context, ASSETS_CONCEPTS);

  const revenueGrowthSources = mergeSourceConcepts(
    revenue.sourceConcepts,
    priorRevenue.sourceConcepts,
  );
  let revenueGrowth: Ratio;
  if (!revenue.ok) {
    revenueGrowth = {
      id: "revenue-growth",
      label: "Revenue growth",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: revenueGrowthSources,
      note: revenue.note,
    };
  } else if (!priorRevenue.ok) {
    revenueGrowth = {
      id: "revenue-growth",
      label: "Revenue growth",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: revenueGrowthSources,
      note: priorRevenue.note,
    };
  } else if (priorRevenue.fact.value === 0) {
    revenueGrowth = {
      id: "revenue-growth",
      label: "Revenue growth",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: revenueGrowthSources,
      note: "Prior-year revenue is zero, so revenue growth cannot be calculated.",
    };
  } else {
    revenueGrowth = {
      id: "revenue-growth",
      label: "Revenue growth",
      value: (revenue.fact.value - priorRevenue.fact.value) / priorRevenue.fact.value,
      unit: "percent",
      period,
      sourceConcepts: revenueGrowthSources,
    };
  }

  const grossMarginSources = mergeSourceConcepts(
    revenue.sourceConcepts,
    costOfRevenue.sourceConcepts,
  );
  let grossMargin: Ratio;
  if (!revenue.ok) {
    grossMargin = {
      id: "gross-margin",
      label: "Gross margin",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: grossMarginSources,
      note: revenue.note,
    };
  } else if (!costOfRevenue.ok) {
    grossMargin = {
      id: "gross-margin",
      label: "Gross margin",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: grossMarginSources,
      note: costOfRevenue.note,
    };
  } else if (revenue.fact.value === 0) {
    grossMargin = {
      id: "gross-margin",
      label: "Gross margin",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: grossMarginSources,
      note: `Revenue is zero for ${period}, so gross margin cannot be calculated.`,
    };
  } else {
    grossMargin = {
      id: "gross-margin",
      label: "Gross margin",
      value: (revenue.fact.value - costOfRevenue.fact.value) / revenue.fact.value,
      unit: "percent",
      period,
      sourceConcepts: grossMarginSources,
    };
  }

  const netMarginSources = mergeSourceConcepts(
    netIncome.sourceConcepts,
    revenue.sourceConcepts,
  );
  let netMargin: Ratio;
  if (!netIncome.ok) {
    netMargin = {
      id: "net-margin",
      label: "Net margin",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: netMarginSources,
      note: netIncome.note,
    };
  } else if (!revenue.ok) {
    netMargin = {
      id: "net-margin",
      label: "Net margin",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: netMarginSources,
      note: revenue.note,
    };
  } else if (revenue.fact.value === 0) {
    netMargin = {
      id: "net-margin",
      label: "Net margin",
      value: null,
      unit: "percent",
      period,
      sourceConcepts: netMarginSources,
      note: `Revenue is zero for ${period}, so net margin cannot be calculated.`,
    };
  } else {
    netMargin = {
      id: "net-margin",
      label: "Net margin",
      value: netIncome.fact.value / revenue.fact.value,
      unit: "percent",
      period,
      sourceConcepts: netMarginSources,
    };
  }

  const runwaySources = mergeSourceConcepts(
    cash.sourceConcepts,
    operatingCashFlow.sourceConcepts,
  );
  let runway: Ratio;
  if (!cash.ok) {
    runway = {
      id: "runway",
      label: "Runway",
      value: null,
      unit: "months",
      period,
      sourceConcepts: runwaySources,
      note: cash.note,
    };
  } else if (!operatingCashFlow.ok) {
    runway = {
      id: "runway",
      label: "Runway",
      value: null,
      unit: "months",
      period,
      sourceConcepts: runwaySources,
      note: operatingCashFlow.note,
    };
  } else if (operatingCashFlow.fact.value >= 0) {
    const cashFlowState = operatingCashFlow.fact.value > 0 ? "positive" : "zero";
    runway = {
      id: "runway",
      label: "Runway",
      value: null,
      unit: "months",
      period,
      sourceConcepts: runwaySources,
      note: `Operating cash flow is ${cashFlowState} for ${period}, so the company has no cash burn.`,
    };
  } else {
    runway = {
      id: "runway",
      label: "Runway",
      value: cash.fact.value / (-operatingCashFlow.fact.value / 12),
      unit: "months",
      period,
      sourceConcepts: runwaySources,
    };
  }

  const liabilitiesToAssetsSources = mergeSourceConcepts(
    liabilities.sourceConcepts,
    assets.sourceConcepts,
  );
  let liabilitiesToAssets: Ratio;
  if (!liabilities.ok) {
    liabilitiesToAssets = {
      id: "liabilities-to-assets",
      label: "Liabilities / assets",
      value: null,
      unit: "ratio",
      period,
      sourceConcepts: liabilitiesToAssetsSources,
      note: liabilities.note,
    };
  } else if (!assets.ok) {
    liabilitiesToAssets = {
      id: "liabilities-to-assets",
      label: "Liabilities / assets",
      value: null,
      unit: "ratio",
      period,
      sourceConcepts: liabilitiesToAssetsSources,
      note: assets.note,
    };
  } else if (assets.fact.value === 0) {
    liabilitiesToAssets = {
      id: "liabilities-to-assets",
      label: "Liabilities / assets",
      value: null,
      unit: "ratio",
      period,
      sourceConcepts: liabilitiesToAssetsSources,
      note: `Assets are zero for ${period}, so liabilities to assets cannot be calculated.`,
    };
  } else {
    liabilitiesToAssets = {
      id: "liabilities-to-assets",
      label: "Liabilities / assets",
      value: liabilities.fact.value / assets.fact.value,
      unit: "ratio",
      period,
      sourceConcepts: liabilitiesToAssetsSources,
    };
  }

  return [
    scalarRatio("revenue", "Revenue", "usd", period, revenue),
    revenueGrowth,
    grossMargin,
    scalarRatio("net-income", "Net income", "usd", period, netIncome),
    netMargin,
    scalarRatio("cash", "Cash", "usd", period, cash),
    runway,
    liabilitiesToAssets,
  ];
}
