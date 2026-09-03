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
| Blog hub + guides | `/blog/`, `/blog/<slug>/` | 14 |
| Trails hub + guides | `/trails/`, `/trails/<slug>/` | 5 |
| Costs hub + guides | `/costs/`, `/costs/<slug>/` | 5 |
| Shop hub + products | `/shop/`, `/shop/<slug>/` | 1 + products |
| Author profiles | `/authors/`, `/authors/<slug>/` | 4 |
| Search hub + queries | `/search/`, `/search/<query>/` | 31 |
| Static pages | `/about/` `/contact/` `/disclaimer/` `/privacy/` `/terms/` `/sitemap/` | 6 |

Around 1,400 pages, built in roughly two seconds.

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
  `description`, `date`, `updated`, `author`, `category`, `tags` and `readingTime`. New files are
  picked up automatically and added to the hub, sitemap and search index.
- **Trail and cost guides** — Markdown in `content/trails/` and `content/costs/`. Same front
  matter, plus optional `towns` (an array of town slugs, which generates a "rent nearby" listicle
  and map at the foot of the guide) and display facts such as `distance`, `elevation`, `surface`,
  `difficulty`, `typical` and `range`. Add `rwgps: <route id>` to embed that Ride with GPS route's
  map and elevation profile — the embed is lazy-loaded and the host is added to that page's CSP
  `frame-src` only, so pages without a route stay locked down. Add a hub by adding an entry to
  `CONTENT_HUBS` in `src/data.mjs` and a matching content directory.
- **Authors** — Markdown in `content/authors/`, with `name`, `role`, `expertise`, `short` and a
  bio in the body. Reference one from a post with `author: <filename-slug>` and the byline, author
  card, profile page and `Person` schema are generated automatically.
- **FAQs** — add an `## FAQs` (or `## Frequently asked questions`) section to any guide with `###`
  question headings. The build lifts it out of the prose, renders it as an accordion and emits
  `FAQPage` schema.
- **Shortcodes** — drop these on a line of their own in any guide:
  `{{LISTICLE|city:Destin|count:12|radius:20}}` renders a live, ranked listicle of directory
  listings near a town with a toggleable map; `{{MAP|city:Destin|radius:20}}` renders just the map;
  `{{PHOTO|id:beach|alt:...}}` inserts a library photo; `{{CTA|title:...|label:Rent Now|href:/partners/}}`
  inserts an inline call to action. Because they resolve at build time, a listicle in a post is
  never out of date with the directory.
- **Static pages** — Markdown in `content/pages/`. `{{CONTACT_FORM}}` in `contact.md` is
  replaced with the rendered form.
- **Photos** — `src/images.mjs` is the photo library. Add a file to `assets/img/`, add an entry
  with its real dimensions, alt text and caption, and it enters the rotation. Every page gets a
  deterministic featured image plus at least one more, seeded from its slug so a rebuild never
  reshuffles the site. Photos shown beside a specific business are captioned as stock so a reader
  never mistakes one for that shop's own premises.
- **Shop products** — `data/products.json`. Add objects to the `products` array and each one gets
  a card on `/shop/` and a page at `/shop/<slug>/` with `Product` and `Offer` schema. Fields:

  | Field | Notes |
  | --- | --- |
  | `name` | Required. Everything else is optional. |
  | `slug` | Defaults to a slug of the name; collisions are numbered. |
  | `brand`, `sku` | Shown on the page and in schema. |
  | `category` | Matched against a `categories` slug to group it on the hub. |
  | `price` | A number. Rendered with the file's `currency` and emitted as an `Offer`. |
  | `availability` | `InStock`, `OutOfStock`, `PreOrder`. Defaults to `InStock`. |
  | `url` | The buy link. Rendered `rel="nofollow sponsored"` and must be http(s) or it is dropped. |
  | `image` | Product image URL, plus optional `imageWidth` / `imageHeight`. |
  | `summary`, `description` | Card text and the body paragraph. |
  | `specs` | An object of label/value pairs rendered as a spec table. |
  | `cta` | Button label. Defaults to "View product". |

  While `products` is empty the hub explains what is coming, stays out of the sitemap and sets
  `noindex` so an empty page is never submitted to Google. It becomes indexable automatically as
  soon as the first product is added. `affiliateDisclosure` in the same file is printed on every
  shop page.
- **Site settings** — `data/site.json` holds the domain, contact email, AdSense publisher ID
  and the optional `contactFormEndpoint`. Set that endpoint to a form handler URL and the
  contact form posts to it; leave it empty and the form falls back to opening the visitor's
  email client.
- **Topic and search pages** — the `TOPICS` and `SEARCH_QUERIES` arrays in `src/data.mjs`.

## SEO structure

- One `<h1>` per page, a unique `<title>` under 62 characters and a unique meta description
  under 160 — all enforced by `npm run verify`, which also checks every internal link and that
  every page carries a featured image plus at least one more.
- Canonical URL, Open Graph and Twitter card metadata on every page.
- JSON-LD on every page: `Organization` and `WebSite` (with `SearchAction`) on the homepage,
  `BreadcrumbList` everywhere, `BicycleStore` with `AggregateRating` and `openingHours` on
  partner pages, `ItemList` on every listicle, `FAQPage` on hubs and listings, `BlogPosting`
  on guides.
- Internal linking runs Home → hub → detail and back: every partner page links up to its town,
  region and reviews page and across to its six nearest neighbours; every town page links to
  its region, its nearest towns and relevant guides.
- `sitemap.xml` is a sitemap index over eight section sitemaps; `/sitemap/` is the human version.
- Author profiles carry `ProfilePage` and `Person` schema, and every guide names a real author.
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

## Location awareness

Two places use the browser geolocation API, which always asks permission first:

- the homepage carousel, which opens on the rentals nearest the visitor;
- `/partners/`, which re-sorts the whole listicle by distance and adds a "x mi away" badge to each
  shop.

Both consult the Permissions API first, so an already-granted permission resolves with no prompt
and a denied one skips straight to the statewide ranking. Coordinates are used inside the visitor's
browser only and are never transmitted or stored. A visitor who declines is not asked again for the
rest of the session, and every page works normally without location.

## Security

See [SECURITY.md](SECURITY.md). Short version: no server-side code, no database, no user
accounts, every scraped string HTML-escaped at render time, and a per-page Content-Security-
Policy that hashes each inline script.

## Google AdSense

`data/site.json` carries the publisher ID. The build writes `dist/ads.txt` and adds the
AdSense loader plus responsive ad slots to every page. Ad slots are labelled and sit between
content sections, never inside the listing data. Set `adsense.enabled` to `false` to strip
ads and the associated CSP entries from the whole site.
