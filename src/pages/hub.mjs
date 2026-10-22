import { esc, attr, clamp, prettyDate, isoDate, plural, commaList } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import {
  linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, faqBlock, faqSchema,
  listicle, mapPanel, statRow, bookingCta,
} from "../components.mjs";
import { photoFor, secondPhotoFor, figure, banner, photoById, sitePhoto } from "../images.mjs";
import { loadHubBody } from "../data.mjs";
import { bikeIcon } from "../bike-icons.mjs";
import { quickRent } from "./rent.mjs";
import { typeTownCloud, typeTownTable } from "./city-types.mjs";

/* ---------------------------------------------- electric bike type cluster */

const TYPES_HUB = "electric-bike-types";

/** A type card: the bike's diagram, its name and what it is best for. */
function typeCards(entries, current = "") {
  return `<div class="type-cards">${entries
    .map(
      (e) => `<a class="type-card${e.slug === current ? " is-current" : ""}" href="${attr(e.url)}"${
        e.slug === current ? ' aria-current="page"' : ""
      }>
      ${bikeIcon(e.style)}
      <strong>${esc(e.shortTitle || e.title)}</strong>
      ${e.bestFor ? `<span>${esc(e.bestFor)}</span>` : ""}
    </a>`
    )
    .join("")}</div>`;
}

/**
 * One numbered section of the hub, buyer's-guide style: the diagram, what the
 * type is, two quick answers from its guide, its key facts and the next steps.
 */
function typeSection(e, n) {
  const name = e.shortTitle || e.title;
  const singular = name.replace(/s$/, "").replace(/Bikes$/, "Bike");
  const article = /^[aeiou]/i.test(singular) ? "an" : "a";
  const quick = (e.faqs || []).slice(0, 2);
  return `<section class="type-section" id="${attr(e.slug)}">
  <h2>${n}. ${esc(name)}</h2>
  ${e.image ? sitePhoto(e.image, { className: "type-photo" }) : ""}
  <figure class="type-diagram">${bikeIcon(e.style)}<figcaption>${esc(
    e.diagramCaption ? `The typical shape of ${e.diagramCaption}.` : name
  )}</figcaption></figure>
  <h3>What is ${article} ${esc(singular.toLowerCase())}?</h3>
  <p>${esc(e.summary || e.description)}</p>
  ${quick.map((f) => `<h3>${esc(f.q)}</h3>${f.a}`).join("")}
  <ul class="type-facts">
    ${e.bestFor ? `<li><b>Best for</b> ${esc(e.bestFor)}</li>` : ""}
    ${e.weight ? `<li><b>Typical weight</b> ${esc(e.weight)}</li>` : ""}
    ${e.terrain ? `<li><b>Florida terrain</b> ${esc(e.terrain)}</li>` : ""}
  </ul>
  <p class="type-section__cta"><a class="btn btn--blue" href="${attr(e.url)}">Read the ${esc(name.toLowerCase())} guide</a>
  <a class="btn btn--primary" href="${attr(rentStyleHref(e))}" rel="nofollow">Book Now</a></p>
</section>`;
}

/** Side-by-side comparison of every type, linking each row to its guide. */
function typeTable(entries) {
  return `<div class="table-wrap"><table class="data-table type-table">
  <thead><tr><th scope="col">Type</th><th scope="col">Best for</th><th scope="col">Typical weight</th><th scope="col">Where it shines in Florida</th></tr></thead>
  <tbody>${entries
    .map(
      (e) => `<tr><th scope="row"><a href="${attr(e.url)}">${esc(e.shortTitle || e.title)}</a></th><td>${esc(
        e.bestFor || ""
      )}</td><td>${esc(e.weight || "")}</td><td>${esc(e.terrain || "")}</td></tr>`
    )
    .join("")}</tbody>
</table></div>`;
}

/**
 * Shops whose own public profile (name, description, categories) names this
 * type. The directory has no field for which bikes a shop rents, so nothing
 * else counts as evidence and no shop is listed on a guess.
 */
export function shopsNaming(entry, listings) {
  if (!entry.match) return [];
  const re = new RegExp(entry.match, "i");
  return listings.filter((l) => re.test([l.name, l.description, l.subtypes, l.category, l.type].filter(Boolean).join(" ")));
}

function rentStyleHref(entry) {
  const service = entry.rentStyle === "pedal" ? "bike-rental" : "ebike-rental";
  return `/rent/?service=${service}${entry.rentStyle ? `&style=${encodeURIComponent(entry.rentStyle)}` : ""}`;
}

function whereToRent(entry, ctx) {
  const named = shopsNaming(entry, ctx.listings).slice(0, 10);
  const lower = (entry.shortTitle || entry.title).toLowerCase();
  const fallback = named.length
    ? []
    : ctx.listings.filter((l) => l.is_ebike && (l.tags || []).includes("Rentals")).slice(0, 6);
  return `<section class="section section--tint" id="where-to-rent">
  <div class="wrap">
    <h2>Where to rent ${esc(entry.rentHeading || `${/^[aeiou]/.test(lower) ? "an" : "a"} ${lower.replace(/s$/, "")}`)} in Florida</h2>
    ${
      named.length
        ? `<p class="muted">These ${named.length} Florida ${plural(named.length, "shop")} name ${esc(lower)} in their own
    Google profile. Profiles go out of date, so confirm the bike is available before you go, or send a booking
    request and we will check for you.</p>
    ${listicle(named)}`
        : `<p class="muted">No shop in our directory names ${esc(lower)} in its public Google profile, so we will not guess
    which ones have them. Shops that rent electric bikes are the ones to ask. These are the top-rated of them; call
    ahead, or send a booking request with this style and we will check with shops in your town for you.</p>
    ${listicle(fallback)}`
    }
    <p class="mt-2"><a class="btn btn--primary" href="${attr(rentStyleHref(entry))}" rel="nofollow">Book Now</a></p>
  </div>
</section>`;
}

const HOME_CRUMB = { href: "/", label: "Home" };

function initials(author) {
  return author.type === "organization" ? "FE" : author.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}

/** Byline plus a link to the author's profile. */
export function byline(author, { date, updated, readingTime, words } = {}) {
  if (!author) return "";
  return `<div class="byline">
  <span class="byline__avatar" aria-hidden="true">${esc(
    initials(author)
  )}</span>
  <span class="byline__text">
    <span>By <a href="${attr(author.url)}" rel="author">${esc(author.name)}</a>${
    author.role ? `, ${esc(author.role)}` : ""
  }</span>
    <span class="byline__meta">${[
      date ? `Published ${prettyDate(date)}` : "",
      updated && updated !== date ? `Updated ${prettyDate(updated)}` : "",
      readingTime ? `${readingTime} min read` : "",
      words ? `${words} words` : "",
    ]
      .filter(Boolean)
      .map(esc)
      .join(" · ")}</span>
  </span>
</div>`;
}

export function authorCard(author) {
  if (!author) return "";
  return `<aside class="author-card">
  <span class="byline__avatar byline__avatar--lg" aria-hidden="true">${esc(
    initials(author)
  )}</span>
  <div>
    <h2>About ${esc(author.name)}</h2>
    <p class="muted small mb-0">${esc(author.role || "")}</p>
    <p>${esc(author.short || "")}</p>
    <p class="mb-0"><a class="btn btn--outline btn--sm" href="${attr(author.url)}">More from ${esc(
    author.type === "organization" ? "the team" : author.name.split(" ")[0]
  )}</a></p>
  </div>
</aside>`;
}

/**
 * Official Ride with GPS route embed. Declared in front matter as `rwgps: <id>`.
 * Lazy-loaded, sandboxed, and always paired with a plain link so the route is
 * still reachable if the frame is blocked.
 */
function routeEmbed(entry) {
  const id = String(entry.rwgps || "").trim();
  if (!/^\d+$/.test(id)) return "";
  const href = `https://ridewithgps.com/routes/${id}`;
  return `<figure class="route-embed">
  <iframe src="https://ridewithgps.com/embeds?type=route&amp;id=${attr(id)}&amp;sampleGraph=true"
    title="${attr(entry.title)} route map and elevation profile on Ride with GPS"
    loading="lazy" scrolling="no" referrerpolicy="no-referrer"
    sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
  <figcaption>Route map and elevation profile for ${esc(entry.title)}, hosted by
    <a href="${attr(href)}" rel="noopener nofollow" target="_blank">Ride with GPS</a>.
    ${
      entry.routeNote
        ? esc(entry.routeNote)
        : `${entry.distance ? esc(entry.distance) : ""}${entry.elevation ? ` · ${esc(entry.elevation)}` : ""}`
    }.
  </figcaption>
</figure>`;
}

function tocFor(headings) {
  if (headings.length < 3) return "";
  return `<nav class="toc" aria-label="On this page">
  <h2>On this page</h2>
  <ol>${headings.map((h) => `<li><a href="#${attr(h.id)}">${esc(h.text)}</a></li>`).join("")}</ol>
</nav>`;
}

/* ------------------------------------------------------------- hub page */

export function contentHub(site, hub, entries, ctx) {
  const crumbs = [HOME_CRUMB, { href: `/${hub.slug}/`, label: hub.label }];
  const hubBody = loadHubBody(hub.hubBody);
  const hero = photoFor(hub.slug);
  const extra = secondPhotoFor(hub.slug);

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">${esc(hub.label)}${hub.slug === TYPES_HUB ? "" : " hub"}</span>
      <h1>${esc(hub.h1)}</h1>
      <p>${esc(hub.intro)}</p>
    </div>
    ${hub.slug === TYPES_HUB ? quickRent(ctx.index, { heading: "Rent an e-bike in Florida" }) : ""}
    ${banner(hero, { alt: `${hub.h1} - ${hero.alt}` })}
  </div>
</section>

${
  hub.slug === TYPES_HUB && entries.length
    ? `<section class="section">
  <div class="wrap wrap-narrow">
    ${hub.image ? sitePhoto(hub.image, { className: "type-photo" }) : ""}
    <nav class="toc type-toc" aria-label="Types on this page">
      <h2>The ${entries.length} types of electric bikes</h2>
      <ol>${entries.map((e) => `<li><a href="#${attr(e.slug)}">${esc(e.shortTitle || e.title)}</a></li>`).join("")}</ol>
    </nav>
    ${entries.map((e, i) => typeSection(e, i + 1)).join("")}
  </div>
</section>
<section class="section section--tint">
  <div class="wrap">
    <h2>How the types compare</h2>
    <p class="muted">Tap a type for its full guide. The diagrams show each type's typical shape; the yellow bolt
    marks an electric bike.</p>
    ${typeCards(entries)}
    <div class="mt-3">${typeTable(entries)}</div>
  </div>
</section>
${typeTownTable(ctx.cityTypeList || [])}
${
  hubBody
    ? `<section class="section">
  <div class="wrap wrap-narrow">
    ${tocFor(hubBody.headings)}
    <div class="prose">${hubBody.html}</div>
    ${hubBody.faqs.length ? `<h2 class="mt-3">Frequently asked questions</h2>${faqBlock(hubBody.faqs)}` : ""}
  </div>
</section>`
    : ""
}`
    : `<section class="section section--tint">
  <div class="wrap">
    <h2>${entries.length ? `All ${entries.length} ${plural(entries.length, hub.noun)}` : `${hub.label} guides`}</h2>
    ${
      entries.length
        ? `<div class="grid grid--3 mt-2">${entries
            .map((entry) =>
              linkCard({
                href: entry.url,
                title: entry.title,
                meta: [entry.category, entry.readingTime ? `${entry.readingTime} min read` : ""]
                  .filter(Boolean)
                  .join(" · "),
                text: entry.description,
                more: "Read the guide",
              })
            )
            .join("")}</div>`
        : `<p class="muted">Guides are being added to this section. In the meantime, start with the
           <a href="/blog/">main guides</a> or find a shop on the <a href="/find/">find pages</a>.</p>`
    }
  </div>
</section>`
}

${hub.slug === "trails" && ctx.cityTrailSection ? ctx.cityTrailSection : ""}

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `${hub.label} guides for Florida e-bike riders - ${extra.alt}` })}
      <div>
        <h2>Where to rent nearby</h2>
        <p class="muted">Every guide links to the towns closest to it. You can also start from the
        region you are staying in.</p>
        ${linkCloud(ctx.index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}
      </div>
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: hub.title,
    description: clamp(hub.description),
    path: `/${hub.slug}/`,
    body,
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: hub.h1,
        url: `${site.url}/${hub.slug}/`,
        description: hub.description,
        isPartOf: { "@id": `${site.url}/#website` },
        hasPart: entries.map((e) => ({
          "@type": "Article",
          headline: e.title,
          url: `${site.url}${e.url}`,
        })),
      },
      hubBody && hubBody.faqs.length ? faqSchema(hubBody.faqs) : null,
    ],
  });
}

/* ----------------------------------------------------------- guide page */

export function contentEntry(site, hub, entry, ctx) {
  const crumbs = [HOME_CRUMB, { href: `/${hub.slug}/`, label: hub.label }, { href: entry.url, label: entry.title }];
  const author = ctx.authorsBySlug.get(entry.author);
  const hero = entry.photo ? photoById(entry.photo) : photoFor(entry.slug);
  const extra = entry.photo2 ? photoById(entry.photo2) : secondPhotoFor(entry.slug);
  const isType = hub.slug === TYPES_HUB;
  const related = ctx.hubEntries[hub.slug].filter((e) => e.slug !== entry.slug).slice(0, isType ? 99 : 3);

  const towns = entry.towns
    .map((slug) => ctx.index.citiesBySlug.get(slug))
    .filter(Boolean);
  const nearby = towns.flatMap((t) => t.listings.slice(0, 4)).slice(0, 10);

  const facts = [
    entry.distance ? { value: entry.distance, label: "Distance" } : null,
    entry.elevation ? { value: entry.elevation, label: "Elevation" } : null,
    entry.surface ? { value: entry.surface, label: "Surface" } : null,
    entry.difficulty ? { value: entry.difficulty, label: "Difficulty" } : null,
    entry.region ? { value: entry.region, label: "Region" } : null,
    entry.typical ? { value: entry.typical, label: "Typical cost" } : null,
    entry.range ? { value: entry.range, label: "Usual range" } : null,
    entry.bestFor ? { value: entry.bestFor, label: "Best for" } : null,
    entry.weight ? { value: entry.weight, label: "Typical weight" } : null,
    entry.terrain ? { value: entry.terrain, label: "Florida terrain" } : null,
  ].filter(Boolean);

  const body = `
<section class="post-head">
  <div class="wrap wrap-narrow">
    ${breadcrumbs(crumbs).replace('<div class="wrap">', "<div>")}
    <h1>${esc(entry.title)}</h1>
    <p class="lede muted">${esc(entry.description)}</p>
    ${isType ? quickRent(ctx.index, { style: entry.rentStyle, service: entry.rentStyle === "pedal" ? "bike-rental" : "ebike-rental", heading: `Rent ${/^[aeiou]/i.test(entry.shortTitle || entry.title) ? "an" : "a"} ${(entry.shortTitle || entry.title).replace(/s$/, "").toLowerCase()} in Florida` }) : ""}
    ${byline(author, { date: entry.date, updated: entry.updated, readingTime: entry.readingTime, words: entry.words })}
  </div>
</section>

<article class="post-body">
  <div class="wrap wrap-narrow">
    ${banner(hero, { alt: `${entry.title} - ${hero.alt}` })}
    ${
      isType && entry.style
        ? `<figure class="type-diagram">${bikeIcon(entry.style)}<figcaption>Diagram: the typical shape of ${esc(
            entry.diagramCaption || (entry.shortTitle || entry.title).toLowerCase()
          )}${entry.style === "pedal" ? "" : ". The yellow bolt marks an electric bike"}.</figcaption></figure>`
        : ""
    }
    ${isType && entry.image ? sitePhoto(entry.image, { className: "type-photo" }) : ""}
    ${facts.length ? `<div class="mt-2">${statRow(facts).replace('class="stat-row"', 'class="stat-row stat-row--facts"')}</div>` : ""}
    ${routeEmbed(entry)}
    ${tocFor(entry.headings)}
    <div class="prose">${entry.html}</div>
    ${figure(extra, { alt: `${entry.title} - ${extra.alt}`, className: "mt-3" })}
    ${
      entry.faqs.length
        ? `<h2 class="mt-3">Frequently asked questions</h2>${faqBlock(entry.faqs)}`
        : ""
    }
    ${authorCard(author)}
  </div>
</article>

${adSlot(site, "")}

${isType ? whereToRent(entry, ctx) : ""}
${isType ? typeTownCloud(ctx.cityTypeList || [], entry.slug) : ""}

${
  hub.slug === "trails"
    ? `<section class="section">
  <div class="wrap wrap-narrow">
    ${bookingCta(site, {
      variant: "inline",
      title: "Prefer to ride this one with a guide?",
      text: "Guided e-bike tours across Florida include the bike, the helmet and a guide who already knows the route, which is worth a lot on a trail you have never ridden. Browse what is running and book direct.",
      secondary: { href: "/find/guided-ebike-tours-in-florida/", label: "Florida tour operators" },
    })}
  </div>
</section>`
    : ""
}

${
  nearby.length
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>Rent an e-bike near ${esc(commaList(towns.map((t) => t.name)))}</h2>
    <p class="muted">The closest rental partners to this ${esc(hub.noun.replace(" guide", ""))}, ranked by
    Google rating and review volume.</p>
    ${mapPanel(nearby, { id: `map-${attr(entry.slug)}`, zoom: 10 })}
    ${listicle(nearby)}
    ${linkCloud(towns.map((t) => ({ href: t.url, label: `${t.name} e-bike rentals`, count: t.listings.length })))}
  </div>
</section>`
    : ""
}

${
  isType
    ? `<section class="section">
  <div class="wrap">
    <h2>Other types of electric bikes</h2>
    <p class="muted">Every guide in this series. Not sure which one fits? <a href="/${attr(hub.slug)}/">Compare all the types side by side</a>.</p>
    ${typeCards(related)}
  </div>
</section>`
    : `<section class="section">
  <div class="wrap">
    <h2>More ${esc(plural(2, hub.noun))}</h2>
    <div class="grid grid--3 mt-2">
      ${related
        .map((e) => linkCard({ href: e.url, title: e.title, meta: e.category, text: e.description, more: "Read the guide" }))
        .join("")}
    </div>
    <p class="mt-2"><a class="btn btn--outline btn--sm" href="/${attr(hub.slug)}/">All ${esc(hub.label.toLowerCase())} guides</a>
    <a class="btn btn--outline btn--sm" href="/find/">Find a rental shop</a></p>
  </div>
</section>`
}
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: entry.metaTitle || `${entry.title} - ${site.name}`,
    description: clamp(entry.description),
    path: entry.url,
    body,
    ogType: "article",
    ogImage: hero.src,
    embeds: entry.rwgps ? ["ridewithgps"] : [],
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": `${site.url}${entry.url}#article`,
        headline: entry.title,
        description: entry.description,
        url: `${site.url}${entry.url}`,
        datePublished: isoDate(entry.date),
        dateModified: isoDate(entry.updated || entry.date),
        wordCount: entry.words,
        inLanguage: "en-US",
        articleSection: hub.label,
        image: `${site.url}${hero.src}`,
        author: author
          ? author.type === "organization"
            ? { "@type": "Organization", name: author.name, url: `${site.url}${author.url}` }
            : { "@type": "Person", name: author.name, url: `${site.url}${author.url}`, jobTitle: author.role }
          : { "@type": "Organization", name: site.name },
        publisher: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${site.url}${entry.url}` },
      },
      entry.faqs.length ? faqSchema(entry.faqs) : null,
    ],
  });
}

/* ---------------------------------------------------------- author pages */

export function authorsHub(site, authors, ctx) {
  const crumbs = [HOME_CRUMB, { href: "/authors/", label: "Authors" }];
  const hero = photoFor("authors");

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Authors</span>
      <h1>Who Writes Florida Ebike Rentals</h1>
      <p>A small team. Everything published here is written by a named person who rides, rents and
      checks the data behind it — no anonymous copy, and no articles written by people who have never
      been to the towns they cover.</p>
    </div>
    ${banner(hero, { alt: `The Florida Ebike Rentals writing team - ${hero.alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="grid grid--3">
      ${authors
        .map((a) =>
          linkCard({
            href: a.url,
            title: a.name,
            meta: a.role,
            text: a.short,
            more: "Read profile",
          })
        )
        .join("")}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(secondPhotoFor("authors"), {
        alt: `The riding our writers cover - ${secondPhotoFor("authors").alt}`,
      })}
      <div>
        <h2>How we work</h2>
        <p>Every guide on this site is written by a named person, and every listing is built from
        public business data that we re-import on a schedule rather than writing once and forgetting.
        Rankings come from Google rating and review volume, never from payment.</p>
        <p>Our <a href="/about/">about page</a> explains how listings are chosen, and the
        <a href="/disclaimer/">disclaimer</a> sets out the limits of the data.</p>
        <p><a class="btn btn--primary" href="/rent/">Book Now</a></p>
      </div>
    </div>
  </div>
</section>
${adSlotScript(site, 0)}
`;

  return page(site, {
    title: "Authors - Florida Ebike Rentals",
    description:
      "The writers behind Florida Ebike Rentals: who they are, what they cover, and the riding and research behind each section of the site.",
    path: "/authors/",
    body,
    ogImage: hero.src,
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Authors",
        url: `${site.url}/authors/`,
        isPartOf: { "@id": `${site.url}/#website` },
      },
    ],
  });
}

export function authorPage(site, author, ctx) {
  const crumbs = [HOME_CRUMB, { href: "/authors/", label: "Authors" }, { href: author.url, label: author.name }];
  const hero = photoFor(author.slug);
  const extra = secondPhotoFor(author.slug);

  const posts = ctx.blog.filter((p) => p.author === author.slug);
  const guides = Object.values(ctx.hubEntries).flat().filter((e) => e.author === author.slug);
  const all = [...posts, ...guides];

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap wrap-narrow">
    <div class="author-head">
      <span class="byline__avatar byline__avatar--lg" aria-hidden="true">${esc(
        initials(author)
      )}</span>
      <div>
        <h1>${esc(author.name)}</h1>
        <p class="muted mb-0">${esc(author.role || "")}${author.since ? ` · Writing here since ${esc(author.since)}` : ""}</p>
      </div>
    </div>
    ${
      author.expertise.length
        ? `<ul class="tag-row mt-2">${author.expertise
            .map((e) => `<li><span class="tag">${esc(e)}</span></li>`)
            .join("")}</ul>`
        : ""
    }
    ${banner(hero, { alt: `${author.name} covers ${author.expertise[0] || "Florida e-bike rentals"} - ${hero.alt}` })}
    <div class="prose mt-2">${author.html}</div>
    ${figure(extra, { alt: `${author.name}'s beat - ${extra.alt}`, className: "mt-2" })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>${all.length ? `${all.length} ${plural(all.length, "article")} by ${esc(author.name)}` : `Articles by ${esc(author.name)}`}</h2>
    ${
      all.length
        ? `<div class="grid grid--3 mt-2">${all
            .map((p) =>
              linkCard({
                href: p.url,
                title: p.title,
                meta: [p.category, p.date ? prettyDate(p.date) : ""].filter(Boolean).join(" · "),
                text: p.description,
                more: "Read",
              })
            )
            .join("")}</div>`
        : '<p class="muted">Articles from this author are on the way.</p>'
    }
  </div>
</section>
${adSlotScript(site, 0)}
`;

  return page(site, {
    title:
      author.type === "organization"
        ? `${author.name} - How We Research and Edit`
        : `${author.name} - ${author.role || "Author"} at Florida Ebike Rentals`,
    description: clamp(
      author.short || `${author.name} writes for Florida Ebike Rentals covering ${commaList(author.expertise)}.`
    ),
    path: author.url,
    body,
    ogType: "profile",
    ogImage: hero.src,
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: `${site.url}${author.url}`,
        isPartOf: { "@id": `${site.url}/#website` },
        mainEntity: {
          "@type": author.type === "organization" ? "Organization" : "Person",
          "@id": `${site.url}${author.url}#person`,
          name: author.name,
          jobTitle: author.role,
          description: author.short,
          url: `${site.url}${author.url}`,
          knowsAbout: author.expertise,
          worksFor: { "@id": `${site.url}/#organization` },
        },
      },
    ],
  });
}
