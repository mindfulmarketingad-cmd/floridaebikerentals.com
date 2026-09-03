import { esc, attr, prettyDate, isoDate, clamp } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import { linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE } from "../components.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const BLOG_CRUMB = { href: "/blog/", label: "Blog" };

export function blogHub(site, { blog, index }) {
  const categories = [...new Set(blog.map((p) => p.category).filter(Boolean))];
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
    ${linkCloud(categories.map((c) => ({ href: "#" + c.toLowerCase().replace(/[^a-z]+/g, "-"), label: c })))}
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
    <h2>Ready to find a shop?</h2>
    <p class="muted">Start with the region you are visiting.</p>
    ${linkCloud(index.regions.map((r) => ({ href: r.url, label: r.name, count: r.listings.length })))}
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

export function blogPost(site, post, { blog, index }) {
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { href: post.url, label: post.title }];
  const related = blog.filter((p) => p.slug !== post.slug).slice(0, 3);
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
    <div class="post-meta">
      <span>${esc(post.category || "Guide")}</span>
      <span>Published ${esc(prettyDate(post.date))}</span>
      ${post.updated && post.updated !== post.date ? `<span>Updated ${esc(prettyDate(post.updated))}</span>` : ""}
      <span>${esc(String(post.readingTime || 6))} min read</span>
      <span>${esc(String(post.words))} words</span>
    </div>
  </div>
</section>

<article class="post-body">
  <div class="wrap wrap-narrow">
    ${toc}
    <div class="prose">
      ${post.html}
    </div>
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
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
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
        image: `${site.url}/assets/img/og-default.png`,
        author: { "@type": "Organization", name: site.name, url: `${site.url}/about/` },
        publisher: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${site.url}${post.url}` },
        isPartOf: { "@id": `${site.url}/blog/#blog` },
      },
    ],
  });
}
