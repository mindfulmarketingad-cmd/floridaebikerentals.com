import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { slugify, miles, unique, fitTitle } from "./util.mjs";
import { parseFrontMatter, render, wordCount } from "./markdown.mjs";
import { closesAtOrAfter, openDayCount } from "./hours.mjs";

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

/**
 * Tag-and-city cross pages: a page per city per tag, built only where that
 * city actually has at least one matching listing. A city with zero golf cart
 * shops gets no golf-cart page rather than a thin one with nothing in it.
 */
/**
 * Facet pages: a town's list cut by something in the Google record that people
 * actually search on. Two rules keep these honest. Everything here is either a
 * Google business subtype or an attribute the shop published itself, so the
 * copy says "lists" rather than "has" - we are reporting what the profile
 * claims, not what we verified in person. And a facet only gets a page in a
 * town with at least FACET_MIN_SHOPS matches, so no page exists to list one
 * shop and a paragraph of filler.
 */
export const FACET_MIN_SHOPS = 3;

const hasSubtype = (listing, ...names) =>
  (listing.subtypes || []).some((s) => names.includes(s));
const hasAttribute = (listing, ...names) =>
  (listing.about || []).some((group) =>
    (group.items || []).some((item) => names.includes(String(item)))
  );

export const FIND_FACETS = [
  {
    key: "electric-bike-shops",
    shortLabel: "Electric bike shops",
    slugFor: (city) => `electric-bike-shops-in-${city.slug}-florida`,
    h1: (city) => `Electric Bike Shops in ${city.name}, Florida`,
    title: (city, n) => `Electric Bike Shops in ${city.name}, FL - ${n} Specialists`,
    noun: "electric bike shop",
    nounPlural: "electric bike shops",
    lede: (city, n) =>
      `The ${n} businesses in ${city.name} that Google classes as electric bicycle stores rather ` +
      `than general bike shops - the ones that sell, service and rent e-bikes as their main trade.`,
    intro: (city) =>
      `A general bike shop will often rent you an e-bike. A shop that specialises in them is a ` +
      `different proposition: staff who ride the things daily, a workshop that can handle a motor ` +
      `and a battery rather than only a drivetrain, and a fleet that gets replaced rather than run ` +
      `into the ground. These are the ${city.name} businesses Google lists in that second category.`,
    statewide: { url: "/find/electric-bike-shops-in-florida/", label: "Electric bike shops across Florida" },
    match: (l) => hasSubtype(l, "Electric bicycle store"),
  },
  {
    key: "free-parking",
    shortLabel: "Rentals with free parking",
    slugFor: (city) => `ebike-rentals-with-free-parking-in-${city.slug}-florida`,
    h1: (city) => `E-Bike Rentals With Free Parking in ${city.name}, Florida`,
    title: (city, n) => `${n} E-Bike Rentals With Free Parking in ${city.name}, FL`,
    noun: "shop with free parking",
    nounPlural: "shops with free parking",
    lede: (city, n) =>
      `${n} rental shops in ${city.name} whose Google profile lists free parking - a lot, a garage ` +
      `or free street parking. In a Florida beach town that is often the difference between a ride ` +
      `and a wasted morning.`,
    intro: (city) =>
      `Parking is the hidden cost of a beach-town bike rental. You drive to the shop, pay to leave ` +
      `the car somewhere, then pay again for the bikes. The shops below publish free parking on ` +
      `their own profile, which usually means their own lot - worth ten dollars and twenty minutes ` +
      `on a busy ${city.name} weekend.`,
    statewide: null,
    match: (l) => hasAttribute(l, "Free parking lot", "Free street parking", "Free parking garage"),
  },
  {
    key: "wheelchair-accessible",
    shortLabel: "Wheelchair accessible rentals",
    slugFor: (city) => `wheelchair-accessible-bike-rentals-in-${city.slug}-florida`,
    h1: (city) => `Wheelchair Accessible Bike Rentals in ${city.name}, Florida`,
    title: (city, n) => `Wheelchair Accessible Bike Rentals in ${city.name}, FL`,
    noun: "shop with step-free access",
    nounPlural: "shops with step-free access",
    lede: (city, n) =>
      `${n} rental shops in ${city.name} whose Google profile lists a wheelchair accessible ` +
      `entrance, with the ones that also list accessible parking and restrooms marked.`,
    intro: (city) =>
      `Getting into the shop is the part nobody lists on a rental page. These ${city.name} ` +
      `businesses publish an accessible entrance on their own Google profile. It is a claim about ` +
      `the premises rather than about the bikes, so if you need an adaptive cycle, a trike or a ` +
      `hand-cycle, call ahead and ask directly - that is a separate question and worth asking before ` +
      `you travel.`,
    statewide: null,
    match: (l) => hasAttribute(l, "Wheelchair accessible entrance"),
  },
  {
    key: "book-online",
    shortLabel: "Shops that book online",
    slugFor: (city) => `book-ebike-rentals-online-in-${city.slug}-florida`,
    h1: (city) => `Book E-Bike Rentals Online in ${city.name}, Florida`,
    title: (city, n) => `Book E-Bike Rentals Online in ${city.name}, FL - ${n} Shops`,
    noun: "shop taking online bookings",
    nounPlural: "shops taking online bookings",
    lede: (city, n) =>
      `${n} ${city.name} rental shops with a working online booking link, so you can reserve a bike ` +
      `before you arrive rather than hoping one is free.`,
    intro: (city) =>
      `Most Florida rental shops still take bookings by phone, which is fine until you are trying to ` +
      `arrange a family's bikes from another time zone. The shops below publish a booking link of ` +
      `their own. In ${city.name}'s peak weeks that is the difference between a reserved bike and a ` +
      `queue - and booking direct rather than through a marketplace keeps the shop's own rate.`,
    statewide: null,
    match: (l) => Boolean(l.booking_link),
  },
  {
    key: "repair-service",
    shortLabel: "E-bike repair and service",
    slugFor: (city) => `ebike-repair-and-service-in-${city.slug}-florida`,
    h1: (city) => `E-Bike Repair and Service in ${city.name}, Florida`,
    title: (city, n) => `E-Bike Repair and Service in ${city.name}, FL - ${n} Shops`,
    noun: "repair shop",
    nounPlural: "repair shops",
    lede: (city, n) =>
      `${n} businesses in ${city.name} that Google lists as bicycle or scooter repair shops, for ` +
      `when the bike you own needs a mechanic rather than the one you are renting.`,
    intro: (city) =>
      `A flat on a fat-tyre e-bike is not a roadside fix, and not every rental counter has a ` +
      `mechanic behind it. These ${city.name} businesses are listed as repair shops on their Google ` +
      `profile. Call before you carry a bike across town: e-bike work needs a shop willing to touch ` +
      `a motor and a battery, and not every bicycle repair shop is.`,
    statewide: { url: "/find/ebike-repair-and-service-in-florida/", label: "E-bike repair across Florida" },
    match: (l) => hasSubtype(l, "Bicycle repair shop", "Scooter repair shop"),
  },
  {
    key: "delivery",
    shortLabel: "Rentals that deliver",
    slugFor: (city) => `ebike-rental-delivery-in-${city.slug}-florida`,
    h1: (city) => `E-Bike Rental Delivery in ${city.name}, Florida`,
    title: (city, n) => `E-Bike Rental Delivery in ${city.name}, FL - ${n} Shops`,
    noun: "shop that delivers",
    nounPlural: "shops that deliver",
    lede: (city, n) =>
      `${n} ${city.name} rental shops that list delivery on their Google profile - bikes brought to ` +
      `the house, the hotel or the condo instead of a trip to a counter.`,
    intro: (city) =>
      `Delivery is what turns a rental from an errand into something that is simply waiting for you. ` +
      `It matters most when there are more bikes than a car can carry, when nobody wants to give up ` +
      `a parking space they finally found, or when the ride starts from a rental house rather than ` +
      `from town. The ${city.name} shops below publish delivery themselves. What they do not publish ` +
      `is the radius or the fee, and both vary a lot - ask for the drop-off window and the collection ` +
      `time when you book, because an evening pickup on the last day is worth more than a few dollars ` +
      `off the rate.`,
    statewide: {
      url: "/find/ebike-rentals-with-delivery-in-florida/",
      label: "Florida shops that deliver e-bikes",
    },
    match: (l) => (l.tags || []).includes("Delivery available"),
  },
];

/**
 * Builds every facet page that clears the minimum. `taken` guards against a
 * slug that a town, region or topic page already owns - the writer would
 * otherwise silently overwrite one page with another.
 */
export function buildFacetPages(index) {
  const taken = new Set([
    ...index.cities.map((c) => c.slug),
    ...index.regions.map((r) => r.slug),
    ...index.topics.map((t) => t.slug),
    ...index.cityTopicPages.map((p) => p.slug),
    ...(index.nearbyTowns || []).map((t) => t.slug),
  ]);
  const pages = [];
  for (const facet of FIND_FACETS) {
    for (const city of index.cities) {
      const listings = city.listings.filter(facet.match);
      if (listings.length < FACET_MIN_SHOPS) continue;
      const slug = facet.slugFor(city);
      if (taken.has(slug)) continue;
      taken.add(slug);
      pages.push({ facet, city, listings, slug, url: `/find/${slug}/` });
    }
  }
  return pages;
}

/**
 * Region facet pages. Some things a shop publishes about itself are real and
 * worth searching on but far too rare to carry a page per town - women-owned
 * and veteran-owned businesses are the clearest examples, with a handful in the
 * whole state. Cutting those at region level rather than city level is the
 * difference between a page listing eight shops and forty pages listing one.
 *
 * Same honesty rule as the town facets: everything here is a self-published
 * Google attribute, so the copy reports what the business says about itself.
 */
export const REGION_FACET_MIN_SHOPS = 3;

/** Titles are capped at 70 characters, and region names run long. */
const pickTitle = (long, short) => (long.length <= 70 ? long : short);
/** ", Florida" is redundant on "Southwest Florida" or "The Florida Keys". */
const flSuffix = (region) => (/florida/i.test(region.name) ? "" : ", Florida");

export const REGION_FACETS = [
  {
    key: "women-owned",
    shortLabel: "Women-owned rentals",
    slugFor: (region) => `women-owned-ebike-rentals-in-${region.slug}`,
    h1: (region) => `Women-Owned E-Bike Rentals in ${region.name}`,
    title: (region, n) =>
      pickTitle(
        `Women-Owned E-Bike Rentals in ${region.name}${flSuffix(region)}`,
        `Women-Owned E-Bike Rentals in ${region.name}`
      ),
    noun: "women-owned shop",
    nounPlural: "women-owned shops",
    lede: (region, n) =>
      `${n} rental shops across ${region.name} that identify as women-owned on their own Google ` +
      `business profile, with ratings, towns and contact details for each.`,
    intro: (region) =>
      `Google lets a business self-identify as women-owned, and the shops below have done so. It is ` +
      `a claim the owner makes rather than a certification anyone checks, which is worth knowing ` +
      `before you treat it as verified - but it is also the only public record of it, and for ` +
      `riders who would rather put their money somewhere specific in ${region.name}, it is the list ` +
      `that exists. Most of these are small operations where the person answering the phone owns ` +
      `the bikes.`,
    match: (l) => hasAttribute(l, "Identifies as women-owned"),
  },
  {
    key: "veteran-owned",
    shortLabel: "Veteran-owned rentals",
    slugFor: (region) => `veteran-owned-ebike-rentals-in-${region.slug}`,
    h1: (region) => `Veteran-Owned E-Bike Rentals in ${region.name}`,
    title: (region, n) =>
      pickTitle(
        `Veteran-Owned E-Bike Rentals in ${region.name}${flSuffix(region)}`,
        `Veteran-Owned E-Bike Rentals in ${region.name}`
      ),
    noun: "veteran-owned shop",
    nounPlural: "veteran-owned shops",
    lede: (region, n) =>
      `${n} e-bike and bike rental shops in ${region.name} that identify as veteran-owned on their ` +
      `Google business profile.`,
    intro: (region) =>
      `Florida has more veteran-owned small businesses than almost any state, and rental shops are a ` +
      `natural fit - seasonal, hands-on, and heavy on maintenance. The ${region.name} shops here ` +
      `identify as veteran-owned on their own profile. As with any self-published attribute, it is ` +
      `the owner's own statement rather than something certified, and it is worth asking about ` +
      `directly if it is the reason you are booking.`,
    match: (l) => hasAttribute(l, "Identifies as veteran-owned"),
  },
  {
    key: "local-independent",
    shortLabel: "Independent local shops",
    slugFor: (region) => `local-ebike-rental-shops-in-${region.slug}`,
    h1: (region) => `Support Local: Independent E-Bike Rentals in ${region.name}`,
    title: (region, n) =>
      pickTitle(
        `Independent E-Bike Rental Shops in ${region.name}${flSuffix(region)}`,
        `Independent E-Bike Rental Shops in ${region.name}`
      ),
    noun: "independent shop",
    nounPlural: "independent shops",
    lede: (region, n) =>
      `${n} rental shops across ${region.name} that describe themselves as a small business rather ` +
      `than a chain, franchise or resort concession.`,
    intro: (region) =>
      `In most Florida beach towns the rental market splits two ways: an operator with a counter in ` +
      `every hotel lobby, and someone with a garage full of bikes they maintain themselves. The ` +
      `second kind is usually where the local trail advice comes from, and where a mechanic will ` +
      `actually look at a bike rather than swap it. The ${region.name} shops below flag themselves ` +
      `as a small business on their Google profile.`,
    match: (l) => hasAttribute(l, "Small business"),
  },
  {
    key: "family-discount",
    shortLabel: "Family and kids' discounts",
    slugFor: (region) => `family-ebike-rentals-in-${region.slug}`,
    h1: (region) => `Family E-Bike Rentals in ${region.name}`,
    title: (region, n) =>
      pickTitle(
        `Family E-Bike Rentals in ${region.name}${flSuffix(region)} - Kids' Discounts`,
        `Family E-Bike Rentals in ${region.name}${flSuffix(region)}`
      ),
    noun: "shop with a family discount",
    nounPlural: "shops with family discounts",
    lede: (region, n) =>
      `${n} rental shops in ${region.name} that publish a family discount, a discount for kids or a ` +
      `family-friendly rating on their Google profile.`,
    intro: (region) =>
      `Renting for four is not four times renting for one, at least not at the shops that price for ` +
      `families. The businesses below list a family discount, a kids' discount or a family-friendly ` +
      `flag on their own profile. None of them publish the actual figure there, so treat this as the ` +
      `shortlist to call rather than the price - and ask about kids' bikes, trailers and child seats ` +
      `in the same conversation, because those are usually a separate line on the bill.`,
    statewide: {
      url: "/find/family-ebike-rentals-in-florida/",
      label: "Family e-bike rentals across Florida",
    },
    match: (l) => hasAttribute(l, "Family discount", "Discounts for kids", "Good for kids"),
  },
];

/**
 * Builds every region facet page that clears the minimum, with the towns inside
 * the region worked out at the same time so the page can link down to them.
 */
export function buildRegionFacetPages(index) {
  const taken = new Set([
    ...index.cities.map((c) => c.slug),
    ...index.regions.map((r) => r.slug),
    ...index.topics.map((t) => t.slug),
    ...index.cityTopicPages.map((p) => p.slug),
    ...(index.nearbyTowns || []).map((t) => t.slug),
    ...(index.facetPages || []).map((p) => p.slug),
  ]);
  const pages = [];
  for (const facet of REGION_FACETS) {
    for (const region of index.regions) {
      const listings = region.listings.filter(facet.match);
      if (listings.length < REGION_FACET_MIN_SHOPS) continue;
      const slug = facet.slugFor(region);
      if (taken.has(slug)) continue;
      taken.add(slug);
      const townSlugs = new Set(listings.map((l) => citySlug(l.city)));
      const towns = index.cities.filter((c) => townSlugs.has(c.slug));
      pages.push({ facet, region, listings, towns, slug, url: `/find/${slug}/` });
    }
  }
  return pages;
}

export const CITY_TOPICS = [
  {
    key: "golf-carts",
    tag: "Golf carts",
    label: "Golf Cart Rentals",
    noun: "golf cart rental",
    slugPrefix: "golf-cart-rentals-near",
    statewideUrl: "/find/golf-cart-and-ebike-rentals-in-florida/",
    intro: (cityName) =>
      `Shops near ${cityName} that rent golf carts alongside e-bikes. In the island and beach towns ` +
      `where carts are street legal, a cart for the luggage and bikes for everyone else is how most ` +
      `families staying near ${cityName} actually get around.`,
  },
  {
    key: "scooters",
    tag: "Scooters",
    label: "Scooter Rentals",
    noun: "scooter rental",
    slugPrefix: "scooter-rentals-near",
    statewideUrl: "/find/ebike-and-scooter-rentals-in-florida/",
    intro: (cityName) =>
      `Shops near ${cityName} that rent scooters or mopeds alongside e-bikes. Useful when a group ` +
      `cannot agree, or when you want two wheels with a bit more range than a bike gives you.`,
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
 * Region outlines for the clickable Florida map, generated from the county
 * boundaries by scripts/make-region-map.py. Absent file just means no map.
 */
export function loadRegionMap() {
  const file = join(ROOT, "data", "region-map.json");
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return Array.isArray(raw.regions) && raw.regions.length ? raw : null;
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
        // Every product gets a detail page of ours, affiliate or not: the
        // outbound retailer link lives on the "Check Price" button there,
        // not on the card people click from a listing grid.
        affiliate: Boolean(p.affiliate),
        url_internal: nested ? `/shop/${category}/${slug}/` : `/shop/${slug}/`,
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

  const sortedCities = Array.from(cities.values()).sort(
    (a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name)
  );

  // One page per city per tag, and only where that city actually has a listing
  // carrying the tag - see the comment on CITY_TOPICS.
  const cityTopics = CITY_TOPICS.map((ct) => {
    const pages = sortedCities
      .map((city) => ({
        city,
        listings: city.listings.filter((l) => (l.tags || []).includes(ct.tag)),
      }))
      .filter((p) => p.listings.length > 0)
      .map((p) => {
        const slug = `${ct.slugPrefix}-${p.city.slug}-florida`;
        return { ...ct, city: p.city, listings: p.listings, slug, url: `/find/${slug}/` };
      });
    return { ...ct, pages };
  });
  const cityTopicPages = cityTopics.flatMap((ct) => ct.pages);
  const cityTopicsByCitySlug = new Map();
  for (const ct of cityTopics) {
    for (const pg of ct.pages) {
      if (!cityTopicsByCitySlug.has(pg.city.slug)) cityTopicsByCitySlug.set(pg.city.slug, []);
      cityTopicsByCitySlug.get(pg.city.slug).push(pg);
    }
  }

  return {
    cities: sortedCities,
    citiesBySlug: cities,
    regions: Array.from(regions.values()).sort((a, b) => b.listings.length - a.listings.length),
    regionsBySlug: regions,
    topics,
    cityTopics,
    cityTopicPages,
    cityTopicsByCitySlug,
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

/* A town with no shop of its own still gets a page, listing the shops closest
 * to it - the question "where can I rent near here?" has a good answer in most
 * of Florida even where the answer is in the next town over. The gate below
 * keeps that promise honest: no page unless there are genuinely several shops
 * within a drive, so nowhere gets a page whose only answer is "nothing near". */
export const NEARBY_RADIUS_MILES = 25;
const NEARBY_MIN_SHOPS = 3;
const NEARBY_MAX_SHOPS = 12;

/** Researched rental rates behind the /costs/ region pages. */
export function loadRentalRates() {
  const file = join(ROOT, "data", "rental-rates.json");
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return raw && raw.regions ? raw : null;
}

export function loadFloridaCities() {
  const file = join(ROOT, "data", "source", "florida-cities.json");
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return Array.isArray(raw.cities) ? raw.cities : [];
}

/**
 * Pages for Florida towns the directory holds no shop in. Any town that
 * already has its own listings is skipped - it has a real page already - as is
 * any whose slug is taken by a town or region page, so these can never collide
 * with or shadow the pages built from real listings.
 */
export function buildNearbyCityPages(listings, index, cities) {
  const taken = new Set([...index.cities.map((c) => c.slug), ...index.regions.map((r) => r.slug)]);
  const mapped = listings.filter((l) => typeof l.lat === "number" && typeof l.lng === "number");

  return cities
    .map((city) => {
      const slug = slugify(city.name);
      if (!slug || taken.has(slug)) return null;

      const near = mapped
        .map((l) => ({ listing: l, distance: miles(city.lat, city.lng, l.lat, l.lng) }))
        .filter((hit) => hit.distance <= NEARBY_RADIUS_MILES)
        .sort((a, b) => a.distance - b.distance);
      if (near.length < NEARBY_MIN_SHOPS) return null;

      const shown = near.slice(0, NEARBY_MAX_SHOPS);
      // The town belongs to whichever region its closest shops sit in.
      const votes = new Map();
      for (const hit of shown) votes.set(hit.listing.region, (votes.get(hit.listing.region) || 0) + 1);
      const region = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];

      return {
        name: city.name,
        county: city.county,
        slug,
        url: `/find/ebike-rentals-in-${slug}/`,
        lat: city.lat,
        lng: city.lng,
        region,
        regionSlug: slugify(region),
        nearest: shown,
        total: near.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/* Hours-based city pages. "Open late" is a fact about the posted hours, so it
 * is settled here; "open now" depends on the clock when the page is read, so
 * that one ships every shop with hours and lets the browser do the filtering.
 * A town needs a few qualifying shops either way - a page listing one shop is
 * not worth the click. */
export const OPEN_LATE_HOUR = 19; /* closes at 7pm or later */
const HOURS_PAGE_MIN_SHOPS = 3;

export function buildHoursPages(index) {
  const openNow = [];
  const openLate = [];

  for (const city of index.cities) {
    const withHours = city.listings.filter((l) => openDayCount(l) > 0);
    if (withHours.length >= HOURS_PAGE_MIN_SHOPS) {
      openNow.push({
        kind: "open-now",
        city,
        listings: withHours,
        slug: `ebike-rentals-open-now-in-${city.slug}-florida`,
        url: `/find/ebike-rentals-open-now-in-${city.slug}-florida/`,
      });
    }

    const late = city.listings.filter((l) => closesAtOrAfter(l, OPEN_LATE_HOUR));
    if (late.length >= HOURS_PAGE_MIN_SHOPS) {
      openLate.push({
        kind: "open-late",
        city,
        listings: late,
        slug: `ebike-rentals-open-late-in-${city.slug}-florida`,
        url: `/find/ebike-rentals-open-late-in-${city.slug}-florida/`,
      });
    }
  }

  return { openNow, openLate };
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
