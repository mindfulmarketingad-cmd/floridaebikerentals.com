import { createHash } from "node:crypto";
import { esc, attr, jsonLd } from "./util.mjs";

/* --------------------------------------------------------------- config */

export const HEADER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog/", label: "Blog" },
  { href: "/trails/", label: "Trails" },
  { href: "/costs/", label: "Costs" },
  { href: "/about/", label: "About" },
  { href: "/find/", label: "Find" },
  { href: "/partners/", label: "Partners" },
  { href: "/search/", label: "Search", cta: true },
];

export const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
  { href: "/disclaimer/", label: "Disclaimer" },
  { href: "/privacy/", label: "Privacy" },
  { href: "/terms/", label: "Terms" },
  { href: "/sitemap/", label: "Sitemap" },
];

const ADSENSE_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://partner.googleadservices.com",
  "https://tpc.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://www.google.com",
  "https://adservice.google.com",
];

/* ------------------------------------------------------------ security */

function sha256(text) {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

/**
 * Content-Security-Policy is emitted per page with a hash for every inline
 * script we generate, so nothing else on the page is allowed to execute.
 * frame-ancestors is deliberately absent: browsers ignore it in a meta tag,
 * so clickjacking is covered by X-Frame-Options in _headers / vercel.json /
 * .htaccess, alongside HSTS and the other transport-level headers.
 */
function cspMeta(inlineScripts, { ads }) {
  const hashes = inlineScripts.map(sha256);
  const script = ["'self'", ...hashes, ...(ads ? ADSENSE_HOSTS : [])];
  const img = [
    "'self'",
    "data:",
    "https://lh3.googleusercontent.com",
    "https://lh4.googleusercontent.com",
    "https://lh5.googleusercontent.com",
    "https://lh6.googleusercontent.com",
    "https://streetviewpixels-pa.googleapis.com",
    "https://tile.openstreetmap.org",
    ...(ads ? [...ADSENSE_HOSTS, "https://www.googletagmanager.com"] : []),
  ];
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self' mailto:",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self'${ads ? ` ${ADSENSE_HOSTS.join(" ")}` : ""}`,
    `frame-src ${ads ? "https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com" : "'none'"}`,
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  return `<meta http-equiv="Content-Security-Policy" content="${attr(policy)}">`;
}

/* ------------------------------------------------------------- pieces */

function header(current) {
  const items = HEADER_LINKS.map((link) => {
    const active = link.href === current || (link.href !== "/" && current.startsWith(link.href));
    return `<li${link.cta ? ' class="nav-cta"' : ""}><a href="${attr(link.href)}"${
      active ? ' aria-current="page"' : ""
    }>${esc(link.label)}</a></li>`;
  }).join("");

  return `<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="brand" href="/" aria-label="Florida Ebike Rentals home">
      <img src="/assets/img/logo.svg" width="190" height="40" alt="Florida Ebike Rentals" fetchpriority="high">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="nav-toggle__bars" aria-hidden="true"></span> Menu
    </button>
    <nav class="main-nav" id="site-nav" aria-label="Primary">
      <ul>${items}</ul>
    </nav>
  </div>
</header>`;
}

function footer(site, extras) {
  const columns = (extras || [])
    .map(
      (col) => `<div>
      <h3>${esc(col.title)}</h3>
      <ul>${col.links.map((l) => `<li><a href="${attr(l.href)}">${esc(l.label)}</a></li>`).join("")}</ul>
    </div>`
    )
    .join("");

  const bar = FOOTER_LINKS.map((l) => `<li><a href="${attr(l.href)}">${esc(l.label)}</a></li>`).join("");
  const year = new Date().getUTCFullYear();

  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="/assets/img/logo-white.svg" width="200" height="42" alt="${attr(site.name)}" loading="lazy">
        <p>${esc(site.description)}</p>
        <p class="small"><a href="/contact/">Own one of these shops? Update or claim your listing.</a></p>
        <p class="small"><a href="/authors/">Meet the people who write this site</a></p>
      </div>
      ${columns}
    </div>
    <nav class="footer-nav" aria-label="Footer">
      <ul>${bar}</ul>
    </nav>
    <div class="legal">
      <p>&copy; ${year} ${esc(site.name)}. All rights reserved.</p>
      <p>${esc(site.name)} is an independent directory. We are not affiliated with, and do not take
      bookings on behalf of, the businesses listed. Always confirm prices, hours and availability directly
      with the rental shop.</p>
      <p>Business details, ratings and review counts are sourced from public Google Maps data and are
      refreshed periodically. Report an error on our <a href="/contact/">contact page</a>.</p>
    </div>
  </div>
</footer>`;
}

function adsenseLoader(site) {
  if (!site.adsense?.enabled || !site.adsense.publisherId) return "";
  const client = `ca-${site.adsense.publisherId}`;
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${attr(
    client
  )}" crossorigin="anonymous"></script>`;
}

/* ---------------------------------------------------------------- page */

/**
 * Renders a complete document.
 *
 * @param {object} opts
 *  - title, description, path (always with trailing slash), body
 *  - schema:   array of JSON-LD objects
 *  - noindex:  boolean
 *  - ogImage:  absolute or root-relative image
 *  - bodyAttrs, headExtra, footerColumns, inlineScripts
 */
export function page(site, opts) {
  const {
    title,
    description,
    path,
    body,
    schema = [],
    noindex = false,
    ogImage = "/assets/img/og-default.png",
    ogType = "website",
    bodyAttrs = "",
    headExtra = "",
    footerColumns = [],
    inlineScripts = [],
    prev = "",
    next = "",
  } = opts;

  const canonical = `${site.url}${path}`;
  const image = ogImage.startsWith("http") ? ogImage : `${site.url}${ogImage}`;
  const ads = Boolean(site.adsense?.enabled);
  const schemaTags = schema.filter(Boolean).map((s) => jsonLd(s));
  const schemaSources = schema.filter(Boolean).map((s) =>
    JSON.stringify(s, null, 0).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
  );
  const allInline = [...schemaSources, ...inlineScripts];

  return `<!doctype html>
<html lang="${attr(site.language)}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cspMeta(allInline, { ads })}
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'}
${prev ? `<link rel="prev" href="${attr(site.url + prev)}">` : ""}
${next ? `<link rel="next" href="${attr(site.url + next)}">` : ""}
<meta property="og:site_name" content="${attr(site.name)}">
<meta property="og:type" content="${attr(ogType)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${attr(site.locale)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${attr(image)}">
<meta name="theme-color" content="#2050c8">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://lh3.googleusercontent.com" crossorigin>
<link rel="stylesheet" href="/assets/css/main.css">
${headExtra}
${schemaTags.join("\n")}
${adsenseLoader(site)}
</head>
<body${bodyAttrs ? ` ${bodyAttrs}` : ""} data-index="/data/listings.json">
<a class="skip-link" href="#main">Skip to content</a>
${header(path)}
<main id="main">
${body}
</main>
${footer(site, footerColumns)}
<script src="/assets/js/app.js" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------- schema */

export function breadcrumbSchema(site, trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `${site.url}${item.href}`,
    })),
  };
}

export function breadcrumbs(trail) {
  const items = trail
    .map((item, i) =>
      i === trail.length - 1
        ? `<li aria-current="page">${esc(item.label)}</li>`
        : `<li><a href="${attr(item.href)}">${esc(item.label)}</a></li>`
    )
    .join("");
  return `<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap"><ol>${items}</ol></div></nav>`;
}

export function breadcrumbsBare(trail) {
  const items = trail
    .map((item, i) =>
      i === trail.length - 1
        ? `<li aria-current="page">${esc(item.label)}</li>`
        : `<li><a href="${attr(item.href)}">${esc(item.label)}</a></li>`
    )
    .join("");
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}
