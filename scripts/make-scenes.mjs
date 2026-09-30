#!/usr/bin/env node
/**
 * Draws the site's featured-image illustrations as SVG.
 *
 *   node scripts/make-scenes.mjs
 *
 * Writes assets/img/scenes/<id>.svg, plus a 1200x630 JPEG of each for Open
 * Graph cards (social networks do not render SVG) using the Chromium that
 * Playwright already provides for the tests.
 *
 * Why illustrations rather than photographs: the photo library was four images
 * 499-800px wide, stretched across a 1,180px banner -- 2,360 device pixels on a
 * retina screen -- so every featured image on the site looked soft. Vector art
 * is sharp at any size, weighs a few kilobytes, and can be drawn in the brand
 * palette. Every scene is captioned as an illustration so nobody reads it as a
 * photograph of a particular place.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../src/data.mjs";

const OUT = join(ROOT, "assets", "img", "scenes");
const W = 1600;
const H = 900;

/* ---------------------------------------------------------------- pieces */

const f = (n) => Math.round(n * 10) / 10;

/** A seeded pseudo-random stream, so every build draws the identical scene. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cloud(x, y, s, opacity = 0.9) {
  return `<g opacity="${opacity}" fill="#fff">
    <ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(70 * s)}" ry="${f(22 * s)}"/>
    <ellipse cx="${f(x - 40 * s)}" cy="${f(y + 4 * s)}" rx="${f(46 * s)}" ry="${f(18 * s)}"/>
    <ellipse cx="${f(x + 34 * s)}" cy="${f(y - 10 * s)}" rx="${f(44 * s)}" ry="${f(24 * s)}"/>
    <ellipse cx="${f(x + 76 * s)}" cy="${f(y + 6 * s)}" rx="${f(38 * s)}" ry="${f(14 * s)}"/>
  </g>`;
}

/** Palm tree. (x, y) is the base of the trunk; lean is in pixels at the crown. */
function palm(x, y, height, lean, { trunk = "#6b4f33", leaf = "#1f6b3a", leafDark = "#15502b" } = {}) {
  const tx = x + lean;
  const ty = y - height;
  const bend = x + lean * 0.35;
  const trunkPath = `M${f(x - 9)},${f(y)} Q${f(bend - 6)},${f(y - height * 0.55)} ${f(tx - 4)},${f(ty)}
    L${f(tx + 4)},${f(ty)} Q${f(bend + 6)},${f(y - height * 0.55)} ${f(x + 9)},${f(y)} Z`;
  // Ring marks up the trunk.
  let rings = "";
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const cx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * bend + t * t * tx;
    const cy = y - height * t;
    rings += `<path d="M${f(cx - 7 + t * 3)},${f(cy)} q${f(7)},${f(3)} ${f(14 - t * 6)},0" stroke="#4d3824" stroke-width="2" fill="none" opacity=".55"/>`;
  }
  const fronds = [
    [-150, 30], [-115, 60], [-70, 78], [150, 30], [115, 62], [70, 80], [-25, -30], [30, -26],
  ]
    .map(([dx, dy], i) => {
      const ex = tx + dx * (height / 260);
      const ey = ty + dy * (height / 260);
      const mx = tx + dx * 0.55 * (height / 260);
      const my = ty - Math.abs(dx) * 0.18 * (height / 260) - 12;
      const colour = i % 2 ? leaf : leafDark;
      return `<path d="M${f(tx)},${f(ty)} Q${f(mx)},${f(my - 16)} ${f(ex)},${f(ey)} Q${f(mx)},${f(my + 10)} ${f(tx)},${f(ty)} Z" fill="${colour}"/>`;
    })
    .join("");
  return `<g><path d="${trunkPath}" fill="${trunk}"/>${rings}${fronds}
    <circle cx="${f(tx)}" cy="${f(ty + 4)}" r="${f(height / 34)}" fill="#3d2a18"/></g>`;
}

/** A clump of sea oats: thin grass blades with seed heads. */
function seaOats(x, y, count, rand, colour = "#8a7a3c", headColour = "#b89a52") {
  let out = "";
  for (let i = 0; i < count; i++) {
    const bx = x + (rand() - 0.5) * 60;
    const h = 60 + rand() * 70;
    const lean = (rand() - 0.5) * 50;
    out += `<path d="M${f(bx)},${f(y)} q${f(lean * 0.4)},${f(-h * 0.6)} ${f(lean)},${f(-h)}" stroke="${colour}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    if (rand() > 0.35) {
      out += `<ellipse cx="${f(bx + lean)}" cy="${f(y - h - 6)}" rx="3.2" ry="9" fill="${headColour}" transform="rotate(${f(lean * 0.5)} ${f(bx + lean)} ${f(y - h - 6)})"/>`;
    }
  }
  return out;
}

/**
 * An e-bike and rider, side on, facing right. (x, y) is where the rear tyre
 * meets the ground; `s` scales the whole group.
 */
function rider(x, y, s, { shirt = "#2050c8", shorts = "#0b1f4d", skin = "#c98e62", helmet = "#ffc233", frame = "#0d1730", basket = true } = {}) {
  const r = 38;
  const rear = [0, -r];
  const front = [122, -r];
  const bb = [54, -40];
  const seat = [40, -104];
  const head = [102, -104];
  const bar = [104, -126];
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="61" cy="2" rx="96" ry="7" fill="#000" opacity=".16" stroke="none"/>
    <!-- wheels: fat tyres -->
    <circle cx="${rear[0]}" cy="${rear[1]}" r="${r}" fill="none" stroke="${frame}" stroke-width="11"/>
    <circle cx="${front[0]}" cy="${front[1]}" r="${r}" fill="none" stroke="${frame}" stroke-width="11"/>
    <circle cx="${rear[0]}" cy="${rear[1]}" r="${r - 9}" fill="none" stroke="#9aa6c2" stroke-width="2"/>
    <circle cx="${front[0]}" cy="${front[1]}" r="${r - 9}" fill="none" stroke="#9aa6c2" stroke-width="2"/>
    <circle cx="${rear[0]}" cy="${rear[1]}" r="8" fill="#5b6785" stroke="none"/>
    <circle cx="${front[0]}" cy="${front[1]}" r="5" fill="#5b6785" stroke="none"/>
    <!-- frame: step-through -->
    <g fill="none" stroke="${frame}" stroke-width="7">
      <path d="M${rear[0]},${rear[1]} L${bb[0]},${bb[1]}"/>
      <path d="M${rear[0]},${rear[1]} L${seat[0] - 2},${seat[1] + 14}"/>
      <path d="M${bb[0]},${bb[1]} L${seat[0] - 2},${seat[1] + 8}"/>
      <path d="M${bb[0]},${bb[1]} Q${80},${-52} ${head[0]},${head[1]}"/>
      <path d="M${head[0]},${head[1]} L${front[0]},${front[1]}"/>
      <path d="M${head[0]},${head[1]} L${bar[0] - 2},${bar[1]}"/>
      <path d="M${bar[0] - 8},${bar[1] - 2} L${bar[0] + 12},${bar[1] + 2}" stroke-width="6"/>
    </g>
    <!-- battery on the down tube -->
    <rect x="62" y="-66" width="34" height="13" rx="5" fill="#e2ebfe" stroke="${frame}" stroke-width="2" transform="rotate(-38 79 -59)"/>
    <!-- saddle -->
    <path d="M${seat[0] - 14},${seat[1] + 2} q14,-8 30,0" fill="none" stroke="${frame}" stroke-width="8"/>
    ${
      basket
        ? `<rect x="${front[0] - 2}" y="${bar[1] + 6}" width="26" height="20" rx="3" fill="#b88a55" stroke="#7a5a33" stroke-width="2"/>`
        : ""
    }
    <!-- rider -->
    <path d="M${seat[0] + 2},${seat[1] - 2} L64,-80 L60,-34" fill="none" stroke="${shorts}" stroke-width="13"/>
    <path d="M60,-34 L66,-30" stroke="${skin}" stroke-width="10"/>
    <path d="M${seat[0] + 2},${seat[1] - 2} L50,-74 L${bb[0] - 10},${bb[1] + 12}" fill="none" stroke="${shorts}" stroke-width="12" opacity=".85"/>
    <path d="M${seat[0] - 4},${seat[1] - 2} L${seat[0] + 20},${seat[1] - 64}" stroke="${shirt}" stroke-width="30"/>
    <path d="M${seat[0] + 18},${seat[1] - 56} L${bar[0] - 2},${bar[1] - 2}" stroke="${skin}" stroke-width="9"/>
    <path d="M${seat[0] + 18},${seat[1] - 56} L${seat[0] + 40},${seat[1] - 44}" stroke="${shirt}" stroke-width="12"/>
    <circle cx="${seat[0] + 28}" cy="${seat[1] - 86}" r="15" fill="${skin}" stroke="none"/>
    <path d="M${seat[0] + 12},${seat[1] - 88} a17,15 0 0 1 33,-2 l2,5 h-37 z" fill="${helmet}" stroke="none"/>
  </g>`;
}

/** Wide live oak with Spanish moss. (x, y) is the base of the trunk. */
function liveOak(x, y, s, rand, { leaf = "#2f6b3f", dark = "#22502f", moss = "#a9b59a" } = {}) {
  let crown = "";
  for (let i = 0; i < 26; i++) {
    const cx = x + (rand() - 0.5) * 520 * s;
    const cy = y - 240 * s - rand() * 150 * s + Math.abs(cx - x) * 0.25;
    const rx = (70 + rand() * 80) * s;
    const ry = (40 + rand() * 40) * s;
    crown += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${i % 3 ? leaf : dark}"/>`;
  }
  let mossy = "";
  for (let i = 0; i < 34; i++) {
    const mx = x + (rand() - 0.5) * 480 * s;
    const top = y - 210 * s - rand() * 60 * s + Math.abs(mx - x) * 0.25;
    const len = (40 + rand() * 70) * s;
    mossy += `<path d="M${f(mx)},${f(top)} q${f(6 * s)},${f(len * 0.5)} ${f(-2 * s)},${f(len)}" stroke="${moss}" stroke-width="${f(5 * s)}" fill="none" stroke-linecap="round" opacity=".85"/>`;
  }
  const trunk = `<path d="M${f(x - 22 * s)},${f(y)} C${f(x - 18 * s)},${f(y - 120 * s)} ${f(x - 60 * s)},${f(y - 180 * s)} ${f(x - 200 * s)},${f(y - 230 * s)}
      L${f(x - 190 * s)},${f(y - 244 * s)} C${f(x - 40 * s)},${f(y - 200 * s)} ${f(x)},${f(y - 170 * s)} ${f(x + 10 * s)},${f(y - 250 * s)}
      L${f(x + 30 * s)},${f(y - 250 * s)} C${f(x + 30 * s)},${f(y - 180 * s)} ${f(x + 60 * s)},${f(y - 200 * s)} ${f(x + 210 * s)},${f(y - 230 * s)}
      L${f(x + 214 * s)},${f(y - 216 * s)} C${f(x + 50 * s)},${f(y - 170 * s)} ${f(x + 24 * s)},${f(y - 120 * s)} ${f(x + 24 * s)},${f(y)} Z" fill="#4a3a2a"/>`;
  return `<g>${trunk}${crown}${mossy}</g>`;
}

function svg(id, title, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t-${id}">
<title id="t-${id}">${title}</title>
<defs>${defs}</defs>
${body}
</svg>
`;
}

/* ---------------------------------------------------------------- scenes */

/** Atlantic coast at sunrise: wide hard-packed beach, fishing pier, two riders. */
function atlantic() {
  const rand = rng(11);
  const horizon = 470;
  let pilings = "";
  for (let i = 0; i < 26; i++) {
    const x = 930 + i * 26 + i * i * 0.6;
    const deckY = horizon - 18 + i * 0.4;
    pilings += `<rect x="${f(x)}" y="${f(deckY)}" width="${f(3 + i * 0.12)}" height="${f(24 + i * 1.3)}" fill="#3b4760"/>`;
  }
  let sparkle = "";
  for (let i = 0; i < 60; i++) {
    const x = rand() * W;
    const y = horizon + 8 + rand() * 120;
    sparkle += `<path d="M${f(x)},${f(y)} h${f(8 + rand() * 18)}" stroke="#fff" stroke-width="2" opacity="${f(0.3 + rand() * 0.5)}"/>`;
  }
  return svg(
    "atlantic",
    "Illustration: two riders on fat-tyre e-bikes along a wide Atlantic beach at sunrise, with a fishing pier behind",
    `<rect width="${W}" height="${H}" fill="url(#a-sky)"/>
    <circle cx="420" cy="${horizon - 70}" r="210" fill="url(#a-glow)"/>
    <circle cx="420" cy="${horizon - 70}" r="62" fill="#fff4cf"/>
    ${cloud(1150, 150, 1.4, 0.85)}${cloud(260, 120, 1, 0.7)}${cloud(820, 230, 0.8, 0.6)}${cloud(1450, 280, 0.7, 0.55)}
    <rect y="${horizon}" width="${W}" height="190" fill="url(#a-sea)"/>
    ${Array.from({ length: 18 }, (_, i) => {
      const w = 26 + (18 - i) * 6;
      return `<path d="M${f(420 - w / 2)},${f(horizon + 8 + i * 8)} h${f(w)}" stroke="#fff2c8" stroke-width="3" opacity="${f(0.8 - i * 0.04)}"/>`;
    }).join("")}
    ${sparkle}
    <!-- pier -->
    <path d="M920,${horizon - 22} L${W},${horizon - 6}" stroke="#2a3550" stroke-width="7"/>
    <path d="M920,${horizon - 30} L${W},${horizon - 18}" stroke="#2a3550" stroke-width="2"/>
    ${pilings}
    <rect x="1010" y="${horizon - 44}" width="46" height="22" fill="#2a3550"/>
    <!-- surf line and wet sand -->
    <path d="M0,${horizon + 170} C300,${horizon + 150} 600,${horizon + 190} 900,${horizon + 165} S1400,${horizon + 150} ${W},${horizon + 172} L${W},${H} L0,${H} Z" fill="#e9d9b0"/>
    <path d="M0,${horizon + 170} C300,${horizon + 150} 600,${horizon + 190} 900,${horizon + 165} S1400,${horizon + 150} ${W},${horizon + 172}" stroke="#fff" stroke-width="7" fill="none" opacity=".9"/>
    <path d="M0,${horizon + 186} C320,${horizon + 170} 640,${horizon + 205} 960,${horizon + 182} S1420,${horizon + 170} ${W},${horizon + 190} L${W},${horizon + 216} C1300,${horizon + 200} 900,${horizon + 230} 500,${horizon + 208} S100,${horizon + 205} 0,${horizon + 214} Z" fill="#cdb98a" opacity=".6"/>
    <path d="M0,${H - 90} C400,${H - 120} 1000,${H - 70} ${W},${H - 110} L${W},${H} L0,${H} Z" fill="#dcc795"/>
    ${rider(500, 770, 1.35, { shirt: "#2050c8", helmet: "#ffc233" })}
    ${rider(860, 748, 1.18, { shirt: "#ffffff", shorts: "#12307a", helmet: "#2f63e6", skin: "#8d5a3b", basket: false })}`,
    `<linearGradient id="a-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5b8bf5"/><stop offset=".45" stop-color="#b9cdfb"/><stop offset=".62" stop-color="#ffe3a8"/></linearGradient>
    <radialGradient id="a-glow"><stop offset="0" stop-color="#fff1c2" stop-opacity=".95"/><stop offset="1" stop-color="#ffd267" stop-opacity="0"/></radialGradient>
    <linearGradient id="a-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a3fa0"/><stop offset=".55" stop-color="#2f63e6"/><stop offset="1" stop-color="#5b8bf5"/></linearGradient>`
  );
}

/** Gulf coast at sunset: dunes, sea oats, palms, calm water, silhouetted riders. */
function gulf() {
  const rand = rng(23);
  const horizon = 500;
  let streaks = "";
  for (let i = 0; i < 22; i++) {
    const y = horizon + 10 + i * 7;
    const w = 40 + (22 - i) * 7 + rand() * 30;
    streaks += `<path d="M${f(980 - w / 2 + (rand() - 0.5) * 30)},${f(y)} h${f(w)}" stroke="#ffd79a" stroke-width="3" opacity="${f(0.85 - i * 0.03)}"/>`;
  }
  return svg(
    "gulf",
    "Illustration: riders on e-bikes crossing Gulf coast dunes at sunset, with palms and sea oats",
    `<rect width="${W}" height="${H}" fill="url(#g-sky)"/>
    <circle cx="980" cy="${horizon}" r="260" fill="url(#g-glow)"/>
    <circle cx="980" cy="${horizon}" r="92" fill="#ffe08a"/>
    ${cloud(380, 170, 1.3, 0.35)}${cloud(1300, 210, 1.1, 0.3)}
    <rect y="${horizon}" width="${W}" height="170" fill="url(#g-sea)"/>
    ${streaks}
    <path d="M0,${horizon + 160} C260,${horizon + 120} 520,${horizon + 150} 760,${horizon + 140} S1260,${horizon + 110} ${W},${horizon + 140} L${W},${H} L0,${H} Z" fill="#f3e2c4"/>
    <path d="M0,${horizon + 230} C300,${horizon + 170} 520,${horizon + 250} 820,${horizon + 215} S1300,${horizon + 190} ${W},${horizon + 230} L${W},${H} L0,${H} Z" fill="#e8d0a6"/>
    ${seaOats(120, horizon + 200, 16, rand, "#8b6f3c", "#c79a55")}
    ${seaOats(1420, horizon + 196, 18, rand, "#8b6f3c", "#c79a55")}
    ${seaOats(300, horizon + 214, 9, rand, "#8b6f3c", "#c79a55")}
    ${palm(1300, horizon + 200, 360, -60, { trunk: "#5a3d27", leaf: "#1d4a33", leafDark: "#143826" })}
    ${palm(1470, horizon + 210, 300, 40, { trunk: "#5a3d27", leaf: "#1d4a33", leafDark: "#143826" })}
    ${palm(130, horizon + 210, 330, 50, { trunk: "#5a3d27", leaf: "#1d4a33", leafDark: "#143826" })}
    ${rider(500, 800, 1.3, { shirt: "#12307a", shorts: "#0b1f4d", helmet: "#ffc233", skin: "#7a4c30", frame: "#0b1f4d" })}
    ${rider(820, 780, 1.14, { shirt: "#ff8a5b", shorts: "#12307a", helmet: "#fff", skin: "#c98e62", frame: "#0b1f4d", basket: false })}`,
    `<linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#12307a"/><stop offset=".35" stop-color="#7b5bb8"/><stop offset=".55" stop-color="#ff8a6b"/><stop offset=".7" stop-color="#ffc98a"/></linearGradient>
    <radialGradient id="g-glow"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a6b" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6a4c9c"/><stop offset=".5" stop-color="#2f4fa0"/><stop offset="1" stop-color="#1a3fa0"/></linearGradient>`
  );
}

/** The Keys: a long low bridge over turquoise shallows, mangrove islets. */
function keys() {
  const rand = rng(37);
  const deck = 540;
  let arches = "";
  for (let i = 0; i < 18; i++) {
    const x = -40 + i * 100;
    arches += `<path d="M${x},${deck + 10} q50,40 100,0" fill="none" stroke="#dfe7f5" stroke-width="10"/>
      <rect x="${x + 44}" y="${deck + 30}" width="12" height="${60}" fill="#c9d4ea"/>`;
  }
  let sparkle = "";
  for (let i = 0; i < 70; i++) {
    const x = rand() * W;
    const y = 470 + rand() * 400;
    sparkle += `<path d="M${f(x)},${f(y)} h${f(6 + rand() * 16)}" stroke="#fff" stroke-width="2" opacity="${f(0.25 + rand() * 0.45)}"/>`;
  }
  const islet = (x, y, w) =>
    `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * 0.16}" fill="#2f7a4a"/><ellipse cx="${x - w * 0.3}" cy="${y - 8}" rx="${w * 0.45}" ry="${w * 0.14}" fill="#236339"/><ellipse cx="${x + w * 0.35}" cy="${y - 6}" rx="${w * 0.38}" ry="${w * 0.12}" fill="#3a8a55"/>`;
  return svg(
    "keys",
    "Illustration: riders on e-bikes crossing a long, low bridge over turquoise water in the Florida Keys",
    `<rect width="${W}" height="${H}" fill="url(#k-sky)"/>
    ${cloud(300, 140, 1.4)}${cloud(900, 110, 1.1, 0.85)}${cloud(1360, 180, 1.3, 0.9)}${cloud(620, 250, 0.7, 0.7)}
    <rect y="460" width="${W}" height="${H - 460}" fill="url(#k-sea)"/>
    ${islet(260, 470, 150)}${islet(1250, 474, 210)}${islet(1520, 468, 90)}
    <path d="M0,720 C300,690 700,760 1000,720 S1400,690 ${W},730 L${W},${H} L0,${H} Z" fill="#6fd6d0" opacity=".45"/>
    ${sparkle}
    ${arches}
    <rect x="0" y="${deck - 6}" width="${W}" height="22" fill="#eef2fa"/>
    <rect x="0" y="${deck + 14}" width="${W}" height="6" fill="#b7c3dc"/>
    <path d="M0,${deck - 22} H${W}" stroke="#eef2fa" stroke-width="4"/>
    ${Array.from({ length: 41 }, (_, i) => `<rect x="${i * 40}" y="${deck - 22}" width="4" height="18" fill="#d6deee"/>`).join("")}
    ${palm(1180, 470, 170, -30, { leaf: "#2a7a45", leafDark: "#1d5c33" })}
    ${palm(300, 468, 150, 25, { leaf: "#2a7a45", leafDark: "#1d5c33" })}
    ${rider(620, deck - 6, 1.05, { shirt: "#2050c8", helmet: "#ffc233" })}
    ${rider(820, deck - 6, 1.05, { shirt: "#ffc233", shorts: "#0b1f4d", helmet: "#2f63e6", skin: "#8d5a3b", basket: false })}`,
    `<linearGradient id="k-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2f63e6"/><stop offset=".55" stop-color="#8fb3ff"/><stop offset="1" stop-color="#d7e6ff"/></linearGradient>
    <linearGradient id="k-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f8fb3"/><stop offset=".35" stop-color="#2fc0c6"/><stop offset="1" stop-color="#8ee6d8"/></linearGradient>`
  );
}

/** Inland Florida: a paved trail under live oaks hung with Spanish moss. */
function trail() {
  const rand = rng(51);
  return svg(
    "trail",
    "Illustration: riders on e-bikes on a paved Florida trail under live oaks hung with Spanish moss",
    `<rect width="${W}" height="${H}" fill="url(#t-sky)"/>
    <path d="M0,520 C300,470 600,520 900,480 S1400,470 ${W},500 L${W},${H} L0,${H} Z" fill="#7fae6a"/>
    <path d="M0,560 C400,520 800,580 1200,540 S1500,540 ${W},560 L${W},${H} L0,${H} Z" fill="#5f9651"/>
    ${liveOak(1180, 640, 1.05, rand)}
    ${liveOak(300, 620, 0.95, rand, { leaf: "#2b633a", dark: "#1f4a2b" })}
    ${liveOak(760, 560, 0.55, rand, { leaf: "#3d7a4a", dark: "#2f6b3f" })}
    <path d="M760,560 C700,640 520,720 260,${H} L1080,${H} C960,760 860,650 800,560 Z" fill="#b8bec9"/>
    <path d="M780,570 C740,650 640,740 560,${H}" stroke="#fff" stroke-width="5" stroke-dasharray="28 26" fill="none" opacity=".8"/>
    <path d="M0,${H - 60} C300,${H - 110} 520,${H - 70} 620,${H - 90} L560,${H} L0,${H} Z" fill="#3f7a3a"/>
    <path d="M${W},${H - 70} C1400,${H - 120} 1200,${H - 80} 1060,${H - 100} L1120,${H} L${W},${H} Z" fill="#3f7a3a"/>
    ${rider(560, 822, 1.25, { shirt: "#2050c8", helmet: "#ffc233" })}
    ${rider(820, 720, 0.86, { shirt: "#ffffff", shorts: "#12307a", helmet: "#2f63e6", skin: "#8d5a3b", basket: false })}
    <rect width="${W}" height="${H}" fill="url(#t-light)"/>`,
    `<linearGradient id="t-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fb3ff"/><stop offset=".6" stop-color="#e2ebfe"/><stop offset="1" stop-color="#fff3d4"/></linearGradient>
    <radialGradient id="t-light" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#fff3d4" stop-opacity=".25"/><stop offset="1" stop-color="#fff3d4" stop-opacity="0"/></radialGradient>`
  );
}

/** A boardwalk through the dunes to the beach, family riding. */
function boardwalk() {
  const rand = rng(67);
  const horizon = 430;
  let planks = "";
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const y = horizon + 60 + t * t * (H - horizon - 60);
    const half = 40 + t * t * 520;
    planks += `<path d="M${f(800 - half)},${f(y)} H${f(800 + half)}" stroke="#8a6440" stroke-width="${f(1 + t * 3)}" opacity=".6"/>`;
  }
  let posts = "";
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const y = horizon + 60 + t * t * (H - horizon - 60);
    const half = 40 + t * t * 520;
    const hgt = 10 + t * 70;
    posts += `<rect x="${f(800 - half - 6)}" y="${f(y - hgt)}" width="${f(3 + t * 6)}" height="${f(hgt)}" fill="#6e4f31"/>
      <rect x="${f(800 + half)}" y="${f(y - hgt)}" width="${f(3 + t * 6)}" height="${f(hgt)}" fill="#6e4f31"/>`;
  }
  return svg(
    "boardwalk",
    "Illustration: a family on e-bikes riding a wooden boardwalk through the dunes to the beach",
    `<rect width="${W}" height="${H}" fill="url(#b-sky)"/>
    ${cloud(300, 130, 1.2, 0.9)}${cloud(1200, 110, 1.4, 0.9)}${cloud(760, 200, 0.8, 0.8)}
    <rect y="${horizon}" width="${W}" height="70" fill="url(#b-sea)"/>
    <path d="M0,${horizon + 60} C300,${horizon + 40} 500,${horizon + 70} 800,${horizon + 56} S1300,${horizon + 40} ${W},${horizon + 60} L${W},${H} L0,${H} Z" fill="#f5e6c6"/>
    <path d="M0,${horizon + 120} C200,${horizon + 60} 420,${horizon + 90} 640,${horizon + 150} L640,${H} L0,${H} Z" fill="#ecd7ad"/>
    <path d="M${W},${horizon + 110} C1400,${horizon + 60} 1180,${horizon + 90} 960,${horizon + 150} L960,${H} L${W},${H} Z" fill="#ecd7ad"/>
    ${seaOats(160, horizon + 160, 22, rand, "#6f8a3c", "#b89a52")}
    ${seaOats(420, horizon + 180, 16, rand, "#6f8a3c", "#b89a52")}
    ${seaOats(1180, horizon + 170, 18, rand, "#6f8a3c", "#b89a52")}
    ${seaOats(1440, horizon + 150, 22, rand, "#6f8a3c", "#b89a52")}
    <path d="M760,${horizon + 60} L240,${H} L1360,${H} L840,${horizon + 60} Z" fill="#c9965f"/>
    ${planks}${posts}
    ${rider(640, 840, 1.2, { shirt: "#2050c8", helmet: "#ffc233" })}
    ${rider(820, 790, 0.95, { shirt: "#ff8a5b", shorts: "#12307a", helmet: "#fff", basket: false })}
    ${rider(930, 722, 0.72, { shirt: "#ffc233", shorts: "#0b1f4d", helmet: "#2f63e6", skin: "#8d5a3b", basket: false })}`,
    `<linearGradient id="b-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2f63e6"/><stop offset=".6" stop-color="#b9cdfb"/><stop offset="1" stop-color="#e2ebfe"/></linearGradient>
    <linearGradient id="b-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a3fa0"/><stop offset="1" stop-color="#2fc0c6"/></linearGradient>`
  );
}

export const SCENES = { atlantic, gulf, keys, trail, boardwalk };

/* ------------------------------------------------------------------ main */

mkdirSync(OUT, { recursive: true });
for (const [id, draw] of Object.entries(SCENES)) {
  writeFileSync(join(OUT, `${id}.svg`), draw());
  console.log(`scenes: ${id}.svg`);
}

// Open Graph cards: social networks do not render SVG, so rasterise a 1200x630
// crop of each scene with the Chromium Playwright ships.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("scenes: playwright not installed, skipping the JPEG Open Graph versions");
  process.exit(0);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const { tmpdir } = await import("node:os");
for (const id of Object.keys(SCENES)) {
  const file = join(OUT, `${id}.svg`);
  // A page on file:// so it may load the SVG beside it; about:blank may not.
  const holder = join(tmpdir(), `scene-${id}.html`);
  writeFileSync(
    holder,
    `<html><body style="margin:0"><img src="file://${file}" style="width:1200px;height:630px;object-fit:cover;display:block"></body></html>`
  );
  await page.goto(`file://${holder}`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, `${id}.jpg`), type: "jpeg", quality: 86 });
  console.log(`scenes: ${id}.jpg`);
}
await browser.close();
