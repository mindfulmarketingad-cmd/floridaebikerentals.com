#!/usr/bin/env node
/**
 * Refreshes data/tours.json from the Viator Partner API.
 *
 *   VIATOR_API_KEY=... node scripts/refresh-tours.mjs            rewrite the snapshot
 *   VIATOR_API_KEY=... node scripts/refresh-tours.mjs --dry-run  count only
 *
 * The key is read from the environment only; it is never written or printed.
 * A short result (fewer than --min tours, default 60) never overwrites the
 * snapshot. Commit the rewritten file with the day's other changes so Vercel
 * builds once.
 *
 * Production builds on Vercel run the same refresh automatically (build.mjs),
 * because that is where the key lives; this script is for refreshing the
 * committed snapshot itself.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadSite, loadListings, buildIndex } from "../src/data.mjs";
import { fetchViatorTours, placeResolver } from "../src/tours.mjs";

export async function refreshTours({ write = true, min = 60, budgetMs = 120_000, log = console.log } = {}) {
  const file = join(ROOT, "data", "tours.json");
  const existing = JSON.parse(readFileSync(file, "utf8"));
  const tours = await fetchViatorTours({
    key: process.env.VIATOR_API_KEY,
    site: loadSite(),
    places: placeResolver(buildIndex(loadListings())),
    budgetMs,
    log,
  });
  if (tours.length < min) throw new Error(`only ${tours.length} tours returned (min ${min}); snapshot kept`);
  const payload = { ...existing, updated: new Date().toISOString().slice(0, 10), tours };
  if (write) writeFileSync(file, `${JSON.stringify(payload, null, 1)}\n`);
  return tours.length;
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshTours({ write: !args.includes("--dry-run") })
    .then((n) => console.log(`${args.includes("--dry-run") ? "would write" : "wrote"} ${n} tours to data/tours.json`))
    .catch((e) => {
      console.error(`refresh-tours: ${e.message}`);
      process.exit(1);
    });
}
