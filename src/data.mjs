import { readFileSync, readdirSync } from "node:fs";
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

export function loadBlog() {
  const dir = join(ROOT, "content", "blog");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = readFileSync(join(dir, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const { html, headings } = render(body);
      return {
        slug: basename(file, ".md"),
        url: `/blog/${basename(file, ".md")}/`,
        ...meta,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        html,
        headings,
        words: wordCount(body),
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

export function loadListings() {
  const payload = JSON.parse(readFileSync(join(ROOT, "data", "listings.json"), "utf8"));
  return payload.listings.map((l) => ({
    ...l,
    url: `/partners/${l.slug}/`,
    reviewUrl: `/reviews/${l.slug}/`,
    citySlug: citySlug(l.city),
    regionSlug: regionSlug(l.region),
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

      let title = "";
      for (const extra of extras) {
        title = build(listing, kind, extra);
        if (!taken.has(title)) break;
      }
      // The name is truncated to fit the title budget, so only a suffix applied
      // after fitting is guaranteed to change the string and end this loop.
      let counter = 2;
      const base = title;
      while (taken.has(title)) {
        title = `${base} (${counter})`;
        counter++;
      }
      taken.set(title, listing.slug);
      listing[field] = title;
    }
  }
  return listings;
}
