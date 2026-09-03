# FloridaEbikeRentals.com

A static directory of e-bike rental shops, bike rental services and guided tour operators
across Florida. Built from an Outscraper Google Maps export, rendered to plain HTML by a
zero-dependency Node build script.

**Primary keyword:** Florida Ebike Rentals
**Domain:** floridaebikerentals.com

## What gets built

| Section | URL pattern | Count |
| --- | --- | --- |
| Homepage | `/` | 1 |
| Find hub | `/find/` | 1 |
| Region pages | `/find/ebike-rentals-in-<region>/` | 11 |
| Town pages | `/find/ebike-rentals-in-<town>/` | 164 |
| Topic pages | `/find/<topic>/` | 8 |
| Partner hub (paginated) | `/partners/`, `/partners/page/N/` | 15 |
| Partner listings | `/partners/<business>/` | 561 |
| Reviews hub (paginated) | `/reviews/`, `/reviews/page/N/` | 9 |
| Review pages | `/reviews/<business>/` | 561 |
| Blog hub + guides | `/blog/`, `/blog/<slug>/` | 10 |
| Search hub + queries | `/search/`, `/search/<query>/` | 31 |
| Static pages | `/about/` `/contact/` `/disclaimer/` `/privacy/` `/terms/` `/sitemap/` | 6 |

Around 1,380 pages, built in roughly two seconds.

## Requirements

- Node 18 or newer (no npm dependencies — the build uses only the standard library)
- Python 3 with `openpyxl`, for re-importing an Outscraper export
- Playwright + Chromium, only if you regenerate the logo/favicon PNGs

## Commands

```bash
npm run import   # Outscraper .xlsx/.csv -> data/listings.json
npm run build    # data + content -> dist/
npm run verify   # build, then check links, titles, descriptions, canonicals
npm run serve    # preview dist/ at http://localhost:8080
npm run icons    # regenerate favicons and the Open Graph image from the SVGs
npm test         # verify + browser smoke tests of search, filters, map, geolocation
```

## Updating the listings

1. Run a fresh Outscraper Google Maps export (queries such as `bicycle rental service` and
   `electric bicycle store` by Florida ZIP code) and save the `.xlsx` to `data/source/`.
2. `python3 scripts/import_outscraper.py data/source/<file>.xlsx`

   The importer keeps only Florida businesses that are still operating and that genuinely
   rent, sell or service bikes; assigns each one to a region by nearest-anchor distance;
   parses hours and feature lists; scores relevance and quality; and writes
   `data/listings.json` with a stable, collision-free URL slug per business.
3. `npm run verify` and commit both `data/listings.json` and the source export.

Slugs are derived from the business name, so a renamed business gets a new URL. If that
matters for a listing that already ranks, add a redirect in your host config.

## Editing content

- **Blog posts** — Markdown files in `content/blog/`. Front matter sets `title`, `metaTitle`,
  `description`, `date`, `updated`, `category`, `tags` and `readingTime`. New files are picked
  up automatically and added to the hub, sitemap and search index.
- **Static pages** — Markdown in `content/pages/`. `{{CONTACT_FORM}}` in `contact.md` is
  replaced with the rendered form.
- **Site settings** — `data/site.json` holds the domain, contact email, AdSense publisher ID
  and the optional `contactFormEndpoint`. Set that endpoint to a form handler URL and the
  contact form posts to it; leave it empty and the form falls back to opening the visitor's
  email client.
- **Topic and search pages** — the `TOPICS` and `SEARCH_QUERIES` arrays in `src/data.mjs`.

## SEO structure

- One `<h1>` per page, a unique `<title>` under 62 characters and a unique meta description
  under 160 — all enforced by `npm run verify`, which also checks every internal link.
- Canonical URL, Open Graph and Twitter card metadata on every page.
- JSON-LD on every page: `Organization` and `WebSite` (with `SearchAction`) on the homepage,
  `BreadcrumbList` everywhere, `BicycleStore` with `AggregateRating` and `openingHours` on
  partner pages, `ItemList` on every listicle, `FAQPage` on hubs and listings, `BlogPosting`
  on guides.
- Internal linking runs Home → hub → detail and back: every partner page links up to its town,
  region and reviews page and across to its six nearest neighbours; every town page links to
  its region, its nearest towns and relevant guides.
- `sitemap.xml` is a sitemap index over six section sitemaps; `/sitemap/` is the human version.
- `robots.txt` allows everything except query-string URLs, which carry no unique content.

## Deployment

The output in `dist/` is plain static files — any static host works.

- **Netlify / Cloudflare Pages** — `netlify.toml` sets the build command and publish
  directory. Security and cache headers come from the generated `dist/_headers`.
- **Vercel** — `vercel.json` at the repo root sets the build, output directory and headers.
- **Apache / LiteSpeed / cPanel** — upload `dist/` and the generated `dist/.htaccess`, which
  forces HTTPS and the canonical host, sets the security headers and wires up `404.html`.

Point the domain at the host, make sure HTTPS is on, and submit
`https://floridaebikerentals.com/sitemap.xml` in Google Search Console.

## Security

See [SECURITY.md](SECURITY.md). Short version: no server-side code, no database, no user
accounts, every scraped string HTML-escaped at render time, and a per-page Content-Security-
Policy that hashes each inline script.

## Google AdSense

`data/site.json` carries the publisher ID. The build writes `dist/ads.txt` and adds the
AdSense loader plus responsive ad slots to every page. Ad slots are labelled and sit between
content sections, never inside the listing data. Set `adsense.enabled` to `false` to strip
ads and the associated CSP entries from the whole site.
