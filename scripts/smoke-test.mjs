import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const DIST="/home/user/floridaebikerentals.com/dist";
const TYPES={".html":"text/html",".css":"text/css",".js":"text/javascript",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".xml":"application/xml",".txt":"text/plain",".webmanifest":"application/manifest+json"};
const server=createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]);let f=join(DIST,p);if(existsSync(f)&&statSync(f).isDirectory())f=join(f,"index.html");if(!existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{"Content-Type":TYPES[extname(f)]||"application/octet-stream"});r.end(readFileSync(f));});
await new Promise(r=>server.listen(8099,r));
const b=await chromium.launch();
const ok=(n,c)=>console.log((c?"PASS":"FAIL")+" - "+n);

// 1. site search
let page=await b.newPage();
await page.goto("http://localhost:8099/search/");
await page.fill("input[name=q]","key west");
await page.click("button[type=submit]");
await page.waitForTimeout(900);
const results=await page.$$eval("[data-search-results] a.card",a=>a.length);
const summary=await page.textContent("[data-search-summary]");
ok(`search returns results (${results}) — "${summary.trim().slice(0,60)}"`, results>3);
await page.close();

// 2. filter bar on a city page
page=await b.newPage();
await page.goto("http://localhost:8099/find/ebike-rentals-in-key-west/");
await page.waitForTimeout(400);
const before=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
await page.fill("[data-filter-form] input[name=q]","eaton");
await page.waitForTimeout(300);
const after=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
const count=await page.textContent("[data-filter-count]");
ok(`filter narrows list ${before} -> ${after} (${count.trim()})`, after>0 && after<before);
await page.close();

// 3. map pin popup
page=await b.newPage();
await page.goto("http://localhost:8099/find/ebike-rentals-in-key-west/");
await page.click("[data-map-toggle]");
await page.waitForTimeout(800);
const pins=await page.$$(".map__pin");
await pins[0].click();
await page.waitForTimeout(300);
const popup=await page.$(".map__popup");
const popupText=popup?await popup.textContent():"";
ok(`map pin opens popup (${pins.length} pins) — ${popupText.trim().slice(0,40)}`, !!popup);
await page.close();

// 4. geolocation is requested automatically on landing, no click needed
const ctx=await b.newContext({permissions:["geolocation"],geolocation:{latitude:24.5551,longitude:-81.78},viewport:{width:1200,height:900}});
page=await ctx.newPage();
await page.goto("http://localhost:8099/",{waitUntil:"load"});
await page.waitForTimeout(1800);
const label=await page.textContent("[data-near-label]");
const first=await page.textContent(".carousel__track .slide .slide__name");
const badge=await page.textContent(".carousel__track .slide .slide__badge");
ok(`homepage auto-locates: "${label.trim()}" -> ${first.trim()} (${badge.trim()})`, /Closest/.test(label)&&/mi away/.test(badge));
await page.close(); await ctx.close();

// 4b. declining location still leaves a usable carousel
const denied=await b.newContext({permissions:[],viewport:{width:1200,height:900}});
page=await denied.newPage();
await page.goto("http://localhost:8099/",{waitUntil:"load"});
await page.waitForTimeout(1500);
const fallbackSlides=await page.$$eval(".carousel__track .slide",n=>n.length);
ok(`declined location falls back to ${fallbackSlides} featured slides`, fallbackSlides>0);
await page.close(); await denied.close();

// 4c. hero images keep one height whatever the source photo's aspect ratio is
page=await b.newPage({viewport:{width:1280,height:900}});
await page.goto("http://localhost:8099/",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(400);
const svg=(w,h)=>"data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#204080"/></svg>`);
const heights=await page.evaluate(([tall,wide])=>{
  document.querySelectorAll(".carousel__track .slide__media").forEach((box,i)=>{
    box.querySelectorAll("img").forEach((n)=>n.remove());
    const im=document.createElement("img");
    im.src=i%2?tall:wide; im.alt="";
    box.appendChild(im);
  });
  return new Promise(res=>setTimeout(()=>res([...new Set([...document.querySelectorAll(".carousel__track .slide__media")]
    .map(m=>Math.round(m.getBoundingClientRect().height)))]),500));
},[svg(600,900),svg(1600,600)]);
ok(`hero images share one height (${heights.join(", ")}px) across aspect ratios`, heights.length===1);
await page.close();

// 4d. the partners page re-sorts itself to the visitor's location
const near=await b.newContext({permissions:["geolocation"],geolocation:{latitude:30.3671,longitude:-86.2216},viewport:{width:1200,height:900}});
page=await near.newPage();
await page.goto("http://localhost:8099/partners/",{waitUntil:"load"});
await page.waitForTimeout(2000);
const status=await page.textContent("[data-nearby-status]");
const firstCard=await page.$eval("[data-filter-item]",e=>({name:e.getAttribute("data-name"),d:parseFloat(e.dataset.distance||"NaN"),badge:(e.querySelector(".distance-badge")||{}).textContent||""}));
const ordered=await page.$$eval("[data-filter-item]",n=>{const d=n.map(x=>parseFloat(x.dataset.distance)).filter(v=>isFinite(v));return d.every((v,i)=>i===0||v>=d[i-1]);});
ok(`partners page auto-sorts by distance (#1 ${firstCard.name} ${firstCard.badge.trim()})`, /closest first/i.test(status)&&ordered&&firstCard.d<40);
await page.close(); await near.close();

// 4e. city listicle posts pull live directory data through the shortcode
page=await b.newPage();
await page.goto("http://localhost:8099/blog/best-ebike-rentals-destin-florida/",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(300);
const postBits=await page.evaluate(()=>({
  items:document.querySelectorAll(".listicle__item").length,
  faqs:document.querySelectorAll(".faq__item").length,
  author:(document.querySelector(".byline a[rel=author]")||{}).textContent||"",
  toc:document.querySelectorAll(".toc a").length,
  imgs:document.querySelectorAll("main img:not([src*=logo])").length,
  shortcodes:document.body.innerHTML.includes("{{"),
}));
ok(`Destin listicle: ${postBits.items} shops, ${postBits.faqs} FAQs, ${postBits.toc} TOC links, by ${postBits.author.trim()}, ${postBits.imgs} images`,
   postBits.items>=8&&postBits.faqs>=5&&postBits.toc>=3&&postBits.author&&postBits.imgs>=2&&!postBits.shortcodes);
await page.close();

// 4f. CTAs are square
page=await b.newPage();
await page.goto("http://localhost:8099/",{waitUntil:"domcontentloaded"});
const radius=await page.$eval(".btn--primary",e=>getComputedStyle(e).borderRadius);
const rentNow=await page.$eval('a.btn[href="/partners/"]',e=>e.textContent.trim());
ok(`CTAs are square (border-radius: ${radius}) and the hero CTA is "${rentNow}" to /partners/`, radius==="0px"&&/Rent Now/i.test(rentNow));
await page.close();

// 5. nav toggle on mobile
page=await b.newPage({viewport:{width:390,height:800}});
await page.goto("http://localhost:8099/");
await page.click(".nav-toggle");
await page.waitForTimeout(250);
const navOpen=await page.isVisible("#site-nav a[href='/find/']");
ok("mobile menu opens", navOpen);
await page.close();

// 6. FAQ accordion + internal nav
page=await b.newPage();
await page.goto("http://localhost:8099/");
await page.click(".faq__item summary");
await page.waitForTimeout(200);
const open=await page.$eval(".faq__item","e"in{}?0:(e)=>e.hasAttribute("open"));
ok("FAQ accordion opens", open);
await page.close();
await b.close();server.close();
