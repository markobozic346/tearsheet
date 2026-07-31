# apps/web — agent rules

The tearsheet UI. Next.js App Router, React Server Components.

- **Two-phase render is the architecture, not an optimisation.** Ratios resolve in ~2s and
  render immediately. Signals take 20–40s and live inside a `<Suspense>` boundary that
  streams in. Never `await` signals in the same component as ratios — that reintroduces the
  blank-page-for-40-seconds problem and risks the serverless timeout.
- **The UI is where the split becomes visible.** Deterministic numbers arrive first and look
  settled; grounded signal fills in after. That's the product's whole argument, rendered.
- **Formatting lives here.** `core` returns raw numbers and a `unit`; currency symbols,
  percentages, and rounding are this layer's job.
- **`value: null` means not disclosed.** Say so in the UI. Never render `0`, `—` without
  explanation, or a dash that reads as zero.
- **Render `Refusal.message` verbatim.** It's written to be read by a user.
- **Every signal is clickable through to its source.** `Signal.locator` gives section and
  offset — a claim the user can't trace back to the filing shouldn't be on screen.
- Server Components by default. `"use client"` only where interaction genuinely requires it.
