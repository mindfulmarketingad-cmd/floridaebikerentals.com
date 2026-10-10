#!/usr/bin/env node
/**
 * Writes the data-derived redirect list into vercel.json.
 *
 *   npm run redirects
 *
 * Vercel reads redirects from vercel.json before the build runs, so they have
 * to live in the committed file rather than be generated into dist/. Everything
 * else in vercel.json is left as it is. `npm run verify` fails when this file
 * is out of date, so a data refresh that changes which towns have pages cannot
 * ship without its redirects.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadListings, buildIndex } from "../src/data.mjs";
import { computeRedirects, vercelRedirects } from "../src/redirects.mjs";

const file = join(ROOT, "vercel.json");
const config = JSON.parse(readFileSync(file, "utf8"));
const listings = loadListings();
const list = computeRedirects(buildIndex(listings), listings);
config.redirects = vercelRedirects(list);
writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`vercel.json: ${list.length} redirects`);
