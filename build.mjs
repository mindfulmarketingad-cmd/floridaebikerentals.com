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

import { slugify, isoDate } from "./src/util.mjs";
import {
  ROOT, loadSite, loadListings, loadBlog, loadStaticPages, loadAuthors, loadHubEntries,
  buildIndex, statsFor, assignTitles, loadShop, SEARCH_QUERIES, CONTENT_HUBS,
} from "./src/data.mjs";
import { homePage } from "./src/pages/home.mjs";
import { findHub, findRegion, findCity, findTopic } from "./src/pages/find.mjs";
import { partnersHub, partnerPage, PER_PAGE as PARTNERS_PER_PAGE } from "./src/pages/partners.mjs";
import { reviewsHub, reviewPage, PER_PAGE as REVIEWS_PER_PAGE } from "./src/pages/reviews.mjs";
import { blogHub, blogPost } from "./src/pages/blog.mjs";
import { searchHub, searchQueryPage } from "./src/pages/search.mjs";
import { staticPage, sitemapPage, notFoundPage } from "./src/pages/static.mjs";
import { contentHub, contentEntry, authorsHub, authorPage } from "./src/pages/hub.mjs";
import { shopHub, productPage, shopCategoryPage } from "./src/pages/shop.mjs";
import { summaryFor } from "./src/components.mjs";

const DIST = join(ROOT, "dist");
const written = new Map(); // url path -> { lastmod, priority, changefreq, group }
const searchIndex = [];

function write(urlPath, html, meta = {}) {
  const file = urlPath.endsWith(".html")
    ? join(DIST, urlPath.replace(/^\//, ""))
    : join(DIST, urlPath.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html, "utf8");
  if (!meta.skipSitemap) {
    written.set(urlPath, {
      lastmod: meta.lastmod || isoDate(new Date()),
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
const shop = loadShop();
const ctx = { listings, index, blog, stats, queries, pages, authors, authorsBySlug, hubEntries, shop };

/* home */
write("/", homePage(site, ctx), {
  priority: 1.0,
  changefreq: "daily",
  group: "pages",
  search: { u: "/", t: "Florida Ebike Rentals", s: "Home", d: site.description, k: "florida ebike rentals home directory electric bike", w: 20 },
});

/* find hub + regions + cities + topics */
write("/find/", findHub(site, ctx), {
  priority: 0.9,
  changefreq: "weekly",
  group: "find",
  search: { u: "/find/", t: "Find E-Bike Rentals in Florida", s: "Find", d: "Browse every Florida region and town in the directory.", k: "find towns regions florida ebike rentals", w: 15 },
});

for (const region of index.regions) {
  write(region.url, findRegion(site, region, ctx), {
    priority: 0.8,
    changefreq: "weekly",
    group: "find",
    search: {
      u: region.url,
      t: `E-bike rentals in ${region.name}`,
      s: "Region",
      d: `${region.listings.length} rental partners across ${region.cities.length} towns.`,
      k: `${region.name} ${region.cities.slice(0, 12).map((c) => c.name).join(" ")}`.toLowerCase(),
      w: 10,
    },
  });
}

for (const city of index.cities) {
  write(city.url, findCity(site, city, ctx), {
    priority: 0.8,
    changefreq: "weekly",
    group: "find",
    search: {
      u: city.url,
      t: `E-bike rentals in ${city.name}, FL`,
      s: "Town",
      d: `${city.listings.length} rental partner${city.listings.length === 1 ? "" : "s"} in ${city.name}.`,
      k: `${city.name} ${city.region} ${city.listings.slice(0, 6).map((l) => l.name).join(" ")}`.toLowerCase(),
      w: 8,
    },
  });
}

for (const topic of index.topics) {
  write(topic.url, findTopic(site, topic, ctx), {
    priority: 0.7,
    changefreq: "weekly",
    group: "find",
    search: { u: topic.url, t: topic.title, s: "Find", d: topic.intro.slice(0, 120), k: topic.title.toLowerCase(), w: 8 },
  });
}

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

/* reviews hub (paginated) + review pages */
const ratedListings = listings.filter((l) => l.rating > 0 && l.reviews >= 5);
const reviewPageCount = Math.max(1, Math.ceil(ratedListings.length / REVIEWS_PER_PAGE));
for (let n = 1; n <= reviewPageCount; n++) {
  const url = n === 1 ? "/reviews/" : `/reviews/page/${n}/`;
  write(url, reviewsHub(site, { ...ctx, pageNumber: n, totalPages: reviewPageCount }), {
    priority: n === 1 ? 0.8 : 0.4,
    changefreq: "weekly",
    group: "pages",
    search: n === 1 ? { u: url, t: "Florida e-bike rental reviews", s: "Reviews", d: "Star breakdowns for every rated shop.", k: "reviews ratings stars florida ebike", w: 10 } : null,
  });
}

for (const listing of listings) {
  write(listing.reviewUrl, reviewPage(site, listing, ctx), {
    priority: 0.5,
    changefreq: "monthly",
    group: "reviews",
    search: {
      u: listing.reviewUrl,
      t: `${listing.name} reviews`,
      s: "Reviews",
      d: listing.rating ? `${listing.rating.toFixed(1)} stars from ${listing.reviews} Google reviews in ${listing.city}.` : `Review information for ${listing.name}.`,
      k: `${listing.name} reviews rating ${listing.city}`.toLowerCase(),
      w: 2,
    },
  });
}

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
  skipSitemap: shop.products.length === 0 && shop.categories.length === 0,
  search: {
    u: "/shop/",
    t: "Shop e-bike gear",
    s: "Shop",
    d: "Bikes, helmets, locks, child seats and accessories for riding in Florida.",
    k: `shop gear buy products ${shop.categories.map((c) => c.name).join(" ")}`.toLowerCase(),
    w: 8,
  },
});
for (const category of shop.categories) {
  write(category.url, shopCategoryPage(site, category, shop, ctx), {
    priority: 0.7,
    changefreq: "weekly",
    group: "shop",
    search: {
      u: category.url,
      t: category.name,
      s: "Shop",
      d: category.description,
      k: `${category.name} ${category.slug.replace(/-/g, " ")} shop buy florida`.toLowerCase(),
      w: 7,
    },
  });
}
for (const product of shop.products.filter((p) => p.url_internal)) {
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
  reviewPages: ratedListings.length,
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

const GROUPS = ["pages", "find", "partners", "reviews", "blog", "trails", "costs", "shop", "search"];
const sitemapFiles = [];
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
  writeRaw(name, xml);
  sitemapFiles.push(name);
}

writeRaw(
  "sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapFiles
      .map((name) => `  <sitemap>\n    <loc>${site.url}/${name}</loc>\n    <lastmod>${isoDate(new Date())}</lastmod>\n  </sitemap>`)
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
  const ok = verify(DIST, site);
  if (!ok) process.exitCode = 1;
}
