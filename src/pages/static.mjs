import { esc, attr, prettyDate, clamp, formatReviews } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema, FOOTER_LINKS, HEADER_LINKS } from "../layout.mjs";
import { linkCloud, linkCard, adSlot, adSlotScript, ADSENSE_INLINE, statRow } from "../components.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };

function contactForm(site) {
  const action = site.contactFormEndpoint || "";
  return `<form class="filterbar" style="grid-template-columns:1fr" data-contact-form${
    action ? ` action="${attr(action)}" method="post"` : ""
  } data-mailto="${attr(site.email)}">
  <div class="field">
    <label for="c-name">Your name</label>
    <input type="text" id="c-name" name="name" required maxlength="120" autocomplete="name">
  </div>
  <div class="field">
    <label for="c-email">Email address</label>
    <input type="email" id="c-email" name="email" required maxlength="180" autocomplete="email">
  </div>
  <div class="field">
    <label for="c-subject">Subject</label>
    <select id="c-subject" name="subject">
      <option>Correct a listing</option>
      <option>Add my business</option>
      <option>Remove my listing</option>
      <option>Advertising or partnership</option>
      <option>Something else</option>
    </select>
  </div>
  <div class="field">
    <label for="c-message">Message</label>
    <textarea id="c-message" name="message" required maxlength="4000" placeholder="Include the listing URL if you are reporting a correction."></textarea>
    <span class="field__hint">Do not include payment details or passwords. We never ask for them.</span>
  </div>
  <div class="field" aria-hidden="true" style="position:absolute;left:-9999px">
    <label for="c-company">Company</label>
    <input type="text" id="c-company" name="company" tabindex="-1" autocomplete="off">
  </div>
  <div class="field">
    <button class="btn btn--blue" type="submit">Send message</button>
    <span class="field__hint" data-form-status role="status"></span>
  </div>
</form>
<p class="small muted">Prefer email? Write to <a href="mailto:${attr(site.email)}">${esc(
    site.email
  )}</a> and include the listing URL.</p>`;
}

export function staticPage(site, key, content, extras = {}) {
  const url = `/${key}/`;
  const crumbs = [HOME_CRUMB, { href: url, label: content.title }];
  const html = content.html.replace("{{CONTACT_FORM}}", key === "contact" ? contactForm(site) : "");

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap wrap-narrow">
    <h1>${esc(content.title)}</h1>
    ${content.updated ? `<p class="post-meta"><span>Last updated ${esc(prettyDate(content.updated))}</span></p>` : ""}
    <div class="prose">${html}</div>
    ${extras.after || ""}
  </div>
</section>
${adSlot(site, "")}
<section class="section section--tint">
  <div class="wrap">
    <h2>Keep exploring</h2>
    <div class="grid grid--4">
      ${linkCard({ href: "/find/", title: "Find rentals", text: "Browse by Florida region and town.", more: "Open Find" })}
      ${linkCard({ href: "/partners/", title: "All partners", text: "The full directory listicle.", more: "Open Partners" })}
      ${linkCard({ href: "/reviews/", title: "Reviews", text: "Star breakdowns for rated shops.", more: "Open Reviews" })}
      ${linkCard({ href: "/blog/", title: "Guides", text: "Law, pricing, routes and checklists.", more: "Open Blog" })}
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: content.metaTitle || `${content.title} - ${site.name}`,
    description: clamp(content.description),
    path: url,
    body,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": key === "contact" ? "ContactPage" : "WebPage",
        name: content.title,
        description: content.description,
        url: `${site.url}${url}`,
        dateModified: content.updated || undefined,
        isPartOf: { "@id": `${site.url}/#website` },
        publisher: { "@id": `${site.url}/#organization` },
      },
    ],
  });
}

/* ------------------------------------------------------- HTML sitemap */

export function sitemapPage(site, { index, blog, listings, queries, stats, partnerPages, reviewPages }) {
  const section = (title, links, note) => `<section class="section${
    note === "tint" ? " section--tint" : ""
  }">
  <div class="wrap">
    <h2>${esc(title)}</h2>
    ${linkCloud(links)}
  </div>
</section>`;

  const body = `
${breadcrumbs([HOME_CRUMB, { href: "/sitemap/", label: "Sitemap" }])}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Sitemap</span>
      <h1>Sitemap</h1>
      <p>Every page on Florida Ebike Rentals, grouped by section. The machine-readable version lives at
      <a href="/sitemap.xml">/sitemap.xml</a>.</p>
    </div>
    ${statRow([
      { value: String(stats.total), label: "Partner pages" },
      { value: String(reviewPages), label: "Review pages" },
      { value: String(index.cities.length + index.regions.length + index.topics.length), label: "Find pages" },
      { value: String(blog.length), label: "Guides" },
    ])}
  </div>
</section>

${section("Main pages", [
  ...HEADER_LINKS.map((l) => ({ href: l.href, label: l.label })),
  ...FOOTER_LINKS.filter((l) => !HEADER_LINKS.some((h) => h.href === l.href)).map((l) => ({ href: l.href, label: l.label })),
], "tint")}

${section("Regions", index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}

${section(
  "Find pages by topic",
  index.topics.map((t) => ({ href: t.url, label: t.title, count: t.listings.length })),
  "tint"
)}

${section(
  `Towns (${index.cities.length})`,
  index.cities.map((c) => ({ href: c.url, label: c.name, count: c.listings.length }))
)}

${section("Guides", blog.map((p) => ({ href: p.url, label: p.title })), "tint")}

${section("Popular searches", queries.map((q) => ({ href: q.url, label: q.query })))}

<section class="section section--tint">
  <div class="wrap">
    <h2>Partner listings (${esc(String(listings.length))})</h2>
    <p class="muted">Every business in the directory. Review breakdowns live at
    <a href="/reviews/">/reviews/</a>.</p>
    ${linkCloud(listings.map((l) => ({ href: l.url, label: `${l.name} (${l.city})` })))}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Directory index pages</h2>
    ${linkCloud([
      ...Array.from({ length: partnerPages }, (_, i) => ({
        href: i === 0 ? "/partners/" : `/partners/page/${i + 1}/`,
        label: `Partners page ${i + 1}`,
      })),
      ...Array.from({ length: reviewPages > 0 ? Math.ceil(reviewPages / 60) : 0 }, (_, i) => ({
        href: i === 0 ? "/reviews/" : `/reviews/page/${i + 1}/`,
        label: `Reviews page ${i + 1}`,
      })),
    ])}
  </div>
</section>
${adSlotScript(site, 0)}
`;

  return page(site, {
    title: "Sitemap - Florida Ebike Rentals",
    description:
      "Every page on Florida Ebike Rentals: regions, towns, partner listings, review breakdowns, guides and popular searches.",
    path: "/sitemap/",
    body,
    schema: [breadcrumbSchema(site, [HOME_CRUMB, { href: "/sitemap/", label: "Sitemap" }])],
  });
}

/* ------------------------------------------------------------ 404 page */

export function notFoundPage(site, { index }) {
  const body = `
<section class="section">
  <div class="wrap wrap-narrow text-center">
    <span class="eyebrow">404</span>
    <h1>That page has gone for a ride</h1>
    <p class="muted">The page you asked for does not exist, or it moved when we last refreshed the
    directory. Try one of these instead.</p>
    <p class="mt-2">
      <a class="btn btn--blue" href="/find/">Find rentals by town</a>
      <a class="btn btn--outline" href="/partners/">All partners</a>
      <a class="btn btn--outline" href="/search/">Search the site</a>
    </p>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap">
    <h2>Popular towns</h2>
    ${linkCloud(index.cities.slice(0, 30).map((c) => ({ href: c.url, label: c.name, count: c.listings.length })))}
  </div>
</section>
`;
  return page(site, {
    title: "Page Not Found - Florida Ebike Rentals",
    description: "The page you requested could not be found. Browse Florida e-bike rentals by town, region or search the directory.",
    path: "/404.html",
    body,
    noindex: true,
    schema: [],
  });
}
