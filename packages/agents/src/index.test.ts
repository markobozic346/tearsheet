import { expect, it } from "vitest";

import { extractSignals } from "./index.js";

it("returns an empty result without calling a model when no sections are supplied", async () => {
  await expect(extractSignals([])).resolves.toEqual({ ok: true, data: [] });
});
