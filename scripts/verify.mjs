/**
 * Post-build checks. Run with `node build.mjs --verify`.
 *
 *  - every internal href resolves to a file that exists in dist/
 *  - every page has exactly one <h1>, a title, a meta description and a canonical
 *  - titles and descriptions are unique and within sensible length limits
 *  - no page leaks an unescaped template placeholder
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else if (entry.endsWith(".html")) out.push(full);
  }
  return out;
}

function urlToFile(dist, url) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return join(dist, "index.html");
  if (clean.endsWith(".html")) return join(dist, clean.replace(/^\//, ""));
  if (/\.[a-z0-9]{2,12}$/i.test(clean)) return join(dist, clean.replace(/^\//, ""));
  return join(dist, clean.replace(/^\//, ""), "index.html");
}

export function verify(dist, site, { redirects = [], vercelConfig = null } = {}) {
  const files = walk(dist);
  const problems = [];
  const titles = new Map();
  const descriptions = new Map();
  let linkChecks = 0;

  for (const file of files) {
    const html = readFileSync(file, "utf8");
    const pageUrl = "/" + relative(dist, file).replace(/index\.html$/, "").replace(/\\/g, "/");

    const h1s = html.match(/<h1[\s>]/g) || [];
    if (h1s.length !== 1) problems.push(`${pageUrl}: expected 1 <h1>, found ${h1s.length}`);

    const decode = (t) => t.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const title = decode(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] || "");
    if (!title) problems.push(`${pageUrl}: missing <title>`);
    else {
      if (title.length > 70) problems.push(`${pageUrl}: title is ${title.length} chars — "${title}"`);
      const seen = titles.get(title);
      if (seen) problems.push(`${pageUrl}: duplicate title with ${seen}`);
      else titles.set(title, pageUrl);
    }

    const desc = decode(/<meta name="description" content="([\s\S]*?)">/.exec(html)?.[1] || "");
    if (!desc) problems.push(`${pageUrl}: missing meta description`);
    else if (desc.length > 175) problems.push(`${pageUrl}: description is ${desc.length} chars`);
    else {
      const seen = descriptions.get(desc);
      if (seen) problems.push(`${pageUrl}: duplicate description with ${seen}`);
      else descriptions.set(desc, pageUrl);
    }

    if (!/<link rel="canonical" href="/.test(html)) problems.push(`${pageUrl}: missing canonical`);

    // OpenStreetMap's volunteer tile servers forbid this kind of use and will
    // return 403 "Access blocked". The tile provider belongs in site.json.
    if (html.includes("tile.openstreetmap.org")) {
      problems.push(`${pageUrl}: references tile.openstreetmap.org, whose usage policy forbids this; set map.tileUrl in data/site.json`);
    }

    // An AdSense unit with no slot ID can never fill and leaves a blank gap.
    for (const unit of html.matchAll(/<ins class="adsbygoogle"[\s\S]*?>/g)) {
      if (!/data-ad-slot="\d+"/.test(unit[0])) {
        problems.push(`${pageUrl}: AdSense unit has no data-ad-slot, so it can never fill`);
      }
    }
    if (html.includes("{{")) problems.push(`${pageUrl}: unreplaced template placeholder`);
    // Ratings here come from Google and Viator; marking them up as this site's
    // own breaks Google's review-snippet guidelines. Only /shop/ may carry
    // Product markup, for products it actually links to.
    if (/"aggregateRating"/.test(html)) problems.push(`${pageUrl}: marks up a third-party rating (aggregateRating)`);
    if (!pageUrl.startsWith("/shop/") && /"@type":"Product"|"@type": "Product"/.test(html)) {
      problems.push(`${pageUrl}: Product markup outside /shop/`);
    }
    // Every page must name the host the site is actually served from.
    const canon = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] || "";
    if (canon && !canon.startsWith(site.url)) problems.push(`${pageUrl}: canonical ${canon} is not on ${site.url}`);
    if (/undefined|\[object Object\]/.test(html.replace(/undefined-/g, ""))) {
      problems.push(`${pageUrl}: contains "undefined" or "[object Object]"`);
    }

    // Every page carries a featured image plus at least one more in the content.
    const mainStart = html.indexOf('<main id="main">');
    const mainEnd = html.indexOf("</main>");
    if (mainStart !== -1 && mainEnd !== -1) {
      const main = html.slice(mainStart, mainEnd);
      const contentImages = [...main.matchAll(/<img [^>]*src="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((src) => !/logo|favicon|mark\.svg/.test(src));
      if (contentImages.length < 2) {
        problems.push(`${pageUrl}: has ${contentImages.length} content image(s), expected a featured image plus one more`);
      }
    }

    for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
      const target = match[1];
      if (target.startsWith("//")) continue;
      linkChecks++;
      const resolved = urlToFile(dist, target);
      if (!existsSync(resolved)) problems.push(`${pageUrl}: broken internal link -> ${target}`);
    }
  }

  // A trail guide without a route map is incomplete; the hub page itself is exempt.
  for (const file of files) {
    const url = "/" + relative(dist, file).replace(/index\.html$/, "").replace(/\\/g, "/");
    if (!/^\/trails\/.+\//.test(url)) continue;
    const html = readFileSync(file, "utf8");
    if (!html.includes("ridewithgps.com/embeds")) {
      problems.push(`${url}: trail guide has no Ride with GPS route map (add "rwgps: <route id>" to its front matter)`);
    }
  }

  // Redirects: none may shadow a page that still exists, none may point at
  // another redirect (a chain), and every destination must be a real page.
  const sources = new Set(redirects.map((r) => r.source));
  for (const r of redirects) {
    if (r.source.includes(":")) continue; // pattern rule: no single file to check
    if (existsSync(urlToFile(dist, r.source))) {
      problems.push(`redirect ${r.source}: a page is still built there, so the redirect would hide it`);
    }
    if (sources.has(r.destination)) problems.push(`redirect ${r.source}: chains through ${r.destination}`);
    if (!existsSync(urlToFile(dist, r.destination))) {
      problems.push(`redirect ${r.source}: destination ${r.destination} does not exist`);
    }
  }

  // vercel.json is what the live host reads, and it is committed rather than
  // built, so check it has not drifted from the data.
  if (vercelConfig) {
    const want = JSON.stringify(redirects.map((r) => [r.source, r.destination]));
    const have = JSON.stringify((vercelConfig.redirects || []).map((r) => [r.source, r.destination]));
    if (want !== have) {
      problems.push(
        `vercel.json redirects are out of date (${(vercelConfig.redirects || []).length} there, ${redirects.length} needed). Run: npm run redirects`
      );
    }
  }

  const unique = [...new Set(problems)];
  console.log(`\nverify: ${files.length} pages, ${linkChecks} internal links checked`);
  if (!unique.length) {
    console.log("verify: no problems found");
    return true;
  }
  console.log(`verify: ${unique.length} problem(s):`);
  for (const problem of unique.slice(0, 60)) console.log("  - " + problem);
  if (unique.length > 60) console.log(`  ... and ${unique.length - 60} more`);
  return false;
}
