import { esc, attr, clamp, slugify, plural } from "../util.mjs";
import { page, pageHero, breadcrumbs, breadcrumbSchema } from "../layout.mjs";
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

/** The product photo's source: an allowed external URL, or a site-relative path. */
function imageSrc(product) {
  return safeUrl(product.image) || (product.image && product.image.startsWith("/") ? product.image : "");
}

function productImage(product, { eager = false } = {}) {
  const src = imageSrc(product);
  if (!src) return "";
  const alt = `${product.brand && !product.name.includes(product.brand) ? `${product.brand} ` : ""}${
    product.name
  }${
    /bike|scooter|skateboard/.test(product.name.toLowerCase()) ? "" : " electric bike"
  }`;
  return `<img src="${attr(src)}" alt="${attr(alt)}" loading="${eager ? "eager" : "lazy"}"
    decoding="async" referrerpolicy="no-referrer" width="${attr(product.imageWidth || 800)}"
    height="${attr(product.imageHeight || 800)}" data-fallback="1">`;
}

function buyButton(product, { block = false } = {}) {
  const url = safeUrl(product.url);
  if (!url) return "";
  return `<a class="btn btn--primary${block ? " btn--block" : ""}" href="${attr(url)}"
    rel="nofollow sponsored noopener" target="_blank">${esc(product.cta || "View product")}</a>`;
}


/**
 * The trust row shown on every product page: stock state, dealer status and the
 * local delivery offer. The last two come from data/products.json so the wording
 * is edited in one place rather than per product.
 */
function productAssurances(product, shop) {
  const inStock = (product.availability || "InStock") === "InStock";
  return `<ul class="assurances">
  <li class="assurances__stock${inStock ? "" : " is-out"}">${inStock ? "In stock" : "Out of stock"}</li>
  ${shop.dealer ? `<li class="assurances__dealer">${esc(shop.dealer)}</li>` : ""}
  ${shop.delivery ? `<li class="assurances__delivery">${esc(shop.delivery)}</li>` : ""}
</ul>`;
}

/** Sale price with the previous price struck through, when there is one. */
function priceBlock(product, currency, { className = "product-detail__price" } = {}) {
  const price = priceOf(product, currency);
  if (!price) return "";
  const was = priceOf({ price: product.compareAtPrice }, currency);
  const saving =
    Number.isFinite(Number(product.compareAtPrice)) && Number.isFinite(Number(product.price))
      ? Number(product.compareAtPrice) - Number(product.price)
      : 0;
  return `<p class="${attr(className)}">
    <span class="price-now">${esc(price)}</span>
    ${was ? `<s class="price-was">${esc(was)}</s>` : ""}
    ${saving > 0 ? `<span class="price-save">Save ${esc(priceOf({ price: saving }, currency))}</span>` : ""}
  </p>`;
}

/** Available sizes or finishes, listed rather than sold: there is no cart here. */
function variantList(product) {
  const variants = Array.isArray(product.variants) ? product.variants.filter(Boolean) : [];
  if (!variants.length) return "";
  return `<div class="variants">
  <h2 class="variants__label">${esc(product.variantLabel || "Available sizes")}</h2>
  <ul class="variants__list">${variants.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
</div>`;
}

/**
 * A product tile. Always links to our own detail page, never straight out to
 * the retailer - the outbound "Check Price" link lives there instead. An
 * affiliate item shows no price on the tile: affiliate programme terms only
 * permit displaying prices pulled live from the retailer's product API, and a
 * stale price is worse than none.
 */
export function productCard(product, currency) {
  const href = product.url_internal;
  if (!href) return "";

  return `<article class="product-card${product.affiliate ? " product-card--out" : ""}">
  ${product.badge ? `<span class="product-card__badge">${esc(product.badge)}</span>` : ""}
  <a class="product-card__media" href="${attr(href)}" tabindex="-1" aria-hidden="true">
    ${productImage(product) || '<span class="product-card__placeholder" aria-hidden="true"></span>'}
  </a>
  <div class="product-card__body">
    ${product.brand ? `<span class="product-card__brand">${esc(product.brand)}</span>` : ""}
    <h3><a href="${attr(href)}">${esc(product.name)}</a></h3>
    ${product.summary ? `<p>${esc(clamp(product.summary, 130))}</p>` : ""}
    <div class="product-card__foot">
      ${product.affiliate ? "" : priceBlock(product, currency, { className: "product-card__price" })}
      <a class="btn btn--primary btn--sm btn--block" href="${attr(href)}">View Details</a>
    </div>
  </div>
</article>`;
}


/** One shop category block: name, description and what is currently in it. */
function categoryBlock(category, items) {
  return `<article class="shop-cat">
  <div class="shop-cat__body">
    <h3><a href="${attr(category.url)}">${esc(category.name)}</a></h3>
    <p>${esc(category.description)}</p>
    <p class="shop-cat__meta">${
      items.length
        ? `${items.length} ${plural(items.length, "product")}`
        : "Products landing soon"
    }</p>
    <a class="card__more" href="${attr(category.url)}">Browse ${esc(category.name)}</a>
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

  const withItems = shop.categories.map((category) => ({
    ...category,
    items: products.filter((p) => slugify(p.category || "") === category.slug),
  }));
  const byCategory = withItems.filter((c) => c.items.length);

  const uncategorised = products.filter(
    (p) => !shop.categories.some((c) => c.slug === slugify(p.category || ""))
  );

  const body = `
${pageHero({
  crumbs: crumbs,
  eyebrow: `Shop`,
  h1: `E-Bike Gear Worth Owning`,
  lede: `${
        empty
          ? "Kit we rate for riding in Florida - bikes, helmets, locks, child seats and the accessories that make a long, hot ride comfortable. Products are being added to this section now."
          : `${products.length} ${plural(products.length, "product")} across ${byCategory.length} ${plural(
              byCategory.length,
              "category",
              "categories"
            )}, chosen for riding in Florida heat, sand and salt air.`
      }`,
})}
<section class="section">
  <div class="wrap">
    ${banner(hero, { alt: `E-bike gear for riding in Florida - ${hero.alt}` })}
  </div>
</section>

<section class="section section--tint" id="categories">
  <div class="wrap">
    <h2>Shop by category</h2>
    <p class="muted">Three categories, each with its own page: what to buy, what it costs and how
    Florida's rules treat it.</p>
    <div class="shop-cats mt-2">${withItems.map((c) => categoryBlock(c, c.items)).join("")}</div>
  </div>
</section>

${
  empty
    ? ""
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
    ${linkCloud(
      [
        { href: "/costs/", label: "All cost guides" },
        { href: "/costs/daily-vs-weekly-ebike-rental-rates/", label: "Renting vs buying" },
        { href: "/blog/ebike-classes-explained/", label: "E-bike classes explained" },
        { href: "/blog/florida-ebike-laws/", label: "Florida e-bike law" },
        { href: "/find/electric-bike-shops-in-florida/", label: "Florida electric bike shops" },
        { href: "/trails/", label: "Where to ride" },
      ].sort((a, b) => a.label.localeCompare(b.label, "en"))
    )}
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
  const category = shop.categories.find((c) => c.slug === product.categorySlug);
  const crumbs = [
    HOME_CRUMB,
    SHOP_CRUMB,
    ...(category ? [{ href: category.url, label: category.name }] : []),
    { href: product.url_internal, label: product.name },
  ];
  const hero = photoFor(product.slug);
  const sameCategory = shop.products.filter(
    (p) => p.slug !== product.slug && p.category === product.category
  );
  const related = (sameCategory.length >= 3
    ? sameCategory
    : shop.products.filter((p) => p.slug !== product.slug)
  ).slice(0, 3);
  const specs = Object.entries(product.specs || {});
  const bullets = Array.isArray(product.bullets) ? product.bullets.filter(Boolean).slice(0, 5) : [];

  const body = `
${breadcrumbs(crumbs)}
<section class="section" style="padding-top:1.2rem">
  <div class="wrap">
    <div class="product-detail">
      <div class="product-detail__media">
        ${
          productImage(product, { eager: true }) ||
          figure(hero, {
            alt: `Riding an electric bike in Florida - ${hero.alt}`,
            caption: `Illustrative photo of e-bike riding in Florida. We do not have a photograph of the ${product.name} yet.`,
            className: "figure--stock",
          })
        }
      </div>
      <div>
        ${product.brand ? `<span class="eyebrow">${esc(product.brand)}</span>` : ""}
        <h1>${esc(product.name)}</h1>
        ${product.summary ? `<p class="lede muted">${esc(product.summary)}</p>` : ""}
        ${priceBlock(product, shop.currency)}
        ${
          bullets.length
            ? `<ul class="product-detail__bullets">${bullets
                .map((b) => `<li>${esc(b)}</li>`)
                .join("")}</ul>`
            : ""
        }
        ${productAssurances(product, shop)}
        ${variantList(product)}
        <p>${
          buyButton(product, { block: false }) ||
          `<a class="btn btn--primary" href="/contact/">${esc(product.cta || "Check availability")}</a>`
        }</p>
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
    title: `${product.name}${
      product.brand && !product.name.includes(product.brand) ? ` by ${product.brand}` : ""
    } - Florida Ebike Rentals`,
    description: clamp(
      product.summary || `${product.name}: specifications, price and where to buy, from Florida Ebike Rentals.`
    ),
    path: product.url_internal,
    body,
    ogType: "product",
    ogImage: imageSrc(product) || hero.src,
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
        image: safeUrl(product.image) || `${site.url}${imageSrc(product) || hero.src}`,
        url: `${site.url}${product.url_internal}`,
        offers:
          product.price !== undefined && product.price !== null && product.price !== ""
            ? {
                "@type": "Offer",
                price: String(product.price),
                priceCurrency: shop.currency || "USD",
                availability: `https://schema.org/${product.availability || "InStock"}`,
                url: offerUrl || `${site.url}${product.url_internal}`,
              }
            : undefined,
      },
    ],
  });
}

/* ---------------------------------------------------------- category */

/**
 * A shop category landing page: /shop/<category-slug>/. Renders the category's
 * products, or, while the category is still being stocked, the guides that
 * answer the questions people ask before buying.
 */
export function shopCategoryPage(site, category, shop, ctx) {
  const items = shop.products.filter((p) => slugify(p.category || "") === category.slug);
  const crumbs = [HOME_CRUMB, SHOP_CRUMB, { href: category.url, label: category.name }];
  const hero = photoFor(`shop-${category.slug}`);
  const extra = secondPhotoFor(`shop-${category.slug}`);
  const others = shop.categories.filter((c) => c.slug !== category.slug);

  const body = `
${pageHero({
  crumbs: crumbs,
  eyebrow: `Shop`,
  h1: `Shop ${esc(category.name)} in Florida`,
  lede: `${esc(category.description)}`,
})}
<section class="section">
  <div class="wrap">
    ${
      // A results page leads with the products. The library photo only stands in
      // while a category has nothing in it yet.
      items.length
        ? ""
        : figure(hero, {
            alt: `Riding in Florida - ${hero.alt}`,
            caption: `Illustrative photo of riding in Florida, not of a product sold in ${category.name}.`,
            className: "figure--stock",
          })
    }
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    ${
      items.length
        ? `<div class="results-head">
             <h2>${items.length} ${esc(plural(items.length, "result"))} in ${esc(category.name)}</h2>
             <p class="results-head__note">Sponsored links. We earn a commission on qualifying
             purchases at no extra cost to you.</p>
           </div>
           <div class="product-grid mt-2">${items.map((p) => productCard(p, shop.currency)).join("")}</div>`
        : `<h2>Products are being added</h2>
           <p class="muted">Nothing is listed in ${esc(category.name)} yet — we would rather show
           nothing than pad the page out with kit we have not ridden. In the meantime the guides
           below cover what people ask before buying, and every shop in the
           <a href="/partners/">partner directory</a> will let you try the style first.</p>
           <p class="mt-2"><a class="btn btn--primary" href="${attr(category.guide || "/blog/")}">Read the ${esc(
             category.name
           )} guide</a>
           <a class="btn btn--outline" href="/partners/">Rent one first</a></p>`
    }
  </div>
</section>

${adSlot(site, "")}

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(extra, { alt: `Riding in Florida - ${extra.alt}` })}
      <div>
        <h2>Before you buy ${esc(category.name)}</h2>
        <p>Florida sets the rules for electric bikes at state level and leaves shared-use paths to
        local authorities, so what you are allowed to ride on a given trail depends on where you
        are. Our <a href="/blog/florida-ebike-laws/">Florida e-bike law guide</a> and
        <a href="/blog/ebike-classes-explained/">classes explained</a> cover both.</p>
        <p>Salt air, sand and summer heat are harder on gear here than almost anywhere else. Rinse
        everything after a beach ride, and treat any range figure on a spec sheet as an optimistic
        number once you add heat and headwind.</p>
        <p><a class="btn btn--primary" href="/partners/">Rent Now</a></p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Other categories</h2>
    <div class="shop-cats mt-2">${others
      .map((c) => categoryBlock(c, shop.products.filter((p) => slugify(p.category || "") === c.slug)))
      .join("")}</div>
    <p class="small muted mt-2">${esc(shop.affiliateDisclosure)}</p>
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: `Shop ${category.name} in Florida`,
    description: clamp(category.description),
    path: category.url,
    body,
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [
      breadcrumbSchema(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: category.name,
        url: `${site.url}${category.url}`,
        description: category.description,
        isPartOf: { "@id": `${site.url}/#website` },
      },
    ],
  });
}
