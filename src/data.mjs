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

const tagged = (tag) => (l) => (l.tags || []).includes(tag);
const sevenDays = (l) => (l.hours || []).filter((h) => !h.closed).length === 7;
/** Google's "Children" attributes: good for kids, kids' discounts, family discount. */
const familyFriendly = (l) => (l.about || []).some((g) => g.group === "Children" && g.items.length);

/**
 * The categories /find/ is organised by. Each is a cross-cut of the directory
 * backed by a field in the listing data, never by a guess: a shop is only in
 * "E-bike tours" if its public profile says it runs tours. Categories the data
 * cannot support (child seats, for example, which no profile records) are left
 * out rather than approximated.
 *
 * `legacy` is the URL the same list used to live at, redirected here.
 */
export const CATEGORIES = [
  {
    slug: "ebike-rentals",
    name: "E-bike rentals",
    title: "E-Bike Rentals in Florida",
    h1: "E-Bike Rentals in Florida",
    blurb: "Shops that rent electric bikes, not just sell them.",
    intro:
      "We list every shop whose public profile says it both rents bikes and carries electric bikes, ranked by Google rating weighted against review volume.",
    match: (l) => l.is_ebike && tagged("Rentals")(l),
  },
  {
    slug: "ebike-tours",
    name: "E-bike tours",
    title: "Guided E-Bike Tours in Florida",
    h1: "Guided E-Bike Tours in Florida",
    blurb: "Operators that run guided rides as well as rentals.",
    intro:
      "These operators list guided tours on their public profile. We include them because a guided ride is the quickest way to learn a town's routes, and the guide handles the bike fitting and the safety talk.",
    match: tagged("Guided tours"),
    legacy: "/find/guided-ebike-tours-in-florida/",
  },
  {
    slug: "beach-rentals",
    name: "Beach rentals",
    title: "Beach E-Bike Rentals in Florida",
    h1: "Beach Bike & E-Bike Rentals in Florida",
    blurb: "Rental shops in Florida's beach towns.",
    intro:
      "We group rental shops in Florida's beach towns here, from the Panhandle to the Keys. In these towns a bike is often quicker than finding a parking space near the sand.",
    match: (l) => tagged("Beach town")(l) && tagged("Rentals")(l),
    legacy: "/find/beach-ebike-rentals-in-florida/",
  },
  {
    slug: "delivery",
    name: "Delivery",
    title: "E-Bike Rentals With Delivery in Florida",
    h1: "Florida E-Bike Rentals That Deliver",
    blurb: "Bikes dropped at your hotel, condo or rental house.",
    intro:
      "Every shop here lists delivery on its public profile. We pulled them out because getting bikes to a rental house without a rack is the hardest part of a family rental. Ask each shop about its delivery radius and fee.",
    match: tagged("Delivery available"),
    legacy: "/find/ebike-rentals-with-delivery-in-florida/",
  },
  {
    slug: "family-friendly",
    name: "Family-friendly",
    title: "Family-Friendly Bike Rentals in Florida",
    h1: "Family-Friendly Bike & E-Bike Rentals in Florida",
    blurb: "Shops Google lists as good for kids or offering family discounts.",
    intro:
      "We only include a shop here when its Google profile says it is good for kids or offers kids' or family discounts. Equipment such as child seats, trailers and tag-alongs is not recorded in public profiles, so ask the shop directly before you book.",
    match: familyFriendly,
    legacy: "/find/family-ebike-rentals-in-florida/",
  },
  {
    slug: "ebike-shops",
    name: "E-bike shops & repairs",
    title: "Electric Bike Shops in Florida",
    h1: "Electric Bike Shops in Florida",
    blurb: "Specialists for sales, service and repairs.",
    intro:
      "These shops specialise in electric bikes, covering sales, service and often rentals. If you are in Florida for a season and deciding whether to rent or buy, we suggest starting here.",
    match: (l) => l.is_ebike,
    legacy: "/find/electric-bike-shops-in-florida/",
  },
  {
    slug: "scooter-rentals",
    name: "Scooters & mopeds",
    title: "E-Bike and Scooter Rentals in Florida",
    h1: "E-Bike and Scooter Rentals in Florida",
    blurb: "Shops that rent scooters or mopeds alongside bikes.",
    intro:
      "These shops rent scooters or mopeds as well as bikes. That helps when a group can't agree, or when someone wants more range than a bike gives.",
    match: tagged("Scooters"),
    legacy: "/find/ebike-and-scooter-rentals-in-florida/",
  },
  {
    slug: "open-7-days",
    name: "Open 7 days",
    title: "Florida E-Bike Rentals Open Seven Days a Week",
    h1: "Florida E-Bike Rentals Open Seven Days",
    blurb: "Posted Google hours cover every day of the week.",
    intro:
      "Every shop here posts Google hours for all seven days. That matters when Sunday morning is your only free time. Seasonal hours change, so we always suggest calling first.",
    match: sevenDays,
    legacy: "/find/ebike-rentals-open-seven-days-in-florida/",
  },
  {
    slug: "top-rated",
    name: "Top rated",
    title: "Top Rated E-Bike Rentals in Florida",
    h1: "Florida's Top Rated E-Bike Rentals",
    blurb: "4.7 stars or better, from at least 60 Google reviews.",
    intro:
      "We set two bars for this list: at least 4.7 stars and at least 60 Google reviews. That way a perfect score from three reviews doesn't outrank a 4.9 from eight hundred.",
    match: (l) => l.rating >= 4.7 && l.reviews >= 60,
    legacy: "/find/top-rated-ebike-rentals-in-florida/",
  },
];

/** A category needs this many shops statewide to get a page, and this many in a town for a town page. */
export const MIN_CATEGORY_LISTINGS = 5;
export const MIN_CATEGORY_TOWN_LISTINGS = 2;

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
  const used = new Set();
  const products = (Array.isArray(raw.products) ? raw.products : [])
    .filter((p) => p && p.name)
    .map((p) => {
      let slug = slugify(p.slug || p.name, "product");
      let n = 2;
      while (used.has(slug)) slug = `${slugify(p.slug || p.name, "product")}-${n++}`;
      used.add(slug);
      return { ...p, slug, url_internal: `/shop/${slug}/` };
    });
  return {
    currency: raw.currency || "USD",
    affiliateDisclosure: raw.affiliateDisclosure || "",
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    products,
  };
}

/**
 * Activity categories for /tours/. The importer tags every product with one of
 * these keys; the order here is the order they appear in the filter and on the
 * hub, so e-bikes lead, as they do everywhere else on the site.
 */
export const TOUR_CATEGORIES = [
  { key: "ebike", name: "E-bike tours", short: "E-bike",
    blurb: "Guided rides on electric bikes, with the bike, helmet and a guide who knows the route." },
  { key: "jetski", name: "Jet ski & watercraft", short: "Jet ski",
    blurb: "Waverunner and jet ski rentals and guided runs, from single hops to island tours." },
  { key: "boat", name: "Boat & sailing", short: "Boat",
    blurb: "Charters, sunset sails, catamarans and pontoon rentals along the coast and the Keys." },
  { key: "watersports", name: "Watersports", short: "Watersports",
    blurb: "Parasailing, kayaking, paddleboarding, snorkelling and the rest of the on-the-water list." },
  { key: "airboat", name: "Airboat & Everglades", short: "Airboat",
    blurb: "Airboat runs and Everglades wildlife trips through the sawgrass." },
  { key: "other", name: "More Florida experiences", short: "More",
    blurb: "Everything else worth booking while you are here." },
];

const TOUR_CATEGORY_KEYS = new Set(TOUR_CATEGORIES.map((c) => c.key));

/**
 * Bookable Viator experiences listed at /tours/, each with its own page at
 * /tours/<slug>/. The file is written by scripts/import_viator.mjs, so slugs
 * are derived and de-duplicated here rather than stored, and every field is
 * treated as untrusted: URLs are validated at render, and an unknown category
 * falls back to "other" rather than producing a page nothing links to.
 */
export function loadTours() {
  const file = join(ROOT, "data", "tours.json");
  if (!existsSync(file)) return { currency: "USD", disclosure: "", tours: [], categories: [] };
  const raw = JSON.parse(readFileSync(file, "utf8"));

  const used = new Set();
  const tours = (Array.isArray(raw.tours) ? raw.tours : [])
    .filter((t) => t && t.name)
    .map((t) => {
      const base = slugify(t.slug || t.name, "tour").slice(0, 70).replace(/-+$/, "");
      let slug = base;
      let n = 2;
      while (used.has(slug)) slug = `${base}-${n++}`;
      used.add(slug);
      return {
        ...t,
        slug,
        url_internal: `/tours/${slug}/`,
        category: TOUR_CATEGORY_KEYS.has(t.category) ? t.category : "other",
        features: Array.isArray(t.features) ? t.features : [],
      };
    });

  // Page titles are fitted to the SERP budget and made unique here, for the
  // same reason listings' are: two operators can run identically named tours.
  const takenTitles = new Map();
  for (const tour of tours) {
    const suffix = tour.location ? ` - ${tour.location}, FL` : " - Florida";
    let title = fitTitle(tour.name, suffix);
    if (takenTitles.has(title)) {
      const base = title;
      let n = 2;
      // The name is truncated to fit, so only a counter added after fitting is
      // guaranteed to change the string.
      while (takenTitles.has(title)) title = `${base} (${n++})`;
    }
    takenTitles.set(title, tour.slug);
    tour.pageTitle = title;
  }

  // Only advertise categories that something actually falls into.
  const present = new Set(tours.map((t) => t.category));
  return {
    currency: raw.currency || "USD",
    disclosure: raw.disclosure || "",
    updated: raw.updated || "",
    tours,
    categories: TOUR_CATEGORIES.filter((c) => present.has(c.key)),
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

/**
 * Hand-written notes for individual town pages, in content/towns/<slug>.md.
 *
 * Front matter can override the page's `title`, `h1`, `description` and `lead`
 * (each may use {count} for the live number of shops); the body is rendered as
 * a local guide section, and an "## FAQs" block is merged into the page's FAQs.
 * Keep shop names out of these files: the page already names shops from the
 * data, and a hand-written mention goes stale the moment a listing changes.
 */
export function loadTownNotes() {
  const dir = join(ROOT, "content", "towns");
  const notes = new Map();
  if (!existsSync(dir)) return notes;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const { meta, body } = parseFrontMatter(readFileSync(join(dir, file), "utf8"));
    const { body: prose, faqs } = extractFaqs(body);
    notes.set(basename(file, ".md"), { ...meta, html: render(prose).html, faqs });
  }
  return notes;
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

/** Slugs in data/excluded-listings.json: businesses the import let through that are not bike rentals. */
function excludedSlugs() {
  const file = join(ROOT, "data", "excluded-listings.json");
  if (!existsSync(file)) return new Set();
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return new Set((raw.listings || []).map((e) => e.slug));
}

/**
 * Listing photos served from this site (see scripts/cache-photos.mjs), keyed by
 * slug. The Google URLs in the raw export are never rendered: they expire.
 */
export function loadListingPhotos() {
  const file = join(ROOT, "data", "listing-photos.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

export function listingUrl(l) {
  return `/cities/${citySlug(l.city)}/${l.slug}/`;
}

/**
 * Every listing, with its URL and its locally cached photo. `raw: true` keeps
 * the original Google photo URL, which only the photo cache script needs.
 */
export function loadListings({ raw = false } = {}) {
  const payload = JSON.parse(readFileSync(join(ROOT, "data", "listings.json"), "utf8"));
  const excluded = excludedSlugs();
  const photos = raw ? {} : loadListingPhotos();
  return payload.listings.filter((l) => !excluded.has(l.slug)).map((l) => {
    const cached = photos[l.slug];
    return {
      ...l,
      ...(raw
        ? {}
        : {
            photo: cached ? cached.src : "",
            photoWidth: cached ? cached.width : 0,
            photoHeight: cached ? cached.height : 0,
          }),
      url: listingUrl(l),
      citySlug: citySlug(l.city),
      regionSlug: regionSlug(l.region),
    };
  });
}

/**
 * A town needs at least this many listings to earn a page of its own. A page
 * for one shop is a thinner copy of that shop's own listing page, and Google
 * treats hundreds of them as low-quality doorway pages. Towns below the line
 * are left out of the index entirely -- no page, no sitemap entry, no internal
 * links -- and their old URLs redirect (see thinTownRedirects in build.mjs).
 * Their shops stay listed on their region page and on /partners/.
 */
export const MIN_TOWN_LISTINGS = 2;

/**
 * Whether a listing's own page is worth putting in Google's index.
 *
 * A partner page restates the business's public Google profile. That is useful
 * to someone who has landed on it, but on its own it adds little a search
 * engine does not already have, and hundreds of such pages are what Google's
 * thin-content and AdSense "low value content" reviews flag. So a listing page
 * is only offered for indexing when there is enough to it to stand alone: a
 * real review history, published hours and a website. The rest stay live and
 * linked, with `noindex, follow`, and are still listed in full on their town
 * page, which is the page meant to rank.
 */
export const INDEX_LISTING_MIN_REVIEWS = 10;

export function isIndexableListing(l) {
  return (
    (l.reviews || 0) >= INDEX_LISTING_MIN_REVIEWS &&
    (l.hours || []).some((h) => !h.closed) &&
    Boolean(l.site || l.website)
  );
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
          url: `/cities/${listing.citySlug}/`,
          listings: [],
        });
      }
      cities.get(listing.citySlug).listings.push(listing);
    }
    if (!regions.has(listing.regionSlug)) {
      regions.set(listing.regionSlug, {
        name: listing.region,
        slug: listing.regionSlug,
        url: `/cities/#${listing.regionSlug}`,
        listings: [],
        cities: [],
      });
    }
    regions.get(listing.regionSlug).listings.push(listing);
  }

  const thinCities = [];
  for (const [slug, city] of cities) {
    if (city.listings.length < MIN_TOWN_LISTINGS) {
      thinCities.push(city);
      cities.delete(slug);
    }
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

  // A thin town has one shop, so its card and links go straight to that shop.
  for (const city of thinCities) {
    city.url = city.listings[0].url;
    const region = regions.get(city.regionSlug);
    if (region) region.thinCities = [...(region.thinCities || []), city];
  }

  const categories = CATEGORIES.map((cat) => {
    const matched = listings.filter(cat.match).sort((a, b) => b.score - a.score);
    const towns = [];
    for (const city of cities.values()) {
      const local = city.listings.filter(cat.match);
      // A town gets its own category page only when the category is a real
      // subset of the town: if every shop in town matches, that page would be
      // a copy of the town page, so the link goes to the town page instead.
      const own = local.length >= MIN_CATEGORY_TOWN_LISTINGS && local.length < city.listings.length;
      if (!local.length) continue;
      towns.push({
        city,
        listings: local,
        url: own ? `/find/${cat.slug}/${city.slug}/` : city.url,
        ownPage: own,
      });
    }
    towns.sort((a, b) => b.listings.length - a.listings.length || a.city.name.localeCompare(b.city.name));
    return { ...cat, url: `/find/${cat.slug}/`, listings: matched, towns };
  }).filter((c) => c.listings.length >= MIN_CATEGORY_LISTINGS);

  // Each town page links to its own slice of every category.
  for (const city of cities.values()) city.categories = [];
  for (const cat of categories) {
    for (const town of cat.towns) {
      if (town.ownPage) town.city.categories.push({ category: cat, url: town.url, count: town.listings.length });
    }
  }

  return {
    cities: Array.from(cities.values()).sort((a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name)),
    citiesBySlug: cities,
    regions: Array.from(regions.values()).sort((a, b) => b.listings.length - a.listings.length),
    regionsBySlug: regions,
    categories,
    thinCities: thinCities.sort((a, b) => a.slug.localeCompare(b.slug)),
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
