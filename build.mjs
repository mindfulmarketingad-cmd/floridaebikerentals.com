#!/usr/bin/env node
/**
 * Static site builder for FloridaEbikeRentals.com
 *
 *   node build.mjs            build into dist/
 *   node build.mjs --verify   build, then check every internal link resolves
 *
 * No runtime dependencies: the output is plain HTML, CSS and one JS file.
 */
import { mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

import { titleCase, slugify, isoDate } from "./src/util.mjs";
import {
  ROOT, loadSite, loadListings, loadTownNotes, loadBlog, loadStaticPages, loadAuthors, loadHubEntries,
  buildIndex, statsFor, assignTitles, loadShop, SEARCH_QUERIES, CONTENT_HUBS,
} from "./src/data.mjs";
import { homePage } from "./src/pages/home.mjs";
import { findHub, categoryPage, categoryTownPage } from "./src/pages/find.mjs";
import { citiesHub, cityPage } from "./src/pages/cities.mjs";
import { batteryPage, batteryTowns, batteryTownPage, BATTERY_URL } from "./src/pages/battery.mjs";
import { businessPage, BUSINESS_URL } from "./src/pages/business.mjs";
import { rentPage, rentPaidPage, adminLeadsPage, adminShopsJson, RENT_URL, RENT_PAID_URL, ADMIN_LEADS_URL, ADMIN_SHOPS_JSON } from "./src/pages/rent.mjs";
import { cityTrailGuides, cityTrailPage, cityTrailHubSection } from "./src/pages/city-trails.mjs";
import { cityTypePages, cityTypePage } from "./src/pages/city-types.mjs";
import { makeCityLinker } from "./src/city-links.mjs";
import { assignBikeTypes } from "./src/bike-types.mjs";
import { galleryPage, GALLERY_URL } from "./src/pages/gallery.mjs";
import { finderData } from "./src/finder.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { regionPosts } from "./src/region-posts.mjs";
import { nearMePage, NEAR_ME_URL } from "./src/pages/near-me.mjs";
import { computeRedirects, netlifyRedirects, redirectMap } from "./src/redirects.mjs";
import { partnersHub, partnerPage, PER_PAGE as PARTNERS_PER_PAGE } from "./src/pages/partners.mjs";
import { blogHub, blogPost } from "./src/pages/blog.mjs";
import { searchHub, searchQueryPage } from "./src/pages/search.mjs";
import { staticPage, sitemapPage, notFoundPage } from "./src/pages/static.mjs";
import { contentHub, contentEntry, authorsHub, authorPage } from "./src/pages/hub.mjs";
import { shopHub, productPage } from "./src/pages/shop.mjs";
import { summaryFor } from "./src/components.mjs";

const DIST = join(ROOT, "dist");
const written = new Map(); // url path -> { lastmod, priority, changefreq, group }

/* Sitemap lastmod for generated pages (listings, towns, /find/, bike types):
   the date the shop data last changed, not the build date, so the value only
   moves when the pages' content does and Google can keep trusting it. Taken
   from the last commit touching data/; falls back to today where git history
   is not available. */
const DATA_LASTMOD = (() => {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", "data"], {
      cwd: new URL(".", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch { /* no git here */ }
  return isoDate(new Date());
})();
const searchIndex = [];
let redirectsBySource = new Map();

/**
 * Points every internal link at its final URL. Hand-written links in posts and
 * templates still name old addresses (/partners/<shop>/, the old /find/ town
 * pages); rewriting them here means no page ever links through a redirect.
 */
function resolveLinks(html) {
  if (!redirectsBySource.size) return html;
  return html.replace(/href="(\/[^"#?]*)([#?][^"]*)?"/g, (match, path, rest = "") => {
    const to = redirectsBySource.get(path);
    if (!to) return match;
    return `href="${to}${to.includes("#") ? "" : rest}"`;
  });
}

/** Every page's H1 in Title Case, text only (tags and attributes untouched). */
function titleCaseH1(html) {
  return html.replace(/(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/g, (_, open, inner, close) =>
    open +
    inner.replace(/(^|>)([^<]+)/g, (m, gt, text, offset) =>
      gt + titleCase(text, { first: offset === 0, last: !inner.slice(offset + m.length).replace(/<[^>]*>/g, "").trim() })
    ) +
    close
  );
}

function write(urlPath, html, meta = {}) {
  html = titleCaseH1(resolveLinks(html));
  const file = urlPath.endsWith(".html")
    ? join(DIST, urlPath.replace(/^\//, ""))
    : join(DIST, urlPath.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html, "utf8");
  // The page's own robots meta decides sitemap membership, so a noindex page
  // can never be submitted to Google by mistake.
  const noindex = /<meta name="robots" content="noindex/.test(html);
  if (!meta.skipSitemap && !noindex) {
    written.set(urlPath, {
      lastmod: meta.lastmod || DATA_LASTMOD,
      priority: meta.priority ?? 0.5,
      changefreq: meta.changefreq || "monthly",
      group: meta.group || "pages",
    });
  }
  if (meta.search) searchIndex.push(meta.search);
}

function writeRaw(name, contents) {
  const file = join(DIST, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents, "utf8");
}

/* ------------------------------------------------------------- build */

console.time("build");
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const site = loadSite();
const listings = assignTitles(loadListings());
const index = buildIndex(listings);
const blog = loadBlog();
const pages = loadStaticPages();
const stats = statsFor(listings);
const queries = SEARCH_QUERIES.map((query) => ({ query, slug: slugify(query), url: `/search/${slugify(query)}/` }));
const authors = loadAuthors();
const authorsBySlug = new Map(authors.map((a) => [a.slug, a]));
const hubEntries = Object.fromEntries(CONTENT_HUBS.map((hub) => [hub.slug, loadHubEntries(hub)]));
assignBikeTypes(listings, hubEntries["electric-bike-types"]);
const shop = loadShop();
const townNotes = loadTownNotes();
const redirects = computeRedirects(index, listings);
redirectsBySource = redirectMap(redirects);
const trailFile = join(ROOT, "data", "city-trails.json");
const trailData = existsSync(trailFile) ? JSON.parse(readFileSync(trailFile, "utf8")) : { cities: {} };
const cityGuides = cityTrailGuides(index, trailData);
// Region roundups join the blog, newest first.
blog.push(...regionPosts({ listings, index, cityGuides, date: "2026-10-15" }));
blog.sort((a, b) => String(b.date).localeCompare(String(a.date)));
const ctx = { listings, index, blog, stats, queries, pages, authors, authorsBySlug, hubEntries, shop, townNotes };
// Town + bike type pages, and the block that links every page about a town together.
ctx.batteryTownList = batteryTowns(listings, index);
ctx.cityTypeList = cityTypePages(index, hubEntries, cityGuides);
ctx.cityLinker = makeCityLinker({ index, blog, hubEntries, cityGuides, batteryTownList: ctx.batteryTownList, cityTypeList: ctx.cityTypeList, queries });

/* the finder's copy of the directory, fingerprinted so a new build is never served stale */
{
  const json = JSON.stringify(finderData(listings));
  writeRaw("data/finder.json", json);
  ctx.finderUrl = `/data/finder.json?v=${createHash("sha256").update(json).digest("hex").slice(0, 10)}`;
}

/* home */
write("/", homePage(site, ctx), {
  priority: 1.0,
  changefreq: "daily",
  group: "pages",
  search: { u: "/", t: "Florida Ebike Rentals", s: "Home", d: site.description, k: "florida ebike rentals home directory electric bike", w: 20 },
});

/* /cities/: the directory by place */
write("/cities/", citiesHub(site, ctx), {
  priority: 0.9,
  changefreq: "weekly",
  group: "find",
  search: { u: "/cities/", t: "Florida cities with bike rentals", s: "Cities", d: "Every Florida town in the directory, with the number of shops in each.", k: "cities towns regions florida ebike rentals", w: 15 },
});

for (const city of index.cities) {
  write(city.url, cityPage(site, city, ctx), {
    priority: 0.8,
    changefreq: "weekly",
    group: "find",
    search: {
      u: city.url,
      t: `E-bike rentals in ${city.name}, FL`,
      s: "Town",
      d: `${city.listings.length} rental shops in ${city.name}.`,
      k: `${city.name} ${city.region} ${city.listings.slice(0, 6).map((l) => l.name).join(" ")}`.toLowerCase(),
      w: 8,
    },
  });
}

/* town + bike type pages: /cities/<town>/<type>-rentals/ */
{
  const taken = new Set(listings.map((l) => l.url));
  for (const p of ctx.cityTypeList) {
    if (taken.has(p.url)) throw new Error(`town type page ${p.url} collides with a listing page`);
    write(p.url, cityTypePage(site, p, ctx), {
      priority: 0.6,
      changefreq: "weekly",
      group: "bike-type-towns",
      search: p.indexable
        ? {
            u: p.url,
            t: p.title,
            s: "Town",
            d: `${p.rentals.length} rental shops in ${p.city.name}.`,
            k: `${p.type.name} ${p.type.short} ${p.city.name}`.toLowerCase(),
            w: 4,
          }
        : undefined,
    });
  }
}

/* /find/: the directory by category, statewide and per town */
write("/find/", findHub(site, ctx), {
  priority: 0.9,
  changefreq: "weekly",
  group: "find",
  search: { u: "/find/", t: "Find e-bike rentals by category", s: "Find", d: "Tours, delivery, beach rentals, family-friendly shops and more.", k: "find category tours delivery family beach scooters florida ebike rentals", w: 15 },
});

for (const category of index.categories) {
  write(category.url, categoryPage(site, category, ctx), {
    priority: 0.8,
    changefreq: "weekly",
    group: "find",
    search: { u: category.url, t: category.title, s: "Find", d: category.blurb, k: `${category.name} ${category.title}`.toLowerCase(), w: 9 },
  });
  for (const town of category.towns.filter((t) => t.ownPage)) {
    write(town.url, categoryTownPage(site, category, town, ctx), {
      priority: 0.6,
      changefreq: "weekly",
      group: "find",
      search: {
        u: town.url,
        t: `${category.name} in ${town.city.name}, FL`,
        s: "Find",
        d: `${town.listings.length} shops in ${town.city.name}.`,
        k: `${category.name} ${town.city.name}`.toLowerCase(),
        w: 5,
      },
    });
  }
}

/* /gallery/: every photo on the site */
write(GALLERY_URL, galleryPage(site, ctx), {
  priority: 0.5,
  changefreq: "monthly",
  group: "pages",
  search: { u: GALLERY_URL, t: "Electric Bike Rentals in Florida Gallery", s: "Page", d: "Every photo on the site: e-bikes, rental shops and Florida towns.", k: "gallery photos pictures images ebike rentals florida", w: 5 },
});

/* for businesses: priority caller status */
write(BUSINESS_URL, businessPage(site, ctx), {
  priority: 0.6,
  changefreq: "monthly",
  group: "pages",
  search: { u: BUSINESS_URL, t: "For businesses", s: "Page", d: "Priority caller status for rental shops.", k: "business partner priority calls rental shop advertise list my shop", w: 5 },
});

/* Book Through Us: the request form the finder's result cards link to, and the owner's private lead desk */
write(RENT_URL, rentPage(site, ctx), {
  priority: 0.7,
  changefreq: "monthly",
  group: "pages",
  search: { u: RENT_URL, t: "Book an e-bike through us", s: "Page", d: "Send one request and we find and book a shop for you.", k: "rent book booking reserve request e-bike rental now", w: 6 },
});
write(RENT_PAID_URL, rentPaidPage(site), { skipSitemap: true });
write(ADMIN_LEADS_URL, adminLeadsPage(site), { skipSitemap: true });
writeRaw(ADMIN_SHOPS_JSON.replace(/^\//, ""), adminShopsJson(assignTitles(loadListings({ raw: true })), index));

/* e-bike battery replacement, statewide and per town */
for (const town of ctx.batteryTownList) {
  write(town.url, batteryTownPage(site, town, ctx), {
    priority: 0.6,
    changefreq: "weekly",
    group: "find",
    search: { u: town.url, t: `Ebike battery replacement in ${town.city.name}`, s: "Find", d: `${town.local.length} shops in ${town.city.name}.`, k: `ebike battery replacement ${town.city.name}`.toLowerCase(), w: 5 },
  });
}
// The capitalised spelling (/find/Battery-replacement/...) forwards to the
// lowercase pages. Host redirects may match paths case-insensitively, which
// would loop, so these are static pages with an instant refresh and a
// canonical link, which search engines treat as a permanent redirect.
for (const target of [BATTERY_URL, ...ctx.batteryTownList.map((t) => t.url)]) {
  const from = target.replace("/find/battery-replacement/", "/find/Battery-replacement/");
  const abs = `${site.url}${target}`;
  writeRaw(
    `${from.slice(1)}index.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex, follow"><link rel="canonical" href="${abs}"><meta http-equiv="refresh" content="0; url=${target}"></head><body data-redirect><p><a href="${target}">This page has moved.</a></p></body></html>`
  );
}
write(BATTERY_URL, batteryPage(site, ctx), {
  priority: 0.8,
  changefreq: "weekly",
  group: "find",
  search: { u: BATTERY_URL, t: "Ebike battery replacement", s: "Find", d: "Battery specialists and e-bike repair shops in Florida.", k: "ebike battery replacement repair lithium e-bike battery shop", w: 9 },
});

/* "near me": the biggest non-brand search cluster, which had no page of its own */
write(NEAR_ME_URL, nearMePage(site, ctx), {
  priority: 0.9,
  changefreq: "weekly",
  group: "find",
  search: {
    u: NEAR_ME_URL,
    t: "E-bike rentals near me",
    s: "Find",
    d: "Sort every Florida e-bike rental shop by distance from wherever you are.",
    k: "ebike rentals near me electric bike rental near me closest nearby distance",
    w: 11,
  },
});

/* partners hub (paginated) + partner pages */
const partnerPageCount = Math.ceil(listings.length / PARTNERS_PER_PAGE);
for (let n = 1; n <= partnerPageCount; n++) {
  const url = n === 1 ? "/partners/" : `/partners/page/${n}/`;
  write(url, partnersHub(site, { ...ctx, pageNumber: n, totalPages: partnerPageCount }), {
    priority: n === 1 ? 0.9 : 0.5,
    changefreq: "weekly",
    group: "pages",
    search: n === 1 ? { u: url, t: "All Florida e-bike rental partners", s: "Partners", d: `The full directory of ${listings.length} rental partners.`, k: "partners directory all shops florida", w: 12 } : null,
  });
}

for (const listing of listings) {
  write(listing.url, partnerPage(site, listing, ctx), {
    priority: 0.7,
    changefreq: "monthly",
    group: "partners",
    search: {
      u: listing.url,
      t: listing.name,
      s: "Partner",
      d: `${listing.city}, FL${listing.rating ? ` · ${listing.rating.toFixed(1)} stars from ${listing.reviews} reviews` : ""}`,
      k: `${listing.name} ${listing.city} ${listing.region} ${(listing.tags || []).join(" ")} ${listing.type}`.toLowerCase(),
      w: Math.min(6, Math.round((listing.score || 0) / 6)),
    },
  });
}

/* /reviews/ pages were merged into /partners/ (star breakdown included); see src/redirects.mjs */

/* blog */
write("/blog/", blogHub(site, ctx), {
  priority: 0.8,
  changefreq: "weekly",
  group: "pages",
  search: { u: "/blog/", t: "Florida e-bike rental guides", s: "Blog", d: "Laws, prices, routes and checklists.", k: "blog guides articles florida ebike", w: 10 },
});
for (const post of blog) {
  write(post.url, blogPost(site, post, ctx), {
    priority: 0.7,
    changefreq: "monthly",
    lastmod: isoDate(post.updated || post.date),
    group: "blog",
    search: { u: post.url, t: post.title, s: "Guide", d: post.description, k: `${post.title} ${(post.tags || []).join(" ")} ${post.category}`.toLowerCase(), w: 7 },
  });
}

/* town riding guides under /trails/, from OpenStreetMap route data */
ctx.cityTrailSection = cityTrailHubSection(cityGuides);
for (const guide of cityGuides) {
  write(guide.url, cityTrailPage(site, guide, { ...ctx, trailData, guides: cityGuides }), {
    priority: 0.7,
    changefreq: "monthly",
    group: "trails",
    search: {
      u: guide.url,
      t: guide.title,
      s: "Trails",
      d: `${guide.data.routes.length} mapped bike routes around ${guide.city.name}.`,
      k: `${guide.city.name} bike routes trails rules ${guide.data.routes.map((r) => r.name).join(" ")}`.toLowerCase(),
      w: 6,
    },
  });
}

/* editorial hubs: trails, costs */
for (const hub of CONTENT_HUBS) {
  const entries = hubEntries[hub.slug];
  write(`/${hub.slug}/`, contentHub(site, hub, entries, ctx), {
    priority: 0.8,
    changefreq: "weekly",
    group: "pages",
    search: {
      u: `/${hub.slug}/`,
      t: hub.h1,
      s: hub.label,
      d: hub.description.slice(0, 130),
      k: `${hub.label} ${hub.h1} ${entries.map((e) => e.title).join(" ")}`.toLowerCase(),
      w: 10,
    },
  });
  for (const entry of entries) {
    write(entry.url, contentEntry(site, hub, entry, ctx), {
      priority: 0.7,
      changefreq: "monthly",
      lastmod: isoDate(entry.updated || entry.date),
      group: hub.slug,
      search: {
        u: entry.url,
        t: entry.title,
        s: hub.label,
        d: entry.description,
        k: `${entry.title} ${(entry.tags || []).join(" ")} ${entry.category || ""}`.toLowerCase(),
        w: 7,
      },
    });
  }
}

/* shop: hub plus a page per product */
write("/shop/", shopHub(site, shop, ctx), {
  priority: shop.products.length ? 0.8 : 0.3,
  changefreq: "weekly",
  group: "pages",
  skipSitemap: shop.products.length === 0,
  search: {
    u: "/shop/",
    t: "Shop e-bike gear",
    s: "Shop",
    d: "Bikes, helmets, locks, child seats and accessories for riding in Florida.",
    k: `shop gear buy products ${shop.categories.map((c) => c.name).join(" ")}`.toLowerCase(),
    w: 8,
  },
});
for (const product of shop.products) {
  write(product.url_internal, productPage(site, product, shop, ctx), {
    priority: 0.6,
    changefreq: "weekly",
    group: "shop",
    search: {
      u: product.url_internal,
      t: product.name,
      s: "Product",
      d: product.summary || `${product.name} in the Florida Ebike Rentals shop.`,
      k: `${product.name} ${product.brand || ""} ${product.category || ""}`.toLowerCase(),
      w: 4,
    },
  });
}

/* author profiles */
write("/authors/", authorsHub(site, authors, ctx), {
  priority: 0.5,
  changefreq: "monthly",
  group: "pages",
  search: { u: "/authors/", t: "Authors", s: "Authors", d: "The people who write this site.", k: "authors writers team about", w: 5 },
});
for (const author of authors) {
  write(author.url, authorPage(site, author, ctx), {
    priority: 0.4,
    changefreq: "monthly",
    group: "pages",
    search: {
      u: author.url,
      t: author.name,
      s: "Author",
      d: author.short,
      k: `${author.name} ${author.role} ${author.expertise.join(" ")}`.toLowerCase(),
      w: 3,
    },
  });
}

/* search hub + curated query pages */
write("/search/", searchHub(site, ctx), {
  priority: 0.7,
  changefreq: "weekly",
  group: "pages",
  search: { u: "/search/", t: "Search the directory", s: "Search", d: "Search every page on the site.", k: "search find query", w: 6 },
});
for (const entry of queries) {
  write(entry.url, searchQueryPage(site, entry.query, ctx), {
    priority: 0.5,
    changefreq: "weekly",
    group: "search",
    search: { u: entry.url, t: entry.query, s: "Search", d: `Directory results for ${entry.query}.`, k: entry.query, w: 4 },
  });
}

/* static pages */
const STATIC_META = {
  about: { priority: 0.6 },
  contact: { priority: 0.6 },
  disclaimer: { priority: 0.3 },
  privacy: { priority: 0.3 },
  terms: { priority: 0.3 },
};
for (const [key, meta] of Object.entries(STATIC_META)) {
  const content = pages[key];
  if (!content) throw new Error(`missing content/pages/${key}.md`);
  write(`/${key}/`, staticPage(site, key, content), {
    priority: meta.priority,
    changefreq: "yearly",
    lastmod: isoDate(content.updated || new Date()),
    group: "pages",
    search: { u: `/${key}/`, t: content.title, s: "Page", d: content.description, k: `${content.title} ${key}`.toLowerCase(), w: 5 },
  });
}

write("/sitemap/", sitemapPage(site, {
  index, blog, listings, queries, stats,
  partnerPages: partnerPageCount,
}), {
  priority: 0.4,
  changefreq: "weekly",
  group: "pages",
  search: { u: "/sitemap/", t: "Sitemap", s: "Page", d: "Every page on the site.", k: "sitemap index all pages", w: 3 },
});

write("/404.html", notFoundPage(site, ctx), { skipSitemap: true });

/* --------------------------------------------------------- data files */

writeRaw(
  "data/listings.json",
  JSON.stringify({
    count: listings.length,
    updated: isoDate(new Date()),
    listings: listings.map((l) => ({
      slug: l.slug, name: l.name, city: l.city, region: l.region,
      lat: l.lat, lng: l.lng, rating: l.rating, reviews: l.reviews,
      photo: l.photo, url: l.url, tags: l.tags,
    })),
  })
);

writeRaw("data/pages.json", JSON.stringify({ count: searchIndex.length, pages: searchIndex.filter(Boolean) }));

/* ----------------------------------------------------------- sitemaps */

// Every content hub gets its own sitemap, so a new hub can't drop its guides.
const GROUPS = [...new Set(["pages", "find", "partners", "blog", ...CONTENT_HUBS.map((h) => h.slug), "bike-type-towns", "shop", "search"])];
const sitemapFiles = [];
const sitemapLastmod = new Map(); // sitemap file -> newest lastmod among its URLs
for (const group of GROUPS) {
  const entries = [...written.entries()].filter(([, meta]) => meta.group === group);
  if (!entries.length) continue;
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map(
        ([url, meta]) =>
          `  <url>\n    <loc>${site.url}${url}</loc>\n    <lastmod>${meta.lastmod}</lastmod>\n` +
          `    <changefreq>${meta.changefreq}</changefreq>\n    <priority>${meta.priority.toFixed(1)}</priority>\n  </url>`
      )
      .join("\n") +
    "\n</urlset>\n";
  const name = `sitemap-${group}.xml`;
  sitemapLastmod.set(name, entries.map(([, meta]) => meta.lastmod).sort().pop());
  writeRaw(name, xml);
  sitemapFiles.push(name);
}

writeRaw(
  "sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapFiles
      .map((name) => `  <sitemap>\n    <loc>${site.url}/${name}</loc>\n    <lastmod>${sitemapLastmod.get(name) || DATA_LASTMOD}</lastmod>\n  </sitemap>`)
      .join("\n") +
    "\n</sitemapindex>\n"
);

/* ------------------------------------------------- robots, ads, misc */

writeRaw(
  "robots.txt",
  `# ${site.name}
User-agent: *
Allow: /

# Client-side search result URLs carry no unique content of their own.
Disallow: /*?q=
Disallow: /*?*

# Housekeeping
Disallow: /404.html
Disallow: /admin/

Sitemap: ${site.url}/sitemap.xml
`
);

writeRaw("ads.txt", `${site.adsense.adsTxt}\n`);

writeRaw(
  "site.webmanifest",
  JSON.stringify(
    {
      name: site.name,
      short_name: "FL Ebike Rentals",
      description: site.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#2050c8",
      icons: [
        { src: "/assets/img/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/assets/img/favicon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2
  )
);

/* Security + caching headers for Netlify / Cloudflare Pages style hosts. */
const SECURITY_HEADERS = `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-site
  X-Permitted-Cross-Domain-Policies: none

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/data/*
  Cache-Control: public, max-age=3600

/*.html
  Cache-Control: public, max-age=0, must-revalidate
`;
writeRaw("_headers", SECURITY_HEADERS);

/* redirects: thin towns and legacy listicle URLs (see src/redirects.mjs) */
writeRaw("_redirects", netlifyRedirects(redirects));

writeRaw(
  ".htaccess",
  `# Apache / LiteSpeed configuration for ${site.domain}
Options -Indexes
ServerSignature Off

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"
  Header always set Cross-Origin-Opener-Policy "same-origin"
  Header always set X-Permitted-Cross-Domain-Policies "none"
  Header unset X-Powered-By
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Force HTTPS
  RewriteCond %{HTTPS} !=on
  RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
  # Force the canonical host
  RewriteCond %{HTTP_HOST} !^${site.domain}$ [NC]
  RewriteRule ^(.*)$ https://${site.domain}/$1 [R=301,L]
</IfModule>

ErrorDocument 404 /404.html

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>
`
);

/* security.txt gives researchers a documented way to report a problem. */
const nextYear = new Date();
nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
writeRaw(
  ".well-known/security.txt",
  `Contact: mailto:${site.email}
Contact: ${site.url}/contact/
Expires: ${nextYear.toISOString().slice(0, 19)}Z
Preferred-Languages: en
Canonical: ${site.url}/.well-known/security.txt
Policy: ${site.url}/terms/
`
);

/* Root-level favicon for browsers that ignore the link tags. */
cpSync(join(ROOT, "assets/img/favicon.ico"), join(DIST, "favicon.ico"));
cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });

/* --------------------------------------------------------- reporting */

const pageCount = written.size + 1;
console.log(`pages written: ${pageCount}`);
for (const group of GROUPS) {
  const count = [...written.values()].filter((m) => m.group === group).length;
  if (count) console.log(`  ${group.padEnd(9)} ${count}`);
}
console.log(`search index entries: ${searchIndex.filter(Boolean).length}`);
console.timeEnd("build");

/* --------------------------------------------------------- verify pass */

if (process.argv.includes("--verify")) {
  const { verify } = await import("./scripts/verify.mjs");
  const vercelConfig = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
  const ok = verify(DIST, site, { redirects, vercelConfig });
  if (!ok) process.exitCode = 1;
}
