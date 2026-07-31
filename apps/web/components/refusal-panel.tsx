import type { Refusal } from "@repo/core";

type RefusalPanelProps = {
  refusal: Refusal;
  title?: string;
};

export function RefusalPanel({
  refusal,
  title = "Tearsheet unavailable",
}: RefusalPanelProps) {
  return (
    <section className="refusal-panel" role="status" aria-live="polite">
      <span className="refusal-panel__mark" aria-hidden="true">
        !
      </span>
      <div>
        <p className="eyebrow">Refusal / {refusal.reason}</p>
        <h2>{title}</h2>
        <p>{refusal.message}</p>
      </div>
    </section>
  );
}
