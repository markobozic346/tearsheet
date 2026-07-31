import type { Section } from "@repo/core";
import { expect, it, vi } from "vitest";

import { extractSignals } from "./index.js";

vi.mock("ai", () => ({
  generateObject: vi.fn(() => Promise.reject(new Error("model unavailable"))),
}));

const section: Section = {
  id: "risk-factors",
  title: "Item 1A. Risk Factors",
  text: "The business faces material risks.",
  charStart: 0,
  charEnd: 34,
};

it("returns an empty result without calling a model when no sections are supplied", async () => {
  const { generateObject } = await import("ai");

  await expect(extractSignals([])).resolves.toEqual({ ok: true, data: [] });
  expect(generateObject).not.toHaveBeenCalled();
});

it("refuses instead of throwing when the model call fails", async () => {
  await expect(extractSignals([section])).resolves.toEqual({
    ok: false,
    refusal: {
      reason: "fetch-failed",
      message: expect.stringContaining("model unavailable"),
    },
  });
});
