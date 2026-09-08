import { esc, attr, clamp } from "../util.mjs";
import { page, pageHero, breadcrumbSchema } from "../layout.mjs";
import { faqBlock, faqSchema, linkCloud, ctaBand, adSlot, adSlotScript, ADSENSE_INLINE } from "../components.mjs";
import { photoFor, secondPhotoFor, figure } from "../images.mjs";

/**
 * The Florida e-bike rules page.
 *
 * This is the one page on the site that people arrive at from a search that is
 * not about renting anything - "can I ride an e-bike on the sidewalk in Florida"
 * - so it is written to answer that in the first screen and then keep going.
 *
 * Sourcing rule for everything below: state law is cited to its statute section
 * by number, and the SB 382 veto is cited to news coverage of it. Nothing here
 * describes a specific town's ordinance, because those are adopted and amended
 * locally and we cannot verify 400 of them - so instead the page tells the
 * reader exactly what to look for and where to look. CHECKED is the date the
 * page was last read against its sources and it is shown to the reader.
 */
export const CHECKED = "2026-09-08";
const CHECKED_LABEL = "8 September 2026";

const CLASSES = [
  {
    n: "1",
    name: "Class 1",
    speed: "20 mph",
    assist: "Pedal-assist only",
    blurb:
      "The motor helps only while you are pedalling, and stops helping at 20 mph. The class most " +
      "welcome on shared paths, and what most Florida trail rentals hand you.",
  },
  {
    n: "2",
    name: "Class 2",
    speed: "20 mph",
    assist: "Throttle allowed",
    blurb:
      "Has a throttle, so it can move without pedalling, and still cuts out at 20 mph. This is the " +
      "typical Florida beach cruiser rental - the one you can ride home on a tired afternoon.",
  },
  {
    n: "3",
    name: "Class 3",
    speed: "28 mph",
    assist: "Pedal-assist only",
    blurb:
      "Pedal-assist that keeps helping up to 28 mph, and must have a speedometer. Fast enough that " +
      "this is the class a local path or park is most likely to restrict.",
  },
];

/* The practical question, answered as verdicts rather than prose. */
const VERDICTS = [
  {
    v: "yes",
    where: "Roads and road shoulders",
    detail:
      "Same as a bicycle. You ride with traffic, obey the same signals and signs, and have the same " +
      "right to the road.",
  },
  {
    v: "yes",
    where: "Bike lanes",
    detail: "Explicitly included in the statute alongside streets, highways, roadways and shoulders.",
  },
  {
    v: "yes",
    where: "Bicycle and multiuse paths",
    detail:
      "Allowed at state level - which makes Florida unusually permissive, Class 3 included. But this " +
      "is exactly where a local authority is most likely to have narrowed it. Read the trailhead sign.",
  },
  {
    v: "maybe",
    where: "Sidewalks",
    detail:
      "State law gives e-bikes the same standing as bicycles, and it explicitly lets your city or " +
      "county write its own sidewalk rules. So the honest answer is: it depends on the town, and in " +
      "the busy beach districts it is often restricted. Where you may ride, you yield to people on foot.",
  },
  {
    v: "maybe",
    where: "State and county parks",
    detail:
      "The agency that runs a path, trail or park can restrict or ban e-bikes on it, and some do - " +
      "usually Class 3 first. Posted signage at the trailhead is the rule that applies to you.",
  },
  {
    v: "no",
    where: "Limited-access highways and interstates",
    detail: "Closed to bicycles, and therefore closed to e-bikes.",
  },
  {
    v: "no",
    where: "The sand",
    detail:
      "Not a legal question so much as a physical one, but worth saying: beach access for any wheeled " +
      "vehicle is a local rule, and soft sand ruins a hub motor. Ride the boardwalk or the road.",
  },
];

const SOURCES = [
  {
    label: "Fla. Stat. § 316.003 - definitions, including the electric bicycle classes",
    note: "Motor of 750 watts or less, operable pedals, and a seat. Class 1, 2 and 3 defined by speed and throttle.",
  },
  {
    label: "Fla. Stat. § 316.20655 - electric bicycle regulations",
    note:
      "Grants e-bikes and their riders the same rights and duties as bicycles; removes any licence, " +
      "registration, title and insurance requirement; and preserves local authority over sidewalks, " +
      "paths and trail networks.",
  },
  {
    label: "Fla. Stat. § 316.2065 - bicycle regulations, including the under-16 helmet rule",
    note: "Applies to e-bike riders through the parity granted by § 316.20655.",
  },
  {
    label: "CS/SB 382 (2026) and the Governor's veto",
    note:
      "Passed the Senate 37-0 and the House 112-0, then vetoed in June 2026. Reported by Florida " +
      "Politics, WFLA, CBS12 and Insurance Journal, which quote the veto message.",
  },
];

const FAQS = [
  {
    q: "Do I need a licence, registration or insurance to ride an e-bike in Florida?",
    a: `<p>No. Section 316.20655 specifically exempts electric bicycles and their riders from the laws
    on financial responsibility, driver and vehicle licences, vehicle registration and title
    certificates. If you can legally ride a bicycle, you can legally ride an e-bike.</p>`,
  },
  {
    q: "Is there a minimum age to ride an e-bike in Florida?",
    a: `<p>Not in state law. The statute sets no statewide minimum age - but it expressly allows local
    governments to adopt one, and some have. Anyone under 16 must wear a helmet, which is a state
    rule and not a local one.</p>`,
  },
  {
    q: "Are helmets required?",
    a: `<p>For riders and passengers under 16, yes - a properly fitted and fastened helmet, on public
    roads, bike paths and other public riding areas. Over 16 the state does not require one. Rental
    shops will generally hand you a helmet with the bike; take it.</p>`,
  },
  {
    q: "Can I ride an e-bike on the sidewalk in Florida?",
    a: `<p>It depends entirely on the town. State law puts e-bikes on the same footing as bicycles and
    then explicitly permits a city or county to write its own ordinance for sidewalks and sidewalk
    areas in its jurisdiction. Plenty of Florida beach towns have done exactly that for their busiest
    blocks. Where riding is allowed, people on foot have the right of way.</p>`,
  },
  {
    q: "Is there a 10 mph speed limit near pedestrians?",
    a: `<p>No - and this is the most common piece of wrong information about Florida e-bikes right now.
    A bill that would have created that rule, CS/SB 382, passed both chambers unanimously in 2026 and
    was then vetoed by the Governor, so it never became law. A great many e-bike articles published
    since have reported it as though it did. Ride considerately near people on foot because it is
    right, not because that statute exists.</p>`,
  },
  {
    q: "Does my rental shop have to tell me the class?",
    a: `<p>The bike itself should carry a permanent manufacturer label showing its class and motor
    output. It is worth a glance before you ride off, because the class is what a restricted path or
    park will care about - and a shop that cannot tell you is a shop worth a second thought.</p>`,
  },
];

export function rulesPage(site, { index }) {
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/rules/", label: "E-Bike Rules" },
  ];
  const hero = photoFor("rules");
  const extra = secondPhotoFor("rules");
  const regions = [...(index.regions || [])].sort((a, b) => a.name.localeCompare(b.name, "en"));

  const body = `
${pageHero({
  crumbs: crumbs,
  eyebrow: "Florida e-bike law, in plain English",
  h1: "Where Can You Legally Ride an E-Bike in Florida?",
  lede:
    "Short version: anywhere a bicycle can go - unless the town you are in says otherwise. " +
    "That second half is where almost everyone gets caught out. Here is the whole picture, " +
    "checked against the statutes.",
})}

<section class="section">
  <div class="wrap wrap-narrow">
    <div class="verdict-hero">
      <p class="verdict-hero__kicker">The one-sentence answer</p>
      <p class="verdict-hero__answer">Florida law gives an e-bike rider <strong>the same rights and
      the same duties as a bicycle rider</strong> - no licence, no registration, no insurance - and
      then lets your city, county or park agency set its own rules for sidewalks, paths and trails.</p>
      <p class="verdict-hero__meta">Checked against Fla. Stat. §§ 316.003, 316.2065 and 316.20655
      on ${esc(CHECKED_LABEL)}. Not legal advice - see the note at the foot of this page.</p>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head">
      <h2>Can I ride here?</h2>
      <p>The question people actually have, answered place by place.</p>
    </div>
    <ul class="verdicts">
      ${VERDICTS.map(
        (r) => `<li class="verdict verdict--${attr(r.v)}">
        <span class="verdict__flag">${r.v === "yes" ? "Yes" : r.v === "no" ? "No" : "Depends"}</span>
        <div class="verdict__body">
          <h3>${esc(r.where)}</h3>
          <p>${esc(r.detail)}</p>
        </div>
      </li>`
      ).join("\n      ")}
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap wrap-narrow">
    <div class="mythbust">
      <p class="mythbust__tag">Widely repeated, and wrong</p>
      <h2>There is no 10 mph rule near pedestrians</h2>
      <p>If you have read that Florida now caps e-bikes at 10 mph within 50 feet of a pedestrian, you
      have read about <strong>a bill that did not become law</strong>. CS/SB 382 would have done
      exactly that. It passed the Senate 37-0 and the House 112-0 in 2026 - and was then vetoed by the
      Governor, whose veto message argued the limit would be hard for a rider to judge and would end
      up enforced with speed-detection equipment.</p>
      <p>The bill would also have created a Micromobility Device Safety Task Force and written the
      yield-and-signal-before-passing courtesy into statute. None of it is law. A striking number of
      e-bike guides published since the veto still state the 10 mph figure as current Florida law, so
      if you are checking a rule, check its date.</p>
      <p class="mythbust__foot">Correct as of ${esc(CHECKED_LABEL)}. If the Legislature takes this up
      again we will update this page and change that date.</p>
    </div>
  </div>
</section>

${adSlot(site, "")}

<section class="section section--tint">
  <div class="wrap">
    <div class="section__head">
      <h2>The three classes, and which one you are renting</h2>
      <p>Every legal e-bike in Florida has a motor of 750 watts or less, working pedals and a seat.
      Beyond that it is one of three classes, and the class is what a restricted path cares about.</p>
    </div>
    <div class="class-cards">
      ${CLASSES.map(
        (c) => `<article class="class-card">
        <span class="class-card__n">${esc(c.n)}</span>
        <h3>${esc(c.name)}</h3>
        <p class="class-card__spec"><strong>${esc(c.speed)}</strong> assisted top speed</p>
        <p class="class-card__spec">${esc(c.assist)}</p>
        <p>${esc(c.blurb)}</p>
      </article>`
      ).join("\n      ")}
    </div>
    <p class="muted mt-3">All three are legal to ride on Florida roads and bike lanes. The bike
    should carry a permanent label giving its class and wattage.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      ${figure(hero, { alt: `Riding an e-bike in Florida - ${hero.alt}` })}
      <div class="prose">
        <h2>The part that catches people out</h2>
        <p>State law is the floor, not the whole building. Section 316.20655 keeps two powers with
        local government, and between them they decide most of what you will actually run into:</p>
        <p><strong>Your city or county can write its own ordinance</strong> for e-bikes on streets,
        highways, sidewalks and sidewalk areas in its jurisdiction - including a minimum age.</p>
        <p><strong>Whoever runs a path can restrict or ban e-bikes on it</strong> - a municipality, a
        county, or a state agency with jurisdiction over a bicycle path, multiuse path or trail
        network. Class 3 tends to be first out.</p>
        <p>So the rule that binds you on a Tuesday afternoon in a particular beach town is usually a
        local one, and there are hundreds of them. Two minutes of checking beats an argument with a
        beach patrol officer.</p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="grid grid--2" style="align-items:center">
      <div class="prose">
    <h2>How to check your town in two minutes</h2>
    <ol class="steps">
      <li><strong>Search the city's own site.</strong> Try the town name with "e-bike ordinance" or
      "bicycle sidewalk ordinance". City and county pages outrank the blogs on this and they are the
      only ones that count.</li>
      <li><strong>Read the trailhead sign.</strong> Path and park rules are posted where you enter,
      and posted signage is what an officer will point at.</li>
      <li><strong>Ask the shop.</strong> This is the underrated one. A rental shop three blocks from
      the beach knows precisely which stretch of sidewalk is enforced, because its customers get
      stopped there. Ask when you pick the bike up.</li>
      <li><strong>Ask which class you are on.</strong> If a path restricts anything, it restricts
      Class 3 first, so know what you are riding before you set off.</li>
    </ol>
      </div>
      ${figure(extra, { alt: `Checking the local rules before an e-bike ride - ${extra.alt}` })}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap wrap-narrow">
    <h2>Common questions</h2>
    ${faqBlock(FAQS)}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap wrap-narrow">
    <h2>Where this comes from</h2>
    <p class="muted">Everything on this page traces back to one of these. We read them again on
    ${esc(CHECKED_LABEL)}.</p>
    <ul class="sources">
      ${SOURCES.map(
        (s) => `<li><strong>${esc(s.label)}</strong><span>${esc(s.note)}</span></li>`
      ).join("\n      ")}
    </ul>
    <p class="muted mt-3"><strong>This is not legal advice.</strong> We run a rental directory, not a
    law firm. State law changes, local ordinances change more often, and the rule posted at the
    trailhead in front of you beats anything written here. If something turns on it, check with the
    city or with a lawyer.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${ctaBand({
      title: "Now go and ride something",
      text: "You know the rules. These are the shops, town by town, with the hours and the phone numbers.",
      buttons: [
        { href: "/find/", label: "Find a rental near you" },
        { href: "/trails/", label: "Florida trail guides", variant: "btn--outline" },
      ],
    })}
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <h2>Rentals by region</h2>
    ${linkCloud(
      regions.map((r) => ({
        href: r.url,
        label: `E-bike rentals in ${r.name}`,
        count: r.listings.length,
      }))
    )}
    <h3 class="mt-3">Keep reading</h3>
    ${linkCloud(
      [
        { href: "/costs/", label: "What a Florida e-bike rental costs" },
        { href: "/trails/", label: "Florida e-bike trail guides" },
        { href: "/find/", label: "Every Florida town we cover" },
        { href: "/blog/", label: "Guides and advice from our team" },
      ].sort((a, b) => a.label.localeCompare(b.label, "en"))
    )}
  </div>
</section>
${adSlotScript(site, 1)}
`;

  return page(site, {
    title: "Florida E-Bike Laws - Where You Can Legally Ride, Explained",
    description: clamp(
      "Florida e-bike law in plain English: the three classes, where you may and may not ride, " +
        "helmet and age rules, what your city can restrict, and why the widely-reported 10 mph " +
        "rule is not law. Checked against the statutes."
    ),
    path: "/rules/",
    body,
    ogImage: hero.src,
    inlineScripts: site.adsense?.enabled ? [ADSENSE_INLINE] : [],
    schema: [breadcrumbSchema(site, crumbs), faqSchema(FAQS)],
  });
}
