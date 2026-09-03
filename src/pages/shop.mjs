import { esc, attr, clamp, slugify, plural } from "../util.mjs";
import { page, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
import { linkCard, linkCloud, adSlot, adSlotScript, ADSENSE_INLINE, ctaBand } from "../components.mjs";
import { photoFor, secondPhotoFor, figure, banner } from "../images.mjs";

const HOME_CRUMB = { href: "/", label: "Home" };
const SHOP_CRUMB = { href: "/shop/", label: "Shop" };

/** Only http(s) links leave this file, whatever ends up in products.json. */
function safeUrl(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) && !/["<>\s]/.test(value) ? value : "";
}

function priceOf(product, currency) {
  if (product.price === undefined || product.price === null || product.price === "") return "";
  const number = Number(product.price);
  if (!Number.isFinite(number)) return String(product.price);
  return `${currency === "USD" ? "$" : ""}${number.toLocaleString("en-US", {
    minimumFractionDigits: number % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function productImage(product, { eager = false } = {}) {
  const src = safeUrl(product.image) || (product.image && product.image.startsWith("/") ? product.image : "");
  if (!src) return "";
  return `<img src="${attr(src)}" alt="${attr(product.name)}" loading="${eager ? "eager" : "lazy"}"
    decoding="async" referrerpolicy="no-referrer" width="${attr(product.imageWidth || 800)}"
    height="${attr(product.imageHeight || 800)}" data-fallback="1">`;
}

function buyButton(product, { block = false } = {}) {
  const url = safeUrl(product.url);
  if (!url) return "";
  return `<a class="btn btn--primary${block ? " btn--block" : ""}" href="${attr(url)}"
    rel="nofollow sponsored noopener" target="_blank">${esc(product.cta || "View product")}</a>`;
}

export function productCard(product, currency) {
  const price = priceOf(product, currency);
  return `<article class="product-card">
  <a class="product-card__media" href="${attr(product.url_internal)}">
    ${productImage(product) || '<span class="product-card__placeholder" aria-hidden="true"></span>'}
  </a>
  <div class="product-card__body">
    ${product.brand ? `<span class="product-card__brand">${esc(product.brand)}</span>` : ""}
    <h3><a href="${attr(product.url_internal)}">${esc(product.name)}</a></h3>
    ${product.summary ? `<p>${esc(clamp(product.summary, 120))}</p>` : ""}
    <div class="product-card__foot">
      ${price ? `<span class="product-card__price">${esc(price)}</span>` : ""}
      <a class="card__more" href="${attr(product.url_internal)}">Details</a>
    </div>
  </div>
</article>`;
}

/* --------------------------------------------------------------- hub */

export function shopHub(site, shop, ctx) {
  const crumbs = [HOME_CRUMB, SHOP_CRUMB];
  const hero = photoFor("shop");
  const extra = secondPhotoFor("shop");
  const products = shop.products;
  const empty = products.length === 0;

  const byCategory = shop.categories
    .map((category) => ({
      ...category,
      items: products.filter((p) => slugify(p.category || "") === category.slug),
    }))
    .filter((c) => c.items.length);

  const uncategorised = products.filter(
    (p) => !shop.categories.some((c) => c.slug === slugify(p.category || ""))
  );

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="section__head">
      <span class="eyebrow">Shop</span>
      <h1>E-Bike Gear Worth Owning</h1>
      <p>${
        empty
          ? "Kit we rate for riding in Florida - bikes, helmets, locks, child seats and the accessories that make a long, hot ride comfortable. Products are being added to this section now."
          : `${products.length} ${plural(products.length, "product")} across ${byCategory.length} ${plural(
              byCategory.length,
              "category",
              "categories"
            )}, chosen for riding in Florida heat, sand and salt air.`
      }</p>
    </div>
    ${banner(hero, { alt: `E-bike gear for riding in Florida - ${hero.alt}` })}
  </div>
</section>

${
  empty
    ? `<section class="section section--tint">
  <div class="wrap">
    <h2>What is going in here</h2>
    <p class="muted">The categories below are what this section will cover. In the meantime, the
    guides linked under each one answer the questions people ask before buying.</p>
    <div class="grid grid--3 mt-2">
      ${shop.categories
        .map((c) =>
          linkCard({
            href: c.guide || "/costs/",
            title: c.name,
            text: c.description,
            more: "Read the related guide",
          })
        )
        .join("")}
    </div>
  </div>
</section>`
    : `${byCategory
        .map(
          (category) => `<section class="section section--tint" id="${attr(category.slug)}">
  <div class="wrap">
    <h2>${esc(category.name)}</h2>
    <p class="muted">${esc(category.description)}</p>
    <div class="product-grid mt-2">${category.items.map((p) => productCard(p, shop.currency)).join("")}</div>
  </div>
</section>`
        )
        .join("")}
${
  uncategorised.length
    ? `<section class="section"><div class="wrap"><h2>More gear</h2>
    <div class="product-grid mt-2">${uncategorised.map((p) => productCard(p, shop.currency)).join("")}</div>
  </div></section>`
    : ""
}`
}

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `Riding an electric bike in Florida - ${extra.alt}` })}
      <div>
        <h2>Renting first is usually the right call</h2>
        <p>If you are here for a week, rent. The crossover point where buying beats renting sits at
        roughly six to eight weeks of riding, which is a snowbird season rather than a holiday. Our
        <a href="/costs/daily-vs-weekly-ebike-rental-rates/">rate guide</a> covers the maths.</p>
        <p>Try the style you are thinking of buying before you commit. Renting a step-through for a
        day tells you more than any review, and every shop in the
        <a href="/partners/">partner directory</a> will happily talk you through what they stock.</p>
        <p><a class="btn btn--primary" href="/partners/">Rent Now</a></p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Before you buy, read these</h2>
    ${linkCloud([
      { href: "/costs/", label: "All cost guides" },
      { href: "/costs/daily-vs-weekly-ebike-rental-rates/", label: "Renting vs buying" },
      { href: "/blog/ebike-classes-explained/", label: "E-bike classes explained" },
      { href: "/blog/florida-ebike-laws/", label: "Florida e-bike law" },
      { href: "/find/electric-bike-shops-in-florida/", label: "Florida electric bike shops" },
      { href: "/trails/", label: "Where to ride" },
    ])}
    <p class="small muted mt-2">${esc(shop.affiliateDisclosure)}</p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: empty
      ? "Shop E-Bike Gear for Florida Riding"
      : `Shop E-Bike Gear - ${products.length} Products for Florida Riding`,
    description: clamp(
      empty
        ? "E-bike gear for riding in Florida: bikes, helmets, locks, child seats and accessories, plus whether renting or buying makes more sense for your trip."
        : `${products.length} e-bike products for Florida riding - bikes, helmets, locks, child seats and accessories, with prices and where to buy.`
    ),
    path: "/shop/",
    body,
    ogImage: hero.src,
    // An empty shop is not worth submitting to Google; it indexes itself once
    // the first product is added.
    noindex: empty,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Shop E-Bike Gear",
        url: `${site.url}/shop/`,
        isPartOf: { "@id": `${site.url}/#website` },
      },
      products.length
        ? {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "E-bike gear",
            numberOfItems: products.length,
            itemListElement: products.slice(0, 100).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${site.url}${p.url_internal}`,
              name: p.name,
            })),
          }
        : null,
    ],
  });
}

/* ------------------------------------------------------- product page */

export function productPage(site, product, shop, ctx) {
  const crumbs = [HOME_CRUMB, SHOP_CRUMB, { href: product.url_internal, label: product.name }];
  const price = priceOf(product, shop.currency);
  const hero = photoFor(product.slug);
  const related = shop.products.filter((p) => p.slug !== product.slug).slice(0, 3);
  const specs = Object.entries(product.specs || {});

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="product-detail">
      <div class="product-detail__media">
        ${productImage(product, { eager: true }) || banner(hero, { alt: `${product.name} - ${hero.alt}` })}
      </div>
      <div>
        ${product.brand ? `<span class="eyebrow">${esc(product.brand)}</span>` : ""}
        <h1>${esc(product.name)}</h1>
        ${product.summary ? `<p class="lede muted">${esc(product.summary)}</p>` : ""}
        ${price ? `<p class="product-detail__price">${esc(price)}</p>` : ""}
        <p>${buyButton(product, { block: false })}</p>
        ${
          specs.length
            ? `<dl class="datalist">${specs
                .map(
                  ([k, v]) =>
                    `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`
                )
                .join("")}</dl>`
            : ""
        }
        <p class="small muted">${esc(shop.affiliateDisclosure)}</p>
      </div>
    </div>
  </div>
</section>

${
  product.description
    ? `<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <div class="prose"><h2>About the ${esc(product.name)}</h2><p>${esc(product.description)}</p></div>
    ${figure(secondPhotoFor(product.slug), {
      alt: `Riding in Florida - ${secondPhotoFor(product.slug).alt}`,
      caption: `Illustrative photo of e-bike riding in Florida, not of the ${product.name}.`,
      className: "figure--stock",
    })}
  </div>
</section>`
    : `<section class="section section--tint"><div class="wrap wrap-narrow">${figure(
        secondPhotoFor(product.slug),
        {
          alt: `Riding in Florida - ${secondPhotoFor(product.slug).alt}`,
          caption: `Illustrative photo of e-bike riding in Florida, not of the ${product.name}.`,
          className: "figure--stock",
        }
      )}</div></section>`
}

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    ${ctaBand({
      title: "Try it before you buy it",
      text: "Renting the same style for a day tells you more than any spec sheet. Every rental partner in Florida, sorted by distance from you.",
      buttons: [
        { href: "/partners/", label: "Rent Now", variant: "btn--primary" },
        { href: "/shop/", label: "Back to shop", variant: "btn--ghost" },
      ],
    })}
    ${
      related.length
        ? `<h2 class="mt-3">More gear</h2>
    <div class="product-grid mt-2">${related.map((p) => productCard(p, shop.currency)).join("")}</div>`
        : ""
    }
  </div>
</section>
${adSlotScript(site, 1)}
`;

  const offerUrl = safeUrl(product.url);
  return page(site, {
    title: `${product.name}${product.brand ? ` by ${product.brand}` : ""} - Florida Ebike Rentals`,
    description: clamp(
      product.summary || `${product.name}: specifications, price and where to buy, from Florida Ebike Rentals.`
    ),
    path: product.url_internal,
    body,
    ogType: "product",
    ogImage: safeUrl(product.image) || hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.summary || product.description || undefined,
        brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
        sku: product.sku || undefined,
        image: safeUrl(product.image) || `${site.url}${hero.src}`,
        url: `${site.url}${product.url_internal}`,
        offers:
          product.price !== undefined && product.price !== null && product.price !== "" && offerUrl
            ? {
                "@type": "Offer",
                price: String(product.price),
                priceCurrency: shop.currency || "USD",
                availability: `https://schema.org/${product.availability || "InStock"}`,
                url: offerUrl,
              }
            : undefined,
      },
    ],
  });
}
