import { esc, attr, clamp, plural, commaList, isoDate, prettyDate } from "../util.mjs";
import { page, pageHero, breadcrumbSchema } from "../layout.mjs";
import {
  linkCloud, faqBlock, faqSchema, adSlot, adSlotScript, ADSENSE_INLINE, statRow,
} from "../components.mjs";
import { byline, authorCard } from "./hub.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";
import { openDayCount, latestClose, formatMinutes } from "../hours.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const COSTS_CRUMB = { href: "/costs/", label: "Costs" };

/* The two things these pages price, and the words each one needs. */
const KINDS = {
  ebike: {
    key: "ebike",
    noun: "e-bike",
    Noun: "E-Bike",
    slug: (region) => `ebike-rental-costs-in-${region.slug}`,
    tag: null,
  },
  scooter: {
    key: "scooter",
    noun: "scooter",
    Noun: "Scooter",
    slug: (region) => `scooter-rental-costs-in-${region.slug}`,
    tag: "Scooters",
  },
};

/**
 * One cost page per region per thing rented, built only where we hold
 * researched rates for it (data/rental-rates.json). The prices are quotes
 * from named shops with the source they came from; everything else on the
 * page comes from the directory's own record of that region, which is the
 * part no rate card can tell you.
 */
export function buildCostPages(index, rates) {
  if (!rates || !rates.regions) return [];
  const pages = [];
  for (const region of index.regions) {
    const forRegion = rates.regions[region.name];
    if (!forRegion) continue;
    for (const kind of Object.values(KINDS)) {
      const block = forRegion[kind.key];
      if (!block || !Array.isArray(block.points) || !block.points.length) continue;
      const listings = kind.tag
        ? region.listings.filter((l) => (l.tags || []).includes(kind.tag))
        : region.listings;
      if (!listings.length) continue;
      const slug = kind.slug(region);
      pages.push({
        kind: kind.key,
        region,
        listings,
        rates: block,
        checked: rates.checked,
        slug,
        url: `/costs/${slug}/`,
        title: `${kind.Noun} Rental Costs in ${region.name}`,
      });
    }
  }
  return pages;
}

function rateTable(block) {
  return `<div class="ratecard">
  <table class="ratecard__table">
    <thead><tr><th scope="col">What it buys</th><th scope="col">Price</th><th scope="col">Quoted by</th></tr></thead>
    <tbody>${block.points
      .map(
        (point) => `<tr>
      <th scope="row">${esc(point.what)}</th>
      <td class="ratecard__price">${esc(point.price)}</td>
      <td>${
        point.source
          ? `<a href="${attr(point.source)}" rel="nofollow noopener" target="_blank">${esc(point.shop)}</a>`
          : esc(point.shop)
      }</td>
    </tr>`
      )
      .join("")}</tbody>
  </table>
</div>`;
}

export function regionCostPage(site, entry, { index, authorsBySlug }) {
  const { region, listings, rates, kind } = entry;
  const isBike = kind === "ebike";
  const noun = isBike ? "e-bike" : "scooter";
  const Noun = isBike ? "E-Bike" : "Scooter";
  const author = authorsBySlug.get("marisa-donnelly") || authorsBySlug.values().next().value;
  const crumbs = [HOME_CRUMB, COSTS_CRUMB, { href: entry.url, label: entry.title }];
  const hero = photoFor(`costs-${entry.slug}`);
  const extra = secondPhotoFor(`costs-${entry.slug}`);

  /* What the directory itself knows about this region - the part that is ours
     rather than anyone's rate card. */
  const withDelivery = listings.filter((l) => (l.tags || []).includes("Delivery available"));
  const withTours = listings.filter((l) => (l.tags || []).includes("Guided tours"));
  const sevenDay = listings.filter((l) => openDayCount(l) === 7);
  const rated = listings.filter((l) => l.rating > 0);
  const avgRating = rated.length
    ? (rated.reduce((sum, l) => sum + l.rating, 0) / rated.length).toFixed(1)
    : null;
  const towns = [...new Set(listings.map((l) => l.city))];
  const topTowns = region.cities.filter((c) => towns.includes(c.name)).slice(0, 5);
  const latest = listings
    .map((l) => ({ l, close: latestClose(l) }))
    .filter((x) => x.close !== null)
    .sort((a, b) => b.close - a.close)[0];

  const faqs = [
    {
      q: `How much does it cost to rent ${isBike ? "an e-bike" : "a scooter"} in ${region.name}?`,
      a: `<p>Expect ${esc(rates.typical)} at the shops we checked in ${esc(region.name)} in ${esc(
        entry.checked.slice(0, 4)
      )}. The table above shows exactly who quoted what and links to each rate card so you can check
      it yourself. Rates move with the season, so treat these as the shape of the market rather than
      a promise - Florida shops charge most between March and April and over the winter holidays.</p>`,
    },
    {
      q: `Is delivery included in ${region.name}?`,
      a: withDelivery.length
        ? `<p>${esc(String(withDelivery.length))} of the ${esc(String(listings.length))} ${esc(
            noun
          )} ${plural(listings.length, "shop")} we track in ${esc(
            region.name
          )} list delivery on their public profile, including ${esc(
            commaList(withDelivery.slice(0, 3).map((l) => l.name))
          )}. It is often free inside a few miles of the shop and charged beyond that. Our
          <a href="/costs/ebike-delivery-fees-florida/">delivery fee guide</a> covers what that
          usually runs to.</p>`
        : `<p>None of the ${esc(noun)} shops we track in ${esc(
            region.name
          )} advertise delivery, so budget for collecting the ${esc(noun)} yourself. Every Florida
          shop that does list it is on our
          <a href="/find/ebike-rentals-with-delivery-in-florida/">delivery page</a>.</p>`,
    },
    {
      q: `What deposit will I be asked for?`,
      a: `<p>Almost always a card hold rather than a charge, typically $100 to $300 per ${esc(
        noun
      )}, released a few days after you bring it back. It is the single most common surprise on a
      Florida rental and the reason a debit card is a bad idea for this. See
      <a href="/costs/ebike-rental-deposits-and-card-holds/">deposits and card holds</a>, and
      <a href="/costs/damage-waivers-and-insurance/">whether the damage waiver is worth it</a>.</p>`,
    },
    {
      q: `Is it cheaper to rent by the week in ${region.name}?`,
      a: `<p>Nearly always, and the crossover comes sooner than people expect - usually around the
      third day. ${
        rates.points.some((p) => /week/i.test(p.what))
          ? `The weekly quotes in the table above make that plain for ${esc(region.name)}.`
          : `None of the ${esc(region.name)} shops we checked publish a weekly rate, so ask for one
          on the phone: it is routinely offered and rarely advertised.`
      } Our <a href="/costs/daily-vs-weekly-ebike-rental-rates/">daily versus weekly guide</a>
      works the crossover out properly.</p>`,
    },
  ];

  const body = `
${pageHero({
  crumbs: crumbs,
  eyebrow: `${esc(region.name)} rental costs`,
  h1: `How Much Does It Cost to Rent ${isBike ? "an E-Bike" : "a Scooter"} in ${esc(region.name)}?`,
  lede: `${esc(rates.typical)} at the shops we checked, with every quote below traced to the rate
      card it came from. Plus what the ${esc(String(listings.length))} ${esc(noun)} ${plural(
    listings.length,
    "shop"
  )} we track in ${esc(region.name)} actually offer.`,
})}
<section class="section">
  <div class="wrap wrap-narrow">
    ${byline(author, { date: entry.checked, updated: entry.checked, readingTime: 6 })}
    <div class="prose">
      <p>Rental prices in ${esc(region.name)} are set by three things: how long you keep the ${esc(
    noun
  )}, whether it comes to you or you collect it, and what month it is. The quotes below were read off
      the shops' own published rates and checked on ${esc(prettyDate(entry.checked))}. Every one links back to
      its source, because a price you cannot check is worth nothing.</p>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>What ${esc(region.name)} shops are charging</h2>
    ${rateTable(rates)}
    <p class="small muted">Checked ${esc(prettyDate(entry.checked))}. These are the shops' own published rates,
    linked so you can confirm them - not quotes we negotiated, and not a booking price. Seasonal
    pricing, minimum hire periods and card holds are set by each shop.</p>
    ${rates.notes ? `<div class="prose mt-2"><p>${esc(rates.notes)}</p></div>` : ""}
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <h2>What we see across ${esc(region.name)}</h2>
    <p class="muted">From the ${esc(String(listings.length))} ${esc(noun)} ${plural(
    listings.length,
    "shop"
  )} in our directory for this region.</p>
    ${statRow([
      { value: String(listings.length), label: plural(listings.length, `${Noun} shop`) },
      { value: String(withDelivery.length), label: "Deliver to you" },
      { value: String(sevenDay.length), label: "Open seven days" },
      ...(avgRating ? [{ value: avgRating, label: "Average rating" }] : []),
    ])}
    <div class="grid grid--2 mt-3" style="align-items:center">
      ${figure(hero, { alt: `${Noun} rentals in ${region.name}, Florida - ${hero.alt}` })}
      <div class="prose">
        <p>${
          withDelivery.length
            ? `${esc(String(withDelivery.length))} of them will bring the ${esc(
                noun
              )} to you, which is worth more than a few dollars off the day rate if you are staying
              somewhere without easy parking.`
            : `None of them advertise delivery here, so factor in getting to the shop and back.`
        } ${
          sevenDay.length
            ? `${esc(String(sevenDay.length))} post hours seven days a week${
                latest
                  ? `, and the latest closing time in the region is ${esc(formatMinutes(latest.close))}`
                  : ""
              }.`
            : `Sunday closures are common here, so check the day before you plan to ride.`
        }</p>
        <p>${
          withTours.length
            ? `${esc(String(withTours.length))} ${plural(
                withTours.length,
                "operator"
              )} run guided rides as well as renting, which is usually priced per person rather than
              per ${esc(noun)} and costs more than a plain rental for the same hours - you are paying
              for the guide.`
            : `No operator here advertises guided rides, so what you see is the rental rate rather
              than a tour price.`
        }</p>
        ${
          topTowns.length
            ? `<p>The towns with the most choice are ${esc(
                commaList(topTowns.map((c) => c.name))
              )}. Rates inside one region vary more by town than most visitors expect: a beachfront
              counter and an inland shop twenty minutes away are rarely the same price.</p>`
            : ""
        }
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <div class="prose">
      <h2>What moves the price</h2>
      <p><strong>How long you keep it.</strong> The per-day cost falls off sharply after about the
      third day. Anything past a long weekend should be priced as a weekly, even where the shop does
      not advertise one - ask.</p>
      <p><strong>The season.</strong> March and April, and the fortnight around Christmas and New
      Year, are the peak. The same ${esc(noun)} in September often costs noticeably less, and shops
      are far more willing to discuss a rate.</p>
      <p><strong>Delivery.</strong> Usually free within a short radius and charged beyond it. If you
      are renting for a family, delivery is often the difference between one trip and three.</p>
      <p><strong>The deposit.</strong> Not a cost, but it ties up $100 to $300 per ${esc(
        noun
      )} on your card for the length of the hire and a few days after.</p>
      ${
        isBike
          ? `<p><strong>Which class of bike.</strong> A Class 3 that assists to 28 mph usually costs
          more than a Class 1 or 2, and is restricted on more paths. Our
          <a href="/blog/ebike-classes-explained/">classes guide</a> explains which one you actually
          want, and <a href="/blog/florida-ebike-laws/">Florida e-bike law</a> covers where you can
          ride each.</p>`
          : `<p><strong>One seat or two.</strong> A two-seat scooter costs meaningfully more than a
          single and sells out first in season. Florida requires a motorcycle endorsement for
          anything above 50cc, so check what you are being handed before you pay.</p>`
      }

      <h2>Paying less without booking badly</h2>
      <p>Book direct with the shop rather than through a marketplace listing - the shops in our
      directory are listed with their own phone numbers for exactly this reason. Ask for the weekly
      rate out loud even for a five-day hire. Take the delivery if it is free and you are more than a
      short walk out. And avoid the two-hour rate: as the table above shows, it is routinely more than
      half the price of a full day for a fraction of the time.</p>
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap wrap-narrow">
    <h2>${esc(region.name)} ${esc(noun)} cost FAQs</h2>
    ${faqBlock(faqs)}
    ${figure(extra, { alt: `Riding in ${region.name}, Florida - ${extra.alt}` })}
    ${authorCard(author)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Where to rent in ${esc(region.name)}</h2>
    ${linkCloud(
      [
        { href: region.url, label: `All ${region.name} rentals`, count: region.listings.length },
        ...topTowns.map((c) => ({
          href: c.url,
          label: `${c.name} e-bike rentals`,
          count: c.listings.length,
        })),
      ].sort((a, b) => a.label.localeCompare(b.label, "en"))
    )}
    <h3 class="mt-3">More on what Florida rentals cost</h3>
    ${linkCloud(
      [
        { href: "/costs/", label: "All Florida cost guides" },
        { href: "/costs/daily-vs-weekly-ebike-rental-rates/", label: "Daily vs weekly rates" },
        { href: "/costs/ebike-rental-deposits-and-card-holds/", label: "Deposits and card holds" },
        { href: "/costs/ebike-delivery-fees-florida/", label: "Delivery fees" },
        { href: "/costs/damage-waivers-and-insurance/", label: "Damage waivers and insurance" },
      ].sort((a, b) => a.label.localeCompare(b.label, "en"))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  // The price belongs in the title where it fits - it is the whole question -
  // but the long region names leave no room for it.
  const shortTitle = `${Noun} Rental Costs in ${region.name}`;
  const withPrice = `${shortTitle} - ${rates.typical}`;
  return page(site, {
    title: withPrice.length <= 70 ? withPrice : shortTitle,
    description: clamp(
      `What it costs to rent ${isBike ? "an e-bike" : "a scooter"} in ${region.name}: ${
        rates.typical
      }, from the published rates of named Florida shops, plus delivery, deposits and how to pay less.`
    ),
    path: entry.url,
    body,
    ogType: "article",
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      faqSchema(faqs),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `How much does it cost to rent ${isBike ? "an e-bike" : "a scooter"} in ${region.name}?`,
        description: `${Noun} rental costs in ${region.name}, Florida: ${rates.typical}.`,
        url: `${site.url}${entry.url}`,
        datePublished: isoDate(entry.checked),
        dateModified: isoDate(entry.checked),
        inLanguage: "en-US",
        image: `${site.url}${hero.src}`,
        author: author
          ? { "@type": "Person", name: author.name, url: `${site.url}${author.url}`, jobTitle: author.role }
          : undefined,
        publisher: { "@id": `${site.url}/#organization` },
      },
    ],
  });
}
