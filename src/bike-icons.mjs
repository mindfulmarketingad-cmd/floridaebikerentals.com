/**
 * Side-view line diagrams of each bike style for the Rent Now picker, so a
 * rider can see the difference (tire width, frame shape, wheels, cargo deck)
 * rather than read it. Drawn in a 120 x 72 box with currentColor, so they
 * follow the text colour; the e-bike battery is the one filled shape.
 */
const wheel = (cx, cy, r, w = 2.5) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="1.6" fill="currentColor" stroke="none"/>`;
const battery = (x, y, angle) =>
  `<rect x="${x}" y="${y}" width="16" height="6" rx="2" transform="rotate(${angle} ${x + 8} ${y + 3})" fill="currentColor" stroke="none" class="bike-ico__battery"/>`;
// Lightning bolt in the corner: this one has a motor.
const BOLT = `<path d="M110 3L103 14H109L105 24L115 11H109L112 3Z" fill="currentColor" stroke="none" class="bike-ico__bolt"/>`;
const crank = (x, y) => `<circle cx="${x}" cy="${y}" r="3.2"/><path d="M${x} ${y}l4 4"/>`;
const saddle = (x, y, wide = false) =>
  wide ? `<path d="M${x - 7} ${y}h12c2 0 3 1.5 1 2.5l-4 1.5h-6c-3 0-5-2-3-4z" fill="currentColor"/>` : `<path d="M${x - 6} ${y}h11l-3 2.5h-6z" fill="currentColor"/>`;

const SHAPES = {
  // Swept-back bars, curved top tube, wide saddle, battery on the down tube.
  cruiser: (e = true) => `
    ${wheel(28, 52, 15)}${wheel(94, 52, 15)}
    <path d="M28 52L56 54L47 26"/><path d="M28 52L49 31"/>
    <path d="M49 31C60 22 72 22 82 27"/><path d="M56 54C66 46 74 36 82 27"/>
    <path d="M82 27L94 52"/><path d="M82 27L80 18C78 13 70 13 68 15"/>
    ${saddle(47, 23, true)}${crank(56, 54)}${e ? battery(61, 40, -48) : ""}`,
  // Thick tires, straight frame, flat bars.
  "fat-tire": () => `
    ${wheel(28, 52, 15, 7)}${wheel(94, 52, 15, 7)}
    <path d="M28 52L56 54L48 27"/><path d="M28 52L50 31"/>
    <path d="M50 30L83 28"/><path d="M56 54L83 28"/>
    <path d="M83 28L94 52"/><path d="M83 28L82 19H74"/>
    ${saddle(48, 24)}${crank(56, 54)}${battery(62, 39, -44)}`,
  // No top tube: the frame dips low between the wheels.
  "step-through": () => `
    ${wheel(28, 52, 15)}${wheel(94, 52, 15)}
    <path d="M28 52L56 54L48 27"/><path d="M28 52L50 32"/>
    <path d="M56 54C62 56 66 56 70 50L82 27"/>
    <path d="M82 27L94 52"/><path d="M82 27L81 18C80 15 75 15 73 16"/>
    ${saddle(48, 24, true)}${crank(56, 54)}${battery(66, 39, -62)}`,
  // Larger, thinner wheels, high straight top tube, flat bars.
  hybrid: () => `
    ${wheel(27, 50, 17, 2)}${wheel(95, 50, 17, 2)}
    <path d="M27 50L56 53L49 22"/><path d="M27 50L51 26"/>
    <path d="M51 25L86 24"/><path d="M56 53L86 24"/>
    <path d="M86 24L95 50"/><path d="M86 24L86 16H78"/>
    ${saddle(49, 19)}${crank(56, 53)}${battery(63, 34, -44)}`,
  // Three wheels: two at the back on one axle, with a basket between them.
  trike: () => `
    ${wheel(22, 53, 13)}${wheel(38, 57, 13)}${wheel(98, 53, 14)}
    <path d="M22 53L38 57" stroke-width="3"/>
    <path d="M30 55L60 54L52 28"/><path d="M60 54C70 50 78 38 86 28"/>
    <path d="M86 28L98 53"/><path d="M86 28L84 19C82 15 76 15 74 16"/>
    <path d="M18 34h22l-3 10H21z"/>
    ${saddle(52, 25, true)}${crank(60, 54)}${battery(66, 40, -52)}`,
  // Long tail: small rear wheel, long rack with a child seat on it.
  cargo: () => `
    ${wheel(20, 54, 13)}${wheel(98, 52, 15)}
    <path d="M20 54L58 54L52 28"/><path d="M20 54L30 36"/>
    <path d="M12 36H50" stroke-width="3"/>
    <path d="M22 36V24C22 21 25 20 28 20H34V36" class="bike-ico__seat"/>
    <path d="M58 54C68 48 76 38 86 28"/>
    <path d="M86 28L98 52"/><path d="M86 28L84 19C82 15 76 15 74 16"/>
    ${saddle(52, 25, true)}${crank(58, 54)}${battery(63, 40, -52)}`,
  // The cruiser without a motor: no battery.
  pedal: () => SHAPES.cruiser(false),
  // Any style: a plain bike outline with a question mark.
  any: () => `
    <g opacity=".45">${wheel(28, 52, 15)}${wheel(94, 52, 15)}
    <path d="M28 52L56 54L48 27"/><path d="M28 52L50 31"/><path d="M50 30L83 28"/><path d="M56 54L83 28"/><path d="M83 28L94 52"/><path d="M83 28L82 19H74"/></g>
    <path d="M54 12c0-5 4-8 8-8s8 3 8 7c0 5-7 6-7 11" stroke-width="3.2"/><circle cx="63" cy="29" r="2.2" fill="currentColor" stroke="none"/>`,
};

const ELECTRIC = new Set(["cruiser", "fat-tire", "step-through", "hybrid", "trike", "cargo"]);

export function bikeIcon(style) {
  const draw = SHAPES[style] || SHAPES.any;
  return `<svg class="bike-ico" viewBox="0 0 120 72" width="120" height="72" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${draw()}${
    ELECTRIC.has(style) ? BOLT : ""
  }</svg>`;
}
