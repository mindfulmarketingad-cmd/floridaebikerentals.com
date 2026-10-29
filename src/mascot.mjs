/**
 * Sparky, the lightning-bolt mascot who sits behind the homepage finder bar.
 * Two layers share one viewBox: the body sits behind the finder form and the
 * hands sit in front of it, so he looks like he is holding on to the bar's top
 * edge (y = 120). His reactions (looking at the town field, cheering on
 * search) live in assets/js/app.js.
 */
const VB = "0 -34 150 204";

const body = `<g class="mascot__body">
    <path class="mascot__arm" d="M36 104 C 26 110, 28 114, 34 116"/>
    <path class="mascot__arm" d="M104 76 C 114 90, 110 106, 106 116"/>
    <path class="mascot__bolt" d="M40 8 L118 8 L92 62 L124 62 L56 166 L66 104 L22 104 Z"/>
    <path class="mascot__helmet" d="M34 16 Q 78 -30 124 12 Q 80 4 34 16 Z"/>
    <path class="mascot__vents" d="M62 0 L58 10 M80 -4 L80 7 M98 0 L102 9"/>
    <g class="mascot__eyes">
      <ellipse cx="57" cy="40" rx="9" ry="10.5" fill="#fff"/>
      <ellipse cx="81" cy="40" rx="9" ry="10.5" fill="#fff"/>
      <g class="mascot__pupils">
        <circle cx="58.5" cy="42" r="5"/><circle cx="82.5" cy="42" r="5"/>
        <circle cx="60.3" cy="39.8" r="1.7" fill="#fff"/><circle cx="84.3" cy="39.8" r="1.7" fill="#fff"/>
      </g>
    </g>
    <ellipse class="mascot__cheek" cx="46" cy="55" rx="5.5" ry="3.2"/>
    <ellipse class="mascot__cheek" cx="91" cy="55" rx="5.5" ry="3.2"/>
    <path class="mascot__smile" d="M58 55 Q 69 67, 80 55 Q 69 61, 58 55 Z"/>
  </g>`;

const hands = `<g class="mascot__hands">
    <g transform="translate(36 119)"><ellipse rx="9" ry="7"/><path d="M-5 -2 v6 M0 -3 v7 M5 -2 v6"/></g>
    <g transform="translate(104 119)"><ellipse rx="9" ry="7"/><path d="M-5 -2 v6 M0 -3 v7 M5 -2 v6"/></g>
  </g>`;

/** The finder form, wrapped so Sparky can sit behind it. */
export function withMascot(form) {
  return `<div class="finder-stage" data-mascot>
  <div class="mascot mascot--back" aria-hidden="true">
    <p class="mascot__say" data-mascot-say>Hi! Where are we riding today?</p>
    <svg viewBox="${VB}" focusable="false">${body}</svg>
  </div>
  ${form}
  <div class="mascot mascot--front" aria-hidden="true"><svg viewBox="${VB}" focusable="false">${hands}</svg></div>
</div>`;
}
