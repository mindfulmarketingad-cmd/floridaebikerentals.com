import { createHash } from "node:crypto";
import { esc, attr, jsonLd, titleCase, titleCaseHtml } from "./util.mjs";

/* --------------------------------------------------------------- config */

export const HEADER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog/", label: "Blog" },
  { href: "/trails/", label: "Trails" },
  { href: "/costs/", label: "Costs" },
  { href: "/shop/", label: "Shop" },
  { href: "/about/", label: "About" },
  { href: "/find/", label: "Find" },
  { href: "/partners/", label: "Partners" },
  { href: "/reviews/", label: "Reviews" },
  { href: "/search/", label: "Search", cta: true },
];

export const SOCIAL_LINKS = [
  {
    href: "#",
    label: "Instagram",
    icon: `<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm4.75-3.25a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Z"/>`,
  },
  {
    href: "#",
    label: "Twitter",
    icon: `<path d="M20.5 6.2c-.6.27-1.25.45-1.93.53a3.4 3.4 0 0 0 1.48-1.87 6.8 6.8 0 0 1-2.14.82 3.37 3.37 0 0 0-5.74 3.07A9.55 9.55 0 0 1 5.1 5.6a3.36 3.36 0 0 0 1.04 4.5c-.55-.02-1.07-.17-1.52-.42v.04a3.37 3.37 0 0 0 2.7 3.3 3.4 3.4 0 0 1-1.52.06 3.37 3.37 0 0 0 3.15 2.34A6.77 6.77 0 0 1 3.9 16.9a9.53 9.53 0 0 0 5.17 1.52c6.2 0 9.6-5.14 9.6-9.6l-.01-.44A6.9 6.9 0 0 0 20.5 6.2Z"/>`,
  },
  {
    href: "#",
    label: "Facebook",
    icon: `<path d="M13.5 21v-7.7h2.6l.4-3h-3v-1.9c0-.87.24-1.46 1.49-1.46h1.6V4.14C16.3 4.1 15.32 4 14.2 4c-2.34 0-3.95 1.43-3.95 4.04v2.25H7.6v3h2.65V21h3.25Z"/>`,
  },
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
const EMBED_HOSTS = {
  ridewithgps: "https://ridewithgps.com",
};

function cspMeta(inlineScripts, { ads, embeds = [] }) {
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
    `frame-src ${
      [
        ...(ads
          ? ["https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com", "https://www.google.com"]
          : []),
        ...embeds.map((name) => EMBED_HOSTS[name]).filter(Boolean),
      ].join(" ") || "'none'"
    }`,
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
  const social = SOCIAL_LINKS.map(
    (l) => `<a class="social-link" href="${attr(l.href)}" aria-label="${attr(l.label)}" rel="noopener">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${l.icon}</svg>
    </a>`
  ).join("");
  const year = new Date().getUTCFullYear();

  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="/assets/img/logo-white.svg" width="200" height="42" alt="${attr(site.name)}" loading="lazy">
        <p>${esc(site.description)}</p>
        <p class="small"><a href="/contact/">Own one of these shops? Update or claim your listing.</a></p>
        <p class="small"><a href="/authors/">Meet the people who write this site</a></p>
        <div class="social-links" aria-label="Follow us on social media">${social}</div>
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

/**
 * "What do you need to rent?" popup: e-bike, e-scooter or e-skateboard,
 * each routed to the nearest matching rentals once the visitor allows
 * their location (the client script in app.js drives this - see
 * data-rent-picker there). Native <dialog> so it always renders above
 * everything else on the page with no z-index bookkeeping of our own.
 */
function rentPicker() {
  const BIKE = `<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>`;
  const SCOOTER = `<circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 19h6l6-14h2"/><path d="M15 5h3"/>`;
  const SKATEBOARD = `<rect x="2" y="9" width="20" height="3" rx="1.5"/><circle cx="6" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/><circle cx="14" cy="16" r="1.6"/><circle cx="18" cy="16" r="1.6"/>`;
  const icon = (paths) =>
    `<svg class="rentpicker__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  return `<dialog class="rentpicker" data-rent-picker aria-labelledby="rentpicker-title">
  <button class="rentpicker__close" type="button" data-rent-picker-close aria-label="Close">&times;</button>
  <h2 id="rentpicker-title" class="rentpicker__title">What do you need to rent?</h2>
  <p class="rentpicker__status" data-rent-picker-status>We'll point you to the nearest rentals once you pick one.</p>
  <div class="rentpicker__options">
    <button class="rentpicker__option" type="button" data-rent-type="ebike">${icon(BIKE)}<span>E-Bike</span></button>
    <button class="rentpicker__option" type="button" data-rent-type="escooter">${icon(SCOOTER)}<span>E-Scooter</span></button>
    <button class="rentpicker__option" type="button" data-rent-type="eskateboard">${icon(SKATEBOARD)}<span>E-Skateboard</span></button>
  </div>
</dialog>`;
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
/** Title-cases the text of every H1 and H2 in a rendered body. */
function titleCaseHeadings(html) {
  return String(html).replace(
    /(<h([12])(?:\s[^>]*)?>)([\s\S]*?)(<\/h\2>)/gi,
    (_, open, level, inner, close) => open + titleCaseHtml(inner) + close
  );
}

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
    embeds = [],
  } = opts;

  // Title Case is applied here rather than at each of the several hundred call
  // sites, so every H1, H2 and page title on the site is consistent and future
  // content — including headings rendered from Markdown — is caught too.
  const pageTitle = titleCase(title);
  const pageBody = titleCaseHeadings(body);

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
${cspMeta(allInline, { ads, embeds })}
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'}
${prev ? `<link rel="prev" href="${attr(site.url + prev)}">` : ""}
${next ? `<link rel="next" href="${attr(site.url + next)}">` : ""}
<meta property="og:site_name" content="${attr(site.name)}">
<meta property="og:type" content="${attr(ogType)}">
<meta property="og:title" content="${attr(pageTitle)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${attr(site.locale)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(pageTitle)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${attr(image)}">
<meta name="theme-color" content="#2050c8">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://lh3.googleusercontent.com" crossorigin>
${embeds.includes("ridewithgps") ? '<link rel="preconnect" href="https://ridewithgps.com">' : ""}
<link rel="stylesheet" href="/assets/css/main.css">
${headExtra}
${schemaTags.join("\n")}
${adsenseLoader(site)}
</head>
<body${bodyAttrs ? ` ${bodyAttrs}` : ""} data-index="/data/listings.json">
<a class="skip-link" href="#main">Skip to content</a>
${header(path)}
<main id="main">
${pageBody}
</main>
${footer(site, footerColumns)}
${rentPicker()}
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

/**
 * The banded page header used across the hub and directory pages: breadcrumbs,
 * eyebrow, heading and lede on a colour band ending in the same curve as the
 * home and listing heroes.
 *
 * `eyebrow`, `h1` and `lede` are already-built HTML — the call sites escape
 * their own interpolations — so they are inserted raw rather than escaped
 * again here.
 */
export function pageHero({ crumbs, eyebrow = "", h1, lede = "" }) {
  return `<section class="page-hero">
  <div class="wrap">
    ${crumbs && crumbs.length ? breadcrumbsBare(crumbs) : ""}
    ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}
    <h1>${h1}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ""}
  </div>
</section>`;
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
