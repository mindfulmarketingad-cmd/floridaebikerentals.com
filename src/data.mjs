import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { slugify, miles, unique, fitTitle } from "./util.mjs";
import { parseFrontMatter, render, wordCount } from "./markdown.mjs";

export const ROOT = resolve(new URL("..", import.meta.url).pathname);

export function regionSlug(region) {
  return slugify(String(region).replace(/&/g, "and"));
}

export function citySlug(city) {
  return slugify(city);
}

/** Topic hubs: curated cross-cuts of the directory that people actually search for. */
export const TOPICS = [
  {
    slug: "guided-ebike-tours-in-florida",
    title: "Guided E-Bike Tours in Florida",
    h1: "Guided E-Bike Tours in Florida",
    intro:
      "Operators across Florida that run guided electric bike tours as well as renting bikes. A guided ride is the fastest way to learn a town, and the only way to find the routes locals actually use.",
    match: (l) => (l.tags || []).includes("Guided tours"),
  },
  {
    slug: "beach-ebike-rentals-in-florida",
    title: "Beach E-Bike Rentals in Florida",
    h1: "Beach E-Bike Rentals in Florida",
    intro:
      "Rental shops in Florida's beach towns, from the Panhandle to the Keys. These are the shops within riding distance of the sand, where a bike is usually faster than finding a parking space.",
    match: (l) => (l.tags || []).includes("Beach town"),
  },
  {
    slug: "electric-bike-shops-in-florida",
    title: "Electric Bike Shops in Florida",
    h1: "Electric Bike Shops in Florida",
    intro:
      "Shops that specialise in electric bikes — sales, service and rentals. If you are staying in Florida for a season and weighing renting against buying, start here.",
    match: (l) => l.is_ebike,
  },
  {
    slug: "ebike-rentals-with-delivery-in-florida",
    title: "E-Bike Rentals With Delivery in Florida",
    h1: "Florida E-Bike Rentals That Deliver",
    intro:
      "Shops whose public profile lists delivery. Having bikes dropped at your rental house or hotel removes the single most annoying part of a family rental: moving four bikes in a hire car.",
    match: (l) => (l.tags || []).includes("Delivery available"),
  },
  {
    slug: "top-rated-ebike-rentals-in-florida",
    title: "Top Rated E-Bike Rentals in Florida",
    h1: "Florida's Top Rated E-Bike Rentals",
    intro:
      "The highest-rated rental shops in the directory, filtered so that a 5.0 star average from three reviews does not outrank a 4.9 from eight hundred. Rating plus review volume, statewide.",
    match: (l) => l.rating >= 4.7 && l.reviews >= 60,
  },
  {
    slug: "ebike-and-scooter-rentals-in-florida",
    title: "E-Bike and Scooter Rentals in Florida",
    h1: "E-Bike and Scooter Rentals in Florida",
    intro:
      "Shops that rent both electric bikes and scooters or mopeds. Useful when a group cannot agree, or when you want two wheels with a bit more range than a bike gives you.",
    match: (l) => (l.tags || []).includes("Scooters"),
  },
  {
    slug: "ebike-rentals-open-seven-days-in-florida",
    title: "Florida E-Bike Rentals Open Seven Days a Week",
    h1: "Florida E-Bike Rentals Open Seven Days",
    intro:
      "Shops whose posted Google hours cover all seven days. Handy when your only free morning is a Sunday, which is exactly when half of Florida's bike shops are shut.",
    match: (l) => (l.hours || []).filter((h) => !h.closed).length === 7,
  },
  {
    slug: "ebike-repair-and-service-in-florida",
    title: "E-Bike Repair and Service in Florida",
    h1: "E-Bike Repair and Service in Florida",
    intro:
      "Shops whose public profile lists repairs and servicing as well as rentals. Worth knowing before you need them: a flat on a fat-tyre e-bike is not a roadside fix, and not every rental counter has a mechanic behind it.",
    match: (l) => (l.tags || []).includes("Repairs & service"),
  },
  {
    slug: "golf-cart-and-ebike-rentals-in-florida",
    title: "Golf Cart and E-Bike Rentals in Florida",
    h1: "Golf Cart and E-Bike Rentals in Florida",
    intro:
      "Shops that rent golf carts alongside electric bikes. In the island and beach towns where carts are street legal, a cart for the luggage and bikes for everyone else is how most families actually get around.",
    match: (l) => (l.tags || []).includes("Golf carts"),
  },
  {
    slug: "bike-and-watersports-rentals-in-florida",
    title: "Bike and Watersports Rentals in Florida",
    h1: "Bike and Watersports Rentals in Florida",
    intro:
      "Rental shops that also hire out kayaks, paddleboards and beach gear. One counter, one deposit, and a day that does not depend on the weather holding.",
    match: (l) => (l.tags || []).includes("Watersports"),
  },
  {
    slug: "family-ebike-rentals-in-florida",
    title: "Family E-Bike Rentals in Florida",
    h1: "Family Friendly E-Bike Rentals in Florida",
    intro:
      "Well-reviewed rental shops in beach towns with paths that suit riding with children. Every shop here rents bikes rather than only selling them, and holds a strong public rating.",
    match: (l) => (l.tags || []).includes("Rentals") && (l.tags || []).includes("Beach town") && l.rating >= 4.5,
  },
];

/** Curated search landing pages: real queries with their own indexable page. */
export const SEARCH_QUERIES = [
  "ebike rentals near me", "florida ebike rentals", "30a ebike rentals", "key west ebike rental",
  "electric bike rental miami", "destin ebike rentals", "beach cruiser rental florida",
  "santa rosa beach bike rentals", "naples fl bike rentals", "sarasota ebike rental",
  "clearwater beach bike rental", "st augustine bike rentals", "fort myers beach bike rental",
  "panama city beach ebike rental", "orlando electric bike rental", "tampa ebike rental",
  "guided ebike tours florida", "family bike rentals florida", "ebike delivery florida",
  "fat tire ebike rental florida", "electric bike shop near me florida", "sanibel island bike rental",
  "anna maria island bike rental", "marco island bike rental", "jacksonville beach bike rental",
  "daytona beach bike rentals", "fort lauderdale ebike rental", "miami beach bike rental",
  "boca raton electric bike rental", "winter garden bike rental",
];

export function loadSite() {
  return JSON.parse(readFileSync(join(ROOT, "data", "site.json"), "utf8"));
}

/**
 * Pulls a trailing FAQ section out of a post so it can be rendered as an
 * accordion and emitted as FAQPage schema instead of plain prose.
 * Looks for "## FAQs" (or "Frequently asked questions") followed by "### question"
 * blocks, and removes that section from the body.
 */
export function extractFaqs(markdown) {
  const match = /\n##\s+(?:FAQs?|Frequently asked questions)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i.exec(markdown);
  if (!match) return { body: markdown, faqs: [] };

  const faqs = [];
  const blocks = match[1].split(/\n(?=###\s)/);
  for (const block of blocks) {
    const heading = /^###\s+(.+)$/m.exec(block);
    if (!heading) continue;
    const answer = block.slice(block.indexOf(heading[0]) + heading[0].length).trim();
    if (!answer) continue;
    faqs.push({ q: heading[1].trim(), a: render(answer).html });
  }
  const body = markdown.slice(0, match.index) + markdown.slice(match.index + match[0].length);
  return { body, faqs };
}

/**
 * The /shop catalogue. Hand-edited JSON, so every entry is normalised and every
 * URL validated here rather than trusted at render time.
 */
export function loadShop() {
  const file = join(ROOT, "data", "products.json");
  if (!existsSync(file)) return { currency: "USD", affiliateDisclosure: "", categories: [], products: [] };
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const categories = (Array.isArray(raw.categories) ? raw.categories : []).map((c) => ({
    ...c,
    slug: slugify(c.slug || c.name, "category"),
    url: `/shop/${slugify(c.slug || c.name, "category")}/`,
  }));
  const categorySlugs = new Set(categories.map((c) => c.slug));
  // Products live under their category: /shop/<category>/<product>/. A product
  // with no recognised category sits at /shop/<product>/, where it may never
  // claim a slug a category page already owns.
  const used = new Set(categories.map((c) => c.slug));
  const products = (Array.isArray(raw.products) ? raw.products : [])
    .filter((p) => p && p.name)
    .map((p) => {
      const category = slugify(p.category || "");
      const nested = categorySlugs.has(category);
      const base = slugify(p.slug || p.name, "product");
      let slug = base;
      let n = 2;
      while (used.has(nested ? `${category}/${slug}` : slug)) slug = `${base}-${n++}`;
      used.add(nested ? `${category}/${slug}` : slug);
      return {
        ...p,
        slug,
        categorySlug: nested ? category : "",
        // A product photo is only referenced once the file is actually on disk,
        // so a placeholder path in products.json never becomes a broken image.
        image:
          typeof p.image === "string" && p.image.startsWith("/") && !existsSync(join(ROOT, p.image.replace(/^\//, "")))
            ? ""
            : p.image,
        // An affiliate item is a link out to the retailer, not a page of ours:
        // it gets no detail page, so nothing thin is published for it.
        affiliate: Boolean(p.affiliate),
        url_internal: p.affiliate ? "" : nested ? `/shop/${category}/${slug}/` : `/shop/${slug}/`,
      };
    });
  return {
    currency: raw.currency || "USD",
    affiliateDisclosure: raw.affiliateDisclosure || "",
    delivery: raw.delivery || "",
    dealer: raw.dealer || "",
    categories,
    products,
  };
}

export function loadAuthors() {
  const dir = join(ROOT, "content", "authors");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = readFileSync(join(dir, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const slug = meta.slug || basename(file, ".md");
      return {
        ...meta,
        slug,
        url: `/authors/${slug}/`,
        expertise: Array.isArray(meta.expertise) ? meta.expertise : [],
        html: render(body).html,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Editorial hubs. Each one is a directory of Markdown guides under content/,
 * rendered as a hub page plus one page per guide. Adding a hub here (and a
 * matching content directory) is all it takes to add a new section.
 */
export const CONTENT_HUBS = [
  {
    slug: "trails",
    dir: "trails",
    label: "Trails",
    noun: "trail guide",
    h1: "Florida E-Bike Trail Guides",
    title: "Florida E-Bike Trail Guides - Routes, Surfaces and Where to Rent",
    description:
      "Guides to Florida's best paved trails and coastal routes for electric bikes, with distances, surfaces, parking and the rental shops closest to each trailhead.",
    intro:
      "Where to actually ride once you have the bike. Each guide covers the route end to end - distance, surface, shade, parking and the trailheads worth starting from - and links to the rental shops closest to it.",
  },
  {
    slug: "costs",
    dir: "costs",
    label: "Costs",
    noun: "cost guide",
    h1: "Florida E-Bike Rental Costs",
    title: "Florida E-Bike Rental Costs - Prices, Deposits and Hidden Fees",
    description:
      "What renting an electric bike in Florida really costs: hourly and weekly rates, card holds and deposits, delivery fees, damage waivers, tour pricing and how to pay less.",
    intro:
      "Every cost question in one place. Rental rates by duration and season, the card hold you should expect, what delivery and damage waivers add, and where the money actually goes on a family booking.",
  },
];

/** The leading mileage in a distance string, or 0 if it does not state one. */
function milesFrom(distance) {
  const text = String(distance || "");
  if (!/mile/i.test(text)) return 0;
  const match = /(\d+(?:\.\d+)?)/.exec(text);
  return match ? Number(match[1]) : 0;
}

export function loadHubEntries(hub) {
  const dir = join(ROOT, "content", hub.dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = readFileSync(join(dir, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const { body: prose, faqs } = extractFaqs(body);
      const { html, headings } = render(prose);
      const slug = basename(file, ".md");
      return {
        slug,
        hub: hub.slug,
        url: `/${hub.slug}/${slug}/`,
        ...meta,
        // Mileage for hub listings. Taken from an explicit `miles:` field when
        // one is set, otherwise the leading number of `distance:` — which reads
        // correctly through the hedges the trail guides need ("About 52 miles
        // when complete", "47-mile corridor, part paved").
        miles: meta.miles !== undefined ? Number(meta.miles) : milesFrom(meta.distance),
        towns: Array.isArray(meta.towns) ? meta.towns : meta.towns ? [meta.towns] : [],
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        faqs,
        html,
        headings,
        words: wordCount(prose),
      };
    })
    .sort((a, b) => Number(a.order || 99) - Number(b.order || 99) || String(a.title).localeCompare(String(b.title)));
}

export function loadBlog() {
  const dir = join(ROOT, "content", "blog");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = readFileSync(join(dir, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const { body: prose, faqs } = extractFaqs(body);
      const { html, headings } = render(prose);
      return {
        slug: basename(file, ".md"),
        url: `/blog/${basename(file, ".md")}/`,
        ...meta,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        faqs,
        html,
        headings,
        words: wordCount(prose),
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function loadStaticPages() {
  const dir = join(ROOT, "content", "pages");
  const out = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const raw = readFileSync(join(dir, file), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const { html, headings } = render(body);
    out[basename(file, ".md")] = { ...meta, html, headings };
  }
  return out;
}

/**
 * Google review text, keyed by place_id, written by
 * scripts/import_outscraper_reviews.py. Optional: the file is absent until a
 * reviews export has been imported, and the review pages simply show the star
 * breakdown alone until then.
 */
export function loadReviewText() {
  const file = join(ROOT, "data", "reviews.json");
  if (!existsSync(file)) return { byPlace: new Map(), count: 0, generated: "" };
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const byPlace = new Map(Object.entries(payload.reviews || {}));
  return { byPlace, count: payload.count || 0, generated: payload.generated || "" };
}

export function loadListings() {
  const payload = JSON.parse(readFileSync(join(ROOT, "data", "listings.json"), "utf8"));
  const { byPlace } = loadReviewText();
  return payload.listings.map((l) => ({
    ...l,
    url: `/partners/${l.slug}/`,
    reviewUrl: `/reviews/${l.slug}/`,
    citySlug: citySlug(l.city),
    regionSlug: regionSlug(l.region),
    reviewText: byPlace.get(l.place_id) || [],
  }));
}

/** Groups listings into the collections every page type needs. */
export function buildIndex(listings) {
  const cities = new Map();
  const regions = new Map();

  for (const listing of listings) {
    if (listing.city) {
      if (!cities.has(listing.citySlug)) {
        cities.set(listing.citySlug, {
          name: listing.city,
          slug: listing.citySlug,
          region: listing.region,
          regionSlug: listing.regionSlug,
          url: `/find/ebike-rentals-in-${listing.citySlug}/`,
          listings: [],
        });
      }
      cities.get(listing.citySlug).listings.push(listing);
    }
    if (!regions.has(listing.regionSlug)) {
      regions.set(listing.regionSlug, {
        name: listing.region,
        slug: listing.regionSlug,
        url: `/find/ebike-rentals-in-${listing.regionSlug}/`,
        listings: [],
        cities: [],
      });
    }
    regions.get(listing.regionSlug).listings.push(listing);
  }

  for (const city of cities.values()) {
    city.listings.sort((a, b) => b.score - a.score);
    const region = regions.get(city.regionSlug);
    if (region) region.cities.push(city);
    const centre = city.listings.find((l) => typeof l.lat === "number");
    city.lat = centre ? centre.lat : null;
    city.lng = centre ? centre.lng : null;
  }

  for (const region of regions.values()) {
    region.listings.sort((a, b) => b.score - a.score);
    region.cities.sort((a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name));
  }

  const topics = TOPICS.map((topic) => {
    const matched = listings.filter(topic.match).sort((a, b) => b.score - a.score);
    return { ...topic, url: `/find/${topic.slug}/`, listings: matched };
  }).filter((t) => t.listings.length >= 5);

  return {
    cities: Array.from(cities.values()).sort((a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name)),
    citiesBySlug: cities,
    regions: Array.from(regions.values()).sort((a, b) => b.listings.length - a.listings.length),
    regionsBySlug: regions,
    topics,
  };
}

/** Closest other listings, used for internal linking on every partner page. */
export function nearbyListings(listing, all, count = 6) {
  if (typeof listing.lat !== "number") {
    return all.filter((l) => l.slug !== listing.slug && l.region === listing.region).slice(0, count);
  }
  return all
    .filter((l) => l.slug !== listing.slug && typeof l.lat === "number")
    .map((l) => ({ ...l, distance: miles(listing.lat, listing.lng, l.lat, l.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

export function nearbyCities(city, cities, count = 8) {
  if (typeof city.lat !== "number") {
    return cities.filter((c) => c.slug !== city.slug && c.regionSlug === city.regionSlug).slice(0, count);
  }
  return cities
    .filter((c) => c.slug !== city.slug && typeof c.lat === "number")
    .map((c) => ({ ...c, distance: miles(city.lat, city.lng, c.lat, c.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

export function statsFor(listings) {
  const rated = listings.filter((l) => l.rating > 0);
  const reviews = listings.reduce((sum, l) => sum + (l.reviews || 0), 0);
  const avg = rated.length ? rated.reduce((sum, l) => sum + l.rating, 0) / rated.length : 0;
  return {
    total: listings.length,
    cities: unique(listings.map((l) => l.city).filter(Boolean)).length,
    reviews,
    avgRating: avg ? avg.toFixed(1) : "0.0",
    ebikeShops: listings.filter((l) => l.is_ebike).length,
    tourOperators: listings.filter((l) => (l.tags || []).includes("Guided tours")).length,
  };
}

/**
 * Assigns unique, length-safe <title> values to every listing. Scraped names
 * collide (two "Eaton Bikes" in Key West) and run long, so collisions are
 * broken with the neighbourhood, then the street, then a numeral — and the
 * whole string is refitted afterwards so it still fits a search result.
 */
export function assignTitles(listings) {
  const build = (listing, kind, extra) => {
    const suffix =
      kind === "partner" ? ` - E-Bike Rentals in ${listing.city}, FL` : ` Reviews - ${listing.city}, FL`;
    const name = extra ? `${listing.name} ${extra}` : listing.name;
    return fitTitle(name, suffix);
  };

  for (const kind of ["partner", "review"]) {
    const field = kind === "partner" ? "pageTitle" : "reviewTitle";
    const taken = new Map();
    for (const listing of listings) {
      const extras = [
        "",
        listing.neighborhood && listing.neighborhood !== listing.city ? listing.neighborhood : "",
        listing.street || "",
        listing.postal_code || "",
      ].filter((v, i) => i === 0 || v);

      // Uniqueness is judged case-insensitively: titles are rendered in Title
      // Case, so two names differing only in capitalisation ("Saint George
      // Island" and "Saint George island") would otherwise collide on the page.
      const key = (value) => value.toLowerCase();
      let title = "";
      for (const extra of extras) {
        title = build(listing, kind, extra);
        if (!taken.has(key(title))) break;
      }
      // The name is truncated to fit the title budget, so only a suffix applied
      // after fitting is guaranteed to change the string and end this loop.
      let counter = 2;
      const base = title;
      while (taken.has(key(title))) {
        title = `${base} (${counter})`;
        counter++;
      }
      taken.set(key(title), listing.slug);
      listing[field] = title;
    }
  }
  return listings;
}
