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

export function verify(dist, site) {
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
    if (html.includes("{{")) problems.push(`${pageUrl}: unreplaced template placeholder`);
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
