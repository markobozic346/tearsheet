"use server";

import { redirect } from "next/navigation";

export async function openTicker(formData: FormData): Promise<never> {
  const value = formData.get("ticker");
  const ticker = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (ticker.length === 0) {
    redirect("/");
  }

  redirect(`/${encodeURIComponent(ticker)}`);
}
