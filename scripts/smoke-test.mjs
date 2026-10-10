import { chromium, devices } from "playwright";
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
await page.goto("http://localhost:8099/cities/key-west/");
await page.waitForTimeout(400);
const before=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
await page.fill("[data-filter-form] input[name=q]","eaton");
await page.waitForTimeout(300);
const after=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
const count=await page.textContent("[data-filter-count]");
ok(`filter narrows list ${before} -> ${after} (${count.trim()})`, after>0 && after<before);
await page.close();

// 3. maps are switched off site-wide: no map markup, no Leaflet request
page=await b.newPage();
const asked=[];
page.on("request",r=>{ if(/leaflet|cartocdn|tile/i.test(r.url())) asked.push(r.url()); });
await page.goto("http://localhost:8099/cities/key-west/",{waitUntil:"load"});
await page.waitForTimeout(600);
const mapBits=await page.evaluate(()=>document.querySelectorAll(".map,.map-panel,[data-map-toggle]").length);
ok(`maps removed (0 map nodes, ${asked.length} tile/library requests)`, mapBits===0&&asked.length===0);
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

// 4g. sitewide promo banner: present, correctly attributed, dismissible
const promoCtx=await b.newContext({viewport:{width:1200,height:900}});
page=await promoCtx.newPage();
await page.goto("http://localhost:8099/",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(300);
const promo=await page.evaluate(()=>{
  const p=document.getElementById("promo-banner");
  const a=p&&p.querySelector(".promo__link");
  return p?{text:p.querySelector(".promo__text").textContent.trim(), href:a.href, rel:a.rel,
            target:a.target,
            aboveHeader:p.getBoundingClientRect().top<document.querySelector(".site-header").getBoundingClientRect().top,
            // The in-banner label is optional (promoBanner.disclosure), but the
            // Amazon Associates statement must stay in the footer sitewide.
            footerStatement:/Amazon Services LLC Associates Program/.test(document.body.textContent)}:null;
});
ok(`promo banner "${promo&&promo.text}" links out with rel="${promo&&promo.rel}"`,
   promo&&/amzn\.to/.test(promo.href)&&/sponsored/.test(promo.rel)&&/nofollow/.test(promo.rel)
   &&promo.target==="_blank"&&promo.aboveHeader);
ok("Amazon Associates statement still present in the footer", promo&&promo.footerStatement);
await page.click("[data-promo-close]");
await page.goto("http://localhost:8099/find/",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(300);
const dismissed=await page.evaluate(()=>document.getElementById("promo-banner").hidden);
ok("promo banner stays dismissed across pages in a session", dismissed);
await page.close(); await promoCtx.close();

// 4h. Viator booking CTA on the homepage and every trail guide
for (const path of ["/", "/trails/timpoochee-trail-30a/", "/trails/cross-seminole-trail/"]) {
  page=await b.newPage({viewport:{width:1200,height:900}});
  await page.goto("http://localhost:8099"+path,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(250);
  const cta=await page.evaluate(()=>{
    const a=document.querySelector('.booking-cta a[href*="viator.com"]');
    if(!a) return null;
    const box=a.closest(".booking-cta");
    return {rel:a.rel, target:a.target, pid:new URL(a.href).searchParams.get("pid"),
            disclosure:!!box.querySelector(".booking-cta__disclosure")};
  });
  ok(`Viator CTA on ${path} (pid=${cta&&cta.pid}, disclosed=${cta&&cta.disclosure})`,
     cta&&/sponsored/.test(cta.rel)&&/nofollow/.test(cta.rel)&&cta.target==="_blank"
     &&cta.pid==="P00320180"&&cta.disclosure);
  await page.close();
}

// 4i. the tours section is gone: hub and every tour page 301 to the homepage
{
  const { readFileSync, existsSync: has } = await import("node:fs");
  const vercel=JSON.parse(readFileSync("/home/user/floridaebikerentals.com/vercel.json","utf8")).redirects||[];
  const hub=vercel.find(r=>r.source==="/tours/"), each=vercel.find(r=>r.source==="/tours/:slug/");
  const linked=readFileSync(DIST+"/index.html","utf8").includes('href="/tours/');
  ok("/tours/ and /tours/<tour>/ redirect permanently to / and nothing links to them",
     hub&&each&&hub.destination==="/"&&each.destination==="/"&&hub.permanent&&each.permanent&&!has(DIST+"/tours")&&!linked);
}

// 4l. /find/ebike-rentals-near-me/ sorts by distance from three different
// corners of the state, and stands up on its own when location is declined
for (const [place,latitude,longitude,within] of [
  ["Key West",24.5551,-81.78,5],["Pensacola",30.4213,-87.2169,5],["Orlando",28.5383,-81.3792,8]]) {
  const geo=await b.newContext({permissions:["geolocation"],geolocation:{latitude,longitude},viewport:{width:1280,height:1000}});
  page=await geo.newPage();
  await page.goto("http://localhost:8099/find/ebike-rentals-near-me/",{waitUntil:"load"});
  await page.waitForTimeout(1800);
  const list=await page.$$eval("[data-filter-item]",n=>n.map(x=>({
    d:parseFloat(x.dataset.distance),
    badge:x.querySelector(".distance-badge")?.textContent.trim()||""})));
  const sorted=list.every((v,i)=>i===0||!(v.d<list[i-1].d));
  ok(`near-me page from ${place}: closest is ${list[0].badge}, ${list.length} shops in distance order`,
     list.length>20 && sorted && list[0].d<=within && /mi away/.test(list[0].badge));
  await page.close(); await geo.close();
}

// no location: still a complete, indexable ranking rather than an empty shell
const noGeo=await b.newContext({permissions:[],viewport:{width:1280,height:1000}});
page=await noGeo.newPage();
await page.goto("http://localhost:8099/find/ebike-rentals-near-me/",{waitUntil:"load"});
await page.waitForTimeout(2200);
const shops=await page.$$eval("[data-filter-item]",n=>n.length);
const badges=(await page.$$(".distance-badge")).length;
const nearH1=(await page.textContent("h1")).trim();
const towns=await page.$$eval("[data-filter-item]",n=>new Set(n.map(x=>x.dataset.city)).size);
ok(`near-me page without location: "${nearH1}", ${shops} shops across ${towns} towns, ${badges} distance badges`,
   nearH1==="E-Bike Rentals Near Me" && shops>20 && towns>=30 && badges===0);
await page.close(); await noGeo.close();

// 4m. /find town page: title and search bar first, already set to the town,
// and the search narrows the list, the service filter narrows it, and "Where"
// moves to another town
page=await b.newPage({viewport:{width:1366,height:900}});
await page.goto("http://localhost:8099/cities/daytona-beach/",{waitUntil:"load"});
const dTitle=await page.title();
const dH1=(await page.textContent("h1")).replace(/\s+/g," ").trim();
const where=await page.$eval("[data-destination]",s=>s.options[s.selectedIndex].text);
const heroFirst=await page.evaluate(()=>{
  const main=document.querySelector("main"); const first=main.firstElementChild;
  return first && first.classList.contains("find-hero") && !!first.querySelector("h1") && !!first.querySelector("form");
});
const statRows=await page.$$eval(".stat-row,.stats,.statrow",n=>n.length);
ok(`Daytona page: "${dTitle}" / H1 "${dH1}"`,
   /^Daytona Beach Florida Electric Bike Rentals List 20\d\d$/.test(dTitle) && dH1===dTitle);
ok(`Daytona page opens on the title + search bar, "Where" preset to "${where}", no stat callouts`,
   heroFirst && where==="Daytona Beach" && statRows===0);

const allShops=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
const noRestaurant=!(await page.content()).includes("Food Trends Restaurant");
await page.selectOption("#fs-tag","Scooters");
await page.waitForTimeout(250);
const scooterShops=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
ok(`Daytona service filter narrows ${allShops} -> ${scooterShops} scooter shops; restaurant listing excluded`,
   scooterShops>0 && scooterShops<allShops && noRestaurant);
await page.selectOption("#fs-tag","");
await page.fill("#fs-q","avocado");
await page.waitForTimeout(250);
const typed=await page.$$eval("[data-filter-item]",n=>n.filter(x=>!x.hidden).length);
ok(`Daytona text search narrows ${allShops} -> ${typed}`, typed===1);
await Promise.all([page.waitForURL(/ormond-beach/),page.selectOption("[data-destination]","/cities/ormond-beach/")]);
const moved=await page.$eval("[data-destination]",s=>s.options[s.selectedIndex].text);
ok(`"Where" goes to another town's page (${new URL(page.url()).pathname}, preset "${moved}")`, moved==="Ormond Beach");
await page.close();

// the hub gets the same hero, with just the destination picker
page=await b.newPage({viewport:{width:1366,height:900}});
await page.goto("http://localhost:8099/find/",{waitUntil:"load"});
const hubWhere=await page.$eval("[data-destination]",s=>s.options[s.selectedIndex].text);
await Promise.all([page.waitForURL(/key-west/),page.selectOption("[data-destination]","/cities/key-west/")]);
ok(`/find/ hub: "Where" preset "${hubWhere}" and picking a town opens it`, hubWhere==="All of Florida" && /key-west/.test(page.url()));
await page.close();

// 4n. thin towns: no page, and a permanent redirect to the homepage in both
// host formats; old listicle URLs redirect to the town page that replaced them
{
  const { readFileSync, existsSync: has } = await import("node:fs");
  const vercel=JSON.parse(readFileSync("/home/user/floridaebikerentals.com/vercel.json","utf8")).redirects||[];
  const netlify=readFileSync(DIST+"/_redirects","utf8");
  const thin="/find/ebike-rentals-in-daytona-beach-shores/";
  const legacy="/blog/5-best-ebike-rental-shops-in-daytona-beach-florida/";
  const vThin=vercel.find(r=>r.source===thin), vLegacy=vercel.find(r=>r.source===legacy);
  ok(`thin town page removed and redirected to / (${vercel.length} redirects in vercel.json)`,
     !has(DIST+thin+"index.html") && vThin && vThin.destination==="/" && vThin.permanent===true && netlify.includes(`${thin}  /  301!`));
  ok(`legacy Daytona listicle URL redirects to the town page`,
     vLegacy && vLegacy.destination==="/cities/daytona-beach/");
}

// 4o. featured images are the vector scenes, sharp at any width
page=await b.newPage({viewport:{width:1366,height:900}});
await page.goto("http://localhost:8099/blog/",{waitUntil:"load"});
const blogBanner=await page.$eval(".page-banner img, .find-hero__art",i=>i.getAttribute("src")).catch(()=>"");
await page.goto("http://localhost:8099/cities/key-west/",{waitUntil:"load"});
const keysHero=await page.$eval(".find-hero__art",i=>i.getAttribute("src"));
const og=await page.$eval('meta[property="og:image"]',m=>m.content);
ok(`featured images are scenes (blog ${blogBanner.split("/").pop()}, Key West hero ${keysHero.split("/").pop()})`,
   /\/scenes\/[a-z]+\.svg$/.test(blogBanner) && /keys\.svg$/.test(keysHero) && !/\.svg$/.test(og));
await page.close();

// 4p. AdSense quality fixes: one canonical host, no thin pages in the
// sitemap, reviews merged into partners, no invented authors
{
  const { readFileSync, readdirSync } = await import("node:fs");
  const sitemaps=readdirSync(DIST).filter(f=>/^sitemap-.*\.xml$/.test(f));
  const locs=sitemaps.flatMap(f=>[...readFileSync(DIST+"/"+f,"utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]));
  const offHost=locs.filter(u=>!u.startsWith("https://www.floridaebikerentals.com/"));
  const thin=locs.filter(u=>/\/(tours|search)\/[^/]+\/$/.test(u)||/\/reviews\//.test(u));
  ok(`sitemap: ${locs.length} URLs, all on www, none for tour details, search results or reviews`,
     locs.length>300 && offHost.length===0 && thin.length===0);

  const vercel=JSON.parse(readFileSync("/home/user/floridaebikerentals.com/vercel.json","utf8")).redirects||[];
  const rv=vercel.find(r=>r.source==="/reviews/bike-man-bike-rentals/");
  const pv=vercel.find(r=>r.source==="/partners/bike-man-bike-rentals/");
  ok("/reviews/<shop>/ and /partners/<shop>/ both go straight to /cities/<town>/<shop>/",
     rv && pv && rv.destination==="/cities/key-west/bike-man-bike-rentals/" && pv.destination===rv.destination && rv.permanent && pv.permanent);

  page=await b.newPage();
  await page.goto("http://localhost:8099/cities/key-west/bike-man-bike-rentals/",{waitUntil:"domcontentloaded"});
  const bars=(await page.$$(".score-bars .row")).length;
  const robots=await page.getAttribute('meta[name="robots"]',"content");
  const ld=await page.$$eval('script[type="application/ld+json"]',n=>n.map(x=>x.textContent).join(""));
  ok(`partner page carries the star breakdown (${bars} rows), is indexable, and marks up no third-party rating`,
     bars===5 && /^index/.test(robots) && !/aggregateRating/.test(ld));
  await page.close();

  let personas=0;
  const walk=(d)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=d+"/"+e.name;
    if(e.isDirectory()) walk(f); else if(f.endsWith(".html")&&/Dev Okafor|Marisa Donnelly|Priya Raman/.test(readFileSync(f,"utf8"))) personas++;}};
  walk(DIST);
  ok(`no invented author personas anywhere on the site (${personas} pages)`, personas===0);
}

// 4q. page-two fixes: local guides linked from their town pages, the homepage
// pointing at the 30A guide and the near-me page, and no unverified age rule
{
  const { readFileSync, readdirSync } = await import("node:fs");
  const read=(u)=>readFileSync(DIST+u+"index.html","utf8");
  const main=(h)=>(/<main id="main">([\s\S]*?)<\/main>/.exec(h)||[])[1]||"";
  ok("Orlando town page links the Orlando guide", main(read("/cities/orlando/")).includes('href="/blog/best-ebike-rentals-orlando-florida/"'));
  ok("Santa Rosa Beach town page links the 30A guide", main(read("/cities/santa-rosa-beach/")).includes('href="/blog/30a-ebike-rentals-guide/"'));
  const home=main(read("/"));
  ok("homepage links the 30A guide and the near-me page",
     home.includes('href="/blog/30a-ebike-rentals-guide/"') && home.includes('href="/find/ebike-rentals-near-me/"'));
  let claims=0;
  const walk=(d)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=d+"/"+e.name;
    if(e.isDirectory()) walk(f); else if(f.endsWith(".html")&&/Class\s+3[^.<]{0,40}(has|have|carry|carries|subject\s+to)\s+a\s+minimum\s+(operating\s+)?age|minimum\s+(operating\s+)?age\s+of\s+16|16\s+(year\s+old\s+)?minimum\s+operating\s+age|may\s+operate\s+a\s+Class\s+3/i.test(readFileSync(f,"utf8"))) claims++;}};
  walk(DIST);
  ok(`no page states the unverified Class 3 minimum age (${claims} pages)`, claims===0);
}

// 4r. /cities/ and /find/ restructure, photos and the header call button
{
  const { readFileSync, existsSync: has, readdirSync } = await import("node:fs");
  const vercel=JSON.parse(readFileSync("/home/user/floridaebikerentals.com/vercel.json","utf8")).redirects||[];
  const to=(src)=>(vercel.find(r=>r.source===src)||{}).destination;
  const sources=new Set(vercel.map(r=>r.source));
  const chained=vercel.filter(r=>sources.has(r.destination.split("#")[0]));
  ok(`old town, region and topic URLs redirect in one hop (${vercel.length} rules, ${chained.length} chains)`,
     to("/find/ebike-rentals-in-key-west/")==="/cities/key-west/" &&
     to("/find/ebike-rentals-in-the-florida-keys/")==="/cities/" &&
     to("/find/guided-ebike-tours-in-florida/")==="/find/ebike-tours/" &&
     chained.length===0 && vercel.length<2000);
  ok("one-shop town: /cities/<town>/ redirects to its shop, old /find/ URL to /",
     to("/cities/daytona-beach-shores/")==="/cities/daytona-beach-shores/blue-coast-shop/" &&
     to("/find/ebike-rentals-in-daytona-beach-shores/")==="/" && has(DIST+"/cities/daytona-beach-shores/blue-coast-shop/index.html"));
  ok("no page lives at an old /partners/<shop>/ or /find/ebike-rentals-in-<town>/ address",
     !has(DIST+"/partners/bike-man-bike-rentals") && !has(DIST+"/find/ebike-rentals-in-key-west"));

  page=await b.newPage({viewport:{width:1366,height:900}});
  await page.goto("http://localhost:8099/cities/",{waitUntil:"load"});
  const hub=await page.evaluate(()=>({
    h1:document.querySelector("h1").textContent.trim(),
    regions:document.querySelectorAll(".city-region").length,
    cards:document.querySelectorAll(".city-region .town-card").length,
    counted:[...document.querySelectorAll(".city-region .town-card__meta")].every(m=>/\d+ listings?/.test(m.textContent)),
  }));
  ok(`/cities/ hub: ${hub.regions} regions, ${hub.cards} town cards, each with its listing count`, hub.regions>=8 && hub.cards>150 && hub.counted);

  await page.goto("http://localhost:8099/find/",{waitUntil:"load"});
  const tiles=await page.$$eval(".category-tile .category-tile__name",n=>n.map(x=>x.textContent.trim()));
  ok(`/find/ is a category grid: ${tiles.join(", ")}`, tiles.includes("E-bike tours") && tiles.includes("Family-friendly") && tiles.includes("Delivery"));

  await page.goto("http://localhost:8099/find/delivery/",{waitUntil:"load"});
  const catWhere=await page.$eval("[data-destination]",s=>s.value);
  const townLink=await page.$eval('.pagelink-cloud a[href^="/find/delivery/"]',a=>a.getAttribute("href"));
  ok(`category page links its town pages (${townLink}) and "Where" stays in the category`, catWhere==="/find/delivery/" && /^\/find\/delivery\/[a-z-]+\/$/.test(townLink));
  await page.goto("http://localhost:8099"+townLink,{waitUntil:"load"});
  const ct=await page.evaluate(()=>({where:document.querySelector("[data-destination]").value,
    crumbs:[...document.querySelectorAll(".crumbs a, nav[aria-label=Breadcrumb] a")].map(a=>a.getAttribute("href")),
    items:document.querySelectorAll("[data-filter-item]").length}));
  ok(`category + town page: ${ct.items} shops, "Where" preset to itself, crumbs back to category and /find/`,
     ct.where===townLink && ct.items>=2 && ct.crumbs.includes("/find/delivery/") && ct.crumbs.includes("/find/"));

  // Listing pages: breadcrumb through the city, photo never upscaled
  await page.goto("http://localhost:8099/cities/key-west/bike-man-bike-rentals/",{waitUntil:"load"});
  const lp=await page.evaluate(()=>({crumbs:[...document.querySelectorAll(".crumbs a, nav[aria-label=Breadcrumb] a")].map(a=>a.getAttribute("href"))}));
  ok("listing page breadcrumb runs Home > Cities > Key West", lp.crumbs.includes("/cities/") && lp.crumbs.includes("/cities/key-west/"));

  // No listing image anywhere is hotlinked or drawn wider than its file
  await page.goto("http://localhost:8099/cities/daytona-beach/",{waitUntil:"load"});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await page.waitForTimeout(600);
  const imgs=await page.$$eval("main img",n=>n.map(i=>({src:i.getAttribute("src"),w:i.clientWidth,nw:i.naturalWidth,ok:i.complete&&i.naturalWidth>0})));
  const remote=imgs.filter(i=>/^https?:/.test(i.src));
  const broken=imgs.filter(i=>!i.ok);
  const stretched=imgs.filter(i=>i.nw && !/\.svg$/.test(i.src) && i.w>i.nw*1.05);
  ok(`Daytona page: ${imgs.length} images, ${remote.length} hotlinked, ${broken.length} broken, ${stretched.length} upscaled`,
     imgs.length>3 && remote.length===0 && broken.length===0 && stretched.length===0);
  await page.close();

  // Header call button on every page
  page=await b.newPage({viewport:{width:390,height:800}});
  for (const path of ["/","/cities/","/blog/florida-ebike-laws/"]) {
    await page.goto("http://localhost:8099"+path,{waitUntil:"domcontentloaded"});
    const call=await page.evaluate(()=>{const a=document.querySelector(".site-header .header-call");
      if(!a) return null; const r=a.getBoundingClientRect();
      return {href:a.getAttribute("href"),text:a.textContent.replace(/\s+/g," ").trim(),visible:r.width>0&&r.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};});
    ok(`${path}: header shows "${call&&call.text}" -> ${call&&call.href} at 390px`,
       call && call.href==="tel:+13053631922" && /Rent Now/.test(call.text) && /305/.test(call.text) && call.visible && !call.overflow);
  }
  await page.close();
}

// 4s. town pages carry location & directions for every shop and an honest pricing section
{
  const { readFileSync } = await import("node:fs");
  const h=readFileSync(DIST+"/cities/key-west/index.html","utf8");
  const shops=(h.match(/data-filter-item/g)||[]).length;
  const rows=((/<section[^>]*id="location"[\s\S]*?<\/section>/.exec(h)||[""])[0].match(/<tr>/g)||[]).length-1; // less the header row
  ok(`Key West: location table has a row per shop (${rows}/${shops}) and a pricing section that quotes no rate`,
     rows===shops && /id="pricing"/.test(h) && !/id="pricing"[\s\S]{0,1500}\$\d/.test(h));
}

// 5. nav toggle on mobile
page=await b.newPage({viewport:{width:390,height:800}});
await page.goto("http://localhost:8099/");
await page.click(".nav-toggle");
await page.waitForTimeout(250);
const navOpen=await page.isVisible("#site-nav a[href='/find/']");
ok("mobile menu opens", navOpen);
await page.close();

// 5b. the promo strip carries both offers and turns them over on a timer
page=await b.newPage({viewport:{width:1280,height:900}});
await page.goto("http://localhost:8099/",{waitUntil:"load"});
// The cursor starts at 0,0, which is inside the strip; park it away from the
// offers so the hover pause does not hold the rotation still.
await page.mouse.move(640,600);
const promoText=()=>page.textContent(".promo__link.is-current .promo__text");
const slideCount=(await page.$$(".promo__link")).length;
const firstOffer=(await promoText()).trim();
await page.waitForTimeout(7600);
const secondOffer=(await promoText()).trim();
const viator=await page.getAttribute(".promo__link:nth-child(2)","href");
const relAttrs=await page.$$eval(".promo__link",n=>n.map(a=>a.rel));
ok(`promo rotates ${slideCount} offers: "${firstOffer}" -> "${secondOffer}"`,
   slideCount===2&&firstOffer!==secondOffer&&/Book Local E-bike Tours/.test(secondOffer));
ok("Viator promo is a sponsored link to the affiliate search",
   /viator\.com\/searchResults/.test(viator||"")&&/pid=P00320180/.test(viator||"")
   &&relAttrs.every(r=>/sponsored/.test(r)&&/nofollow/.test(r)));

// the change is a slide, not a swap: sample the offers' positions through a
// turn and check the incoming one travels in from the edge of the strip
const travel=await page.evaluate(()=>new Promise(res=>{
  const deck=document.querySelector(".promo__deck");
  const slides=[...deck.querySelectorAll(".promo__link")];
  const seen=[];
  const iv=setInterval(()=>{
    const left=deck.getBoundingClientRect().left;
    seen.push(slides.map(s=>Math.round(s.getBoundingClientRect().left-left)));
  },100);
  setTimeout(()=>{clearInterval(iv);res({seen,w:Math.round(deck.getBoundingClientRect().width)});},9000);
}));
const flat=travel.seen.map(r=>r.join("|"));
const moving=travel.seen.filter(r=>r.some(x=>x>4&&x<travel.w-4)).length;
const parked=travel.seen[0].some(x=>Math.abs(x-travel.w)<4);
const landed=travel.seen[travel.seen.length-1].some(x=>Math.abs(x)<4);
ok(`offers slide across the ${travel.w}px strip (${moving} frames in motion, ${new Set(flat).size} distinct positions)`,
   parked&&landed&&moving>=2);

// hovering holds the offer still, so a visitor reading one is not interrupted
await page.hover(".promo__deck");
const held=(await promoText()).trim();
await page.waitForTimeout(7600);
ok("promo pauses while hovered", (await promoText()).trim()===held);
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
