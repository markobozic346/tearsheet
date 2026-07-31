import { openTicker } from "../app/actions";

type TickerFormProps = {
  compact?: boolean;
  currentTicker?: string;
};

export function TickerForm({ compact = false, currentTicker }: TickerFormProps) {
  return (
    <form
      action={openTicker}
      className={`ticker-form${compact ? " ticker-form--compact" : ""}`}
    >
      <label className="sr-only" htmlFor={compact ? "ticker-compact" : "ticker"}>
        Company ticker
      </label>
      <span className="ticker-form__prompt" aria-hidden="true">
        TICKER /
      </span>
      <input
        id={compact ? "ticker-compact" : "ticker"}
        name="ticker"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={10}
        pattern="[A-Za-z0-9.\-]{1,10}"
        placeholder="AAPL"
        defaultValue={currentTicker}
        required
        aria-describedby={compact ? undefined : "ticker-hint"}
      />
      <button type="submit">
        <span>{compact ? "Open" : "Build tearsheet"}</span>
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
