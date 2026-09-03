import { esc, attr, prettyDate, isoDate, clamp } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import { linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, faqBlock, faqSchema, ctaBand } from "../components.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";
import { byline, authorCard } from "./hub.mjs";
import { expandShortcodes } from "../shortcodes.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const BLOG_CRUMB = { href: "/blog/", label: "Blog" };

export function blogHub(site, ctx) {
  const { blog, index } = ctx;
  const categories = [...new Set(blog.map((p) => p.category).filter(Boolean))];
  const hero = photoFor("blog");
  const extra = secondPhotoFor("blog");
  const body = `
${breadcrumbs([HOME_CRUMB, BLOG_CRUMB])}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Blog</span>
      <h1>Florida E-Bike Rental Guides</h1>
      <p>Practical guides for renting and riding an e-bike in Florida — the law, the pricing, the
      routes worth renting for, and what to check before you sign the rental agreement.</p>
    </div>
    ${banner(hero, { alt: `Florida e-bike rental guides - ${hero.alt}` })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="grid grid--3">
      ${blog
        .map((post) =>
          linkCard({
            href: post.url,
            title: post.title,
            meta: `${post.category} · ${prettyDate(post.date)} · ${post.readingTime || 6} min read`,
            text: post.description,
            more: "Read the guide",
          })
        )
        .join("")}
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `Riding in Florida - ${extra.alt}` })}
      <div>
        <h2>Ready to find a shop?</h2>
        <p class="muted">Start with the region you are visiting, or jump straight to the full partner
        directory sorted by distance from you.</p>
        ${linkCloud(index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}
        <p class="mt-2"><a class="btn btn--primary" href="/partners/">Rent Now</a></p>
      </div>
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: "Florida E-Bike Rental Guides - Laws, Prices, Routes and Tips",
    description:
      "Guides to renting an e-bike in Florida: state e-bike law, realistic rental prices, the best rides, family riding with children, and a pre-rental checklist.",
    path: "/blog/",
    body,
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, [HOME_CRUMB, BLOG_CRUMB]),
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": `${site.url}/blog/#blog`,
        url: `${site.url}/blog/`,
        name: "Florida E-Bike Rental Guides",
        description: "Guides to renting and riding electric bikes in Florida.",
        publisher: { "@id": `${site.url}/#organization` },
        blogPost: blog.map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: `${site.url}${post.url}`,
          datePublished: isoDate(post.date),
          dateModified: isoDate(post.updated || post.date),
        })),
      },
    ],
  });
}

export function blogPost(site, post, ctx) {
  const { blog, index } = ctx;
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { href: post.url, label: post.title }];
  const author = ctx.authorsBySlug.get(post.author);
  const hero = photoFor(post.slug);
  const extra = secondPhotoFor(post.slug);
  const html = expandShortcodes(post.html, ctx, post.slug);
  const related = blog
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => (a.category === post.category ? -1 : 0) - (b.category === post.category ? -1 : 0))
    .slice(0, 3);
  const toc = post.headings.length > 3
    ? `<nav class="toc" aria-label="On this page">
    <h2>On this page</h2>
    <ol>${post.headings.map((h) => `<li><a href="#${attr(h.id)}">${esc(h.text)}</a></li>`).join("")}</ol>
  </nav>`
    : "";

  const body = `
<section class="post-head">
  <div class="wrap wrap-narrow">
    ${breadcrumbs(crumbs).replace('<div class="wrap">', "<div>")}
    <h1>${esc(post.title)}</h1>
    <p class="lede muted">${esc(post.description)}</p>
    ${
      author
        ? byline(author, { date: post.date, updated: post.updated, readingTime: post.readingTime, words: post.words })
        : `<div class="post-meta">
      <span>${esc(post.category || "Guide")}</span>
      <span>Published ${esc(prettyDate(post.date))}</span>
      ${post.updated && post.updated !== post.date ? `<span>Updated ${esc(prettyDate(post.updated))}</span>` : ""}
      <span>${esc(String(post.readingTime || 6))} min read</span>
    </div>`
    }
  </div>
</section>

<article class="post-body">
  <div class="wrap wrap-narrow">
    ${banner(hero, { alt: `${post.title} - ${hero.alt}` })}
    ${toc}
    <div class="prose">
      ${html}
    </div>
    ${html.includes(extra.src) ? "" : figure(extra, { alt: `${post.title} - ${extra.alt}`, className: "mt-3" })}
    ${post.faqs.length ? `<h2 class="mt-3">Frequently asked questions</h2>${faqBlock(post.faqs)}` : ""}
    ${authorCard(author)}
    ${ctaBand({
      title: "Ready to ride?",
      text: "Every rental partner in the directory, with hours, ratings and phone numbers, sorted by how close they are to you.",
      buttons: [
        { href: "/partners/", label: "Rent Now", variant: "btn--primary" },
        { href: "/find/", label: "Browse by town", variant: "btn--ghost" },
      ],
    })}
  </div>
</article>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <h2>Find a rental shop</h2>
    <p class="muted">Browse the directory by Florida region.</p>
    ${linkCloud(index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}
    <h3 class="mt-3">More guides</h3>
    <div class="grid grid--3 mt-2">
      ${related
        .map((p) => linkCard({ href: p.url, title: p.title, meta: p.category, text: p.description, more: "Read the guide" }))
        .join("")}
    </div>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: post.metaTitle || post.title,
    description: clamp(post.description),
    path: post.url,
    body,
    ogType: "article",
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      post.faqs.length ? faqSchema(post.faqs) : null,
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${site.url}${post.url}#article`,
        headline: post.title,
        description: post.description,
        url: `${site.url}${post.url}`,
        datePublished: isoDate(post.date),
        dateModified: isoDate(post.updated || post.date),
        inLanguage: "en-US",
        wordCount: post.words,
        articleSection: post.category,
        keywords: (post.tags || []).join(", "),
        image: `${site.url}${hero.src}`,
        author: author
          ? { "@type": "Person", name: author.name, url: `${site.url}${author.url}`, jobTitle: author.role }
          : { "@type": "Organization", name: site.name, url: `${site.url}/about/` },
        publisher: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${site.url}${post.url}` },
        isPartOf: { "@id": `${site.url}/blog/#blog` },
      },
    ],
  });
}
