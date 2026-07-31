import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Result } from "@repo/core";
import { refuse } from "@repo/core";

/** SEC's fair-access policy allows ~10 req/s; stay comfortably under it. */
const MIN_REQUEST_INTERVAL_MS = 150;

export const DAY_MS = 24 * 60 * 60 * 1000;

export type CachePolicy = {
  /** Relative path of the cache file under `.edgar-cache/`. */
  key: string;
  /** How long a cached copy stays fresh. `Infinity` for immutable filings. */
  maxAgeMs: number;
};

export type FetchOutcome =
  | { kind: "ok"; body: string }
  | { kind: "http-error"; status: number }
  | { kind: "network-error"; message: string }
  | { kind: "not-configured" };

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Serialize all SEC requests through one queue with a minimum spacing. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cacheRoot(): string {
  const override = process.env.EDGAR_CACHE_DIR;
  if (override) return override;
  // Walk up to the workspace root so every package shares one cache.
  let dir = process.cwd();
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.join(dir, ".edgar-cache");
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.join(process.cwd(), ".edgar-cache");
    dir = parent;
  }
}

async function readFresh(file: string, maxAgeMs: number): Promise<string | undefined> {
  try {
    const s = await stat(file);
    if (Date.now() - s.mtimeMs > maxAgeMs) return undefined;
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Fetch a SEC URL with the mandatory `SEC_USER_AGENT` header, throttled, with a
 * read-through disk cache. A stale cached copy is served if SEC is unreachable.
 */
export async function fetchSec(url: string, cache: CachePolicy): Promise<FetchOutcome> {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) return { kind: "not-configured" };

  const file = path.join(cacheRoot(), cache.key);
  const cached = await readFresh(file, cache.maxAgeMs);
  if (cached !== undefined) return { kind: "ok", body: cached };

  const outcome = await throttled(async (): Promise<FetchOutcome> => {
    try {
      const res = await fetch(url, { headers: { "user-agent": userAgent } });
      if (!res.ok) return { kind: "http-error", status: res.status };
      return { kind: "ok", body: await res.text() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "network-error", message };
    }
  });

  if (outcome.kind === "ok") {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, outcome.body, "utf8");
    return outcome;
  }

  // Filings are immutable; on a network hiccup a stale copy beats nothing.
  const stale = await readFresh(file, Number.POSITIVE_INFINITY);
  if (stale !== undefined) return { kind: "ok", body: stale };
  return outcome;
}

/** Map a failed fetch to a user-readable `fetch-failed` refusal. */
export function fetchRefusal<T>(
  what: string,
  outcome: Exclude<FetchOutcome, { kind: "ok" }>,
): Result<T> {
  switch (outcome.kind) {
    case "not-configured":
      return refuse(
        "fetch-failed",
        "The server is missing the SEC_USER_AGENT contact header that SEC's fair-access policy requires, so EDGAR requests are disabled.",
      );
    case "http-error":
      return refuse(
        "fetch-failed",
        `SEC EDGAR returned HTTP ${outcome.status} while fetching ${what}.`,
      );
    case "network-error":
      return refuse(
        "fetch-failed",
        `Couldn't reach SEC EDGAR while fetching ${what} (${outcome.message}).`,
      );
  }
}
