// The remaining scenario types.
//
// Not everything is multi-page. `journeys/` covers tasks whose defect lives in the
// relationship between steps; this file covers the rest, each at its honest unit —
// a single rich page where the scenario IS a page property (theming, orientation,
// text spacing), a short flow where it is not.
//
// Naming note: sample content uses products, places and generic roles. It never
// labels groups of people, because these pages are public and most of them are
// deliberately broken.
import fs from 'node:fs';
import { interactionMethods, stateDependency } from './state-dependency.mjs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'scenarios');

const page = (title, body, head = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">${head}
</head>
<body><main><h1>${title}</h1>
${body}
</main><p><a href="../index.html">Back to the index</a></p></body></html>`;

const S = [
  {
    id: 'keyboard_trap', journey: 'overlay', sc: ['2.1.2'],
    needsAt: ['keyboard', 'switch'], needs: ['alternative-input', 'hands-free-switch', 'focus-support'],
    brokenNote: 'After the panel opens, its key handler cancels Tab, Shift+Tab and Escape, so keyboard focus cannot leave or dismiss it.',
    broken: `<button id="trap-trigger" type="button" onclick="document.getElementById('trap-panel').hidden=false;document.getElementById('trap-field').focus()">Open preferences</button>
<section id="trap-panel" hidden aria-labelledby="trap-title" onkeydown="if(event.key==='Tab'||event.key==='Escape')event.preventDefault()">
  <h2 id="trap-title">Preferences</h2>
  <label for="trap-field">Display name</label><input id="trap-field">
  <button type="button">Save</button>
</section>`,
    correctNote: 'The modal can be traversed, Escape closes it, and focus returns to the trigger.',
    correct: `<button id="trap-trigger-safe" type="button" onclick="document.getElementById('trap-dialog-safe').showModal()">Open preferences</button>
<dialog id="trap-dialog-safe" aria-labelledby="trap-title-safe" onclose="document.getElementById('trap-trigger-safe').focus()">
  <h2 id="trap-title-safe">Preferences</h2>
  <form method="dialog"><label for="trap-field-safe">Display name</label><input id="trap-field-safe">
  <button value="save">Save</button><button value="cancel">Cancel</button></form>
</dialog>`,
  },
  {
    // NOT 2.1.2. A keyboard trap is focus that cannot be moved AWAY from a component.
    // This page's defect is the opposite: focus never moves INTO the popover.
    //
    // #54: the popover used to be an unpositioned block, visible at load, that the
    // button did not change -- there was no overlay whose focus could be lost. It is
    // now a real positioned layer the button opens, sitting visually under the
    // trigger but placed at the END of the DOM. Focus stays on the trigger, so the
    // next Tab goes through every control behind it before reaching the popover:
    // F85 (a dialog not adjacent to its trigger in the navigation order) under 2.4.3.
    // Closing it drops focus to the document, the second half of the same defect.
    // Close is a real button, so the page no longer also fails 2.1.1 and 4.1.2.
    id: 'overlay_focus_trap', journey: 'overlay', sc: ['2.4.3'],
    needsAt: ['keyboard'],
    brokenNote: 'Fare rules opens a positioned popover beside the trigger, but the popover is '
      + 'last in the DOM and focus stays behind it: the next Tab walks through every link on '
      + 'the page before it reaches the popover, and Close drops focus to the document.',
    broken: `<button type="button" id="fare-open" aria-controls="po">Fare rules</button>
<p>Economy Light, London to Paris, one cabin bag.</p>
<p>Seat selection and checked bags can be added before check-in.</p>
<p>Your fare is held for 20 minutes.</p>
<p>Prices include taxes and airport charges.</p>
<p>Name changes are not permitted on this fare.</p>
<p><a href="#seat">Choose a seat</a> <a href="#bags">Add bags</a></p>
<p><a href="#after">Continue to payment</a></p>
<style>.popover{position:absolute;z-index:10;width:min(20rem,calc(100vw - 2rem));background:#fff;border:2px solid #30556e;padding:0 1rem;box-shadow:0 4px 12px rgba(0,0,0,.25)}</style>
<div id="po" class="popover" role="dialog" aria-labelledby="po-title" hidden>
  <h2 id="po-title">Fare rules</h2>
  <p>Changes permitted for a fee.</p>
  <button type="button" id="fare-close">Close</button>
</div>
<script>
var trigger = document.getElementById('fare-open');
var popover = document.getElementById('po');
trigger.addEventListener('click', function () {
  var r = trigger.getBoundingClientRect();
  popover.style.top = (r.bottom + scrollY + 4) + 'px';
  popover.style.left = (r.left + scrollX) + 'px';
  popover.hidden = false;
  // focus is left on the trigger
});
document.getElementById('fare-close').addEventListener('click', function () {
  popover.hidden = true;
  // and is not returned to it
});
</script>`,
    correctNote: 'The same popover, inserted straight after its trigger: opening it moves focus '
      + 'into it, Escape or Close dismisses it, and focus returns to the trigger.',
    correct: `<button type="button" id="fare-open" aria-controls="po">Fare rules</button>
<style>.popover{position:absolute;z-index:10;width:min(20rem,calc(100vw - 2rem));background:#fff;border:2px solid #30556e;padding:0 1rem;box-shadow:0 4px 12px rgba(0,0,0,.25)}</style>
<div id="po" class="popover" role="dialog" aria-labelledby="po-title" hidden>
  <h2 id="po-title">Fare rules</h2>
  <p>Changes permitted for a fee.</p>
  <button type="button" id="fare-close">Close</button>
</div>
<p>Economy Light, London to Paris, one cabin bag.</p>
<p>Seat selection and checked bags can be added before check-in.</p>
<p>Your fare is held for 20 minutes.</p>
<p>Prices include taxes and airport charges.</p>
<p>Name changes are not permitted on this fare.</p>
<p><a href="#seat">Choose a seat</a> <a href="#bags">Add bags</a></p>
<p><a href="#after">Continue to payment</a></p>
<script>
var trigger = document.getElementById('fare-open');
var popover = document.getElementById('po');
var closeButton = document.getElementById('fare-close');
function dismiss() {
  popover.hidden = true;
  trigger.focus();
}
trigger.addEventListener('click', function () {
  var r = trigger.getBoundingClientRect();
  popover.style.top = (r.bottom + scrollY + 4) + 'px';
  popover.style.left = (r.left + scrollX) + 'px';
  popover.hidden = false;
  closeButton.focus();
});
closeButton.addEventListener('click', dismiss);
popover.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') dismiss();
});
</script>`,
  },
  {
    id: 'async_validation', journey: 'async', sc: ['4.1.3', '3.3.1'],
    needsAt: ['keyboard', 'sr-nvda'],
    brokenNote: 'Validation runs after the field loses focus and writes the result into a '
      + 'plain div. Sighted users see it appear; nobody else learns it happened.',
    broken: `<label for="v1">Promo code</label><input id="v1" value="SUMMER">
<div id="r1">Checking…</div>`,
    correctNote: 'The result lands in a live region tied to the field.',
    correct: `<label for="v2">Promo code</label>
<input id="v2" value="SUMMER" aria-describedby="r2">
<p id="r2" role="status" aria-live="polite">Promo code SUMMER applied: GBP 10 off.</p>`,
  },
  {
    // 2.4.1 Bypass Blocks is about content repeated on MULTIPLE pages. A standalone
    // fixture has nothing to repeat, so the criterion does not apply here and the
    // control is right to abstain.
    id: 'infinite_scroll', journey: 'paging', sc: ['2.4.3', '4.1.3'],
    needsAt: ['keyboard', 'sr-nvda'],
    brokenNote: 'Results append on scroll with no announcement and no way to reach anything '
      + 'below the list — a keyboard user can never get past it to the footer.',
    broken: `<ul id="l1"><li>BA117</li><li>BA118</li></ul>
<div>Loading more as you scroll…</div>
<footer><a href="#terms">Terms</a></footer>`,
    correctNote: 'An explicit control to load more, the count announced, and the footer always '
      + 'reachable.',
    correct: `<ul id="l2"><li>BA117</li><li>BA118</li></ul>
<button type="button" aria-controls="l2">Show 10 more flights</button>
<p role="status" aria-live="polite">Showing 2 of 24 flights.</p>
<footer><a href="#terms">Terms</a></footer>`,
  },
  {
    id: 'data_dashboard', journey: 'data', sc: ['1.1.1', '1.3.1'],
    needsAt: ['keyboard', 'sr-nvda'], surface: 'dataviz',
    brokenNote: 'A chart as a bare SVG with no accessible name and no data equivalent. The '
      + 'numbers exist only as geometry.',
    broken: `<svg width="100%" viewBox="0 0 200 80"><rect x="10" y="30" width="30" height="50"/>
<rect x="50" y="10" width="30" height="70"/></svg>`,
    correctNote: 'Named, described, and backed by the same figures as a table.',
    correct: `<figure><figcaption id="cc">Seats sold by cabin</figcaption>
<svg width="100%" viewBox="0 0 200 80" role="img" aria-labelledby="cc" aria-describedby="ct">
<rect x="10" y="30" width="30" height="50"/><rect x="50" y="10" width="30" height="70"/></svg>
<table id="ct"><caption>Seats sold by cabin</caption>
<thead><tr><th scope="col">Cabin</th><th scope="col">Seats</th></tr></thead>
<tbody><tr><th scope="row">Economy</th><td>50</td></tr>
<tr><th scope="row">Business</th><td>70</td></tr></tbody></table></figure>`,
  },
  {
    id: 'meaningful_sequence', journey: 'navigate', sc: ['1.3.2'],
    needsAt: ['sr-nvda'],
    needs: ['nonvisual-access', 'text-and-tactile', 'memory-support', 'language-clarity'],
    brokenNote: 'CSS makes the itinerary look chronological, but the DOM is in a different '
      + 'order. A screen reader encounters boarding before check-in and security.',
    broken: `<style>.sequence{display:flex;flex-direction:column}.first{order:1}.second{order:2}.third{order:3}</style>
<ol class="sequence"><li class="third">3. Board at gate 14</li>
<li class="first">1. Check in online</li><li class="second">2. Pass security</li></ol>`,
    correctNote: 'The DOM and visual presentation use the same chronological sequence.',
    correct: `<ol><li>1. Check in online</li><li>2. Pass security</li>
<li>3. Board at gate 14</li></ol>`,
  },
  {
    id: 'live_chat', journey: 'realtime', sc: ['4.1.3', '1.3.1'],
    needsAt: ['sr-nvda', 'keyboard'],
    brokenNote: 'Incoming messages append to a div with no live region, so a screen-reader '
      + 'user never learns a reply arrived.',
    broken: `<div id="log1"><p>Agent: How can I help?</p></div>
<label for="m1">Message</label><input id="m1"><button type="button">Send</button>`,
    correctNote: 'role=log with polite announcement, and each message names its sender.',
    correct: `<div id="log2" role="log" aria-live="polite" aria-label="Conversation">
<p><strong>Agent:</strong> How can I help?</p></div>
<label for="m2">Message</label><input id="m2"><button type="submit">Send</button>`,
  },
  {
    // 1.4.4 Resize Text is about zoom and is not what this page breaks — the viewport
    // here is fine. The defect is 1.4.12 Text Spacing. Claiming both made the engine
    // look like it missed something it correctly passed.
    id: 'text_spacing', journey: 'display-adapt', sc: ['1.4.12'],
    needsAt: ['magnifier'], needs: ['reading-support', 'visual-clarity'],
    brokenNote: 'Fixed-height boxes with !important line-height. Applying the 1.4.12 text '
      + 'spacing overrides clips the content.',
    broken: `<style>.b{height:48px;overflow:hidden;line-height:1.1!important;letter-spacing:normal!important}</style>
<div class="b">Baggage allowance is one cabin bag plus one personal item per traveller.</div>`,
    correctNote: 'No fixed height, no !important on spacing, so user overrides reflow instead '
      + 'of clipping.',
    correct: `<style>.g{min-height:3rem}</style>
<div class="g">Baggage allowance is one cabin bag plus one personal item per traveller.</div>`,
  },
  {
    id: 'forced_colors', journey: 'theming', sc: ['1.4.1', '1.4.11'],
    needsAt: ['forced-colors'], needs: ['contrast-adaptation', 'visual-clarity'],
    brokenNote: 'State shown with a background image and a hard-coded colour, both discarded '
      + 'in forced-colors mode — so the selected item becomes indistinguishable.',
    broken: `<style>.sel{background:#30556e;color:#fff}
@media (forced-colors: active){.sel{background:#30556e}}</style>
<ul><li class="sel">Economy</li><li>Business</li></ul>`,
    correctNote: 'Uses system colours and a non-colour cue, so the state survives forced colours.',
    correct: `<style>.sel2{border:3px solid}
@media (forced-colors: active){.sel2{border-color:Highlight;forced-color-adjust:none;color:HighlightText;background:Highlight}}</style>
<ul><li class="sel2"><span aria-hidden="true">✓ </span>Economy <span class="sr">(selected)</span></li>
<li>Business</li></ul>`,
  },
  {
    id: 'orientation_lock', journey: 'orientation', sc: ['1.3.4', '1.4.10'],
    needsAt: ['touch'], needs: ['alternative-input', 'hands-free-switch'],
    brokenNote: 'Content locked to landscape. Someone whose device is fixed to a wheelchair '
      + 'mount in portrait cannot rotate it.',
    broken: `<style>@media (orientation: portrait){main{display:none}
body::after{content:"Please rotate your device"}}</style>
<p>Seat map.</p>`,
    correctNote: 'Works in both orientations and reflows to narrow widths.',
    correct: `<style>main{max-width:100%}</style>
<p>Seat map, usable in portrait and landscape.</p>`,
  },
  {
    // The page DOES declare lang="en", so 3.1.1 Language of Page is satisfied and the
    // engine is right to pass it. The defect is 3.1.2 Language of Parts: the Arabic
    // passage carries no lang of its own.
    id: 'rtl_mixed_language', journey: 'i18n', sc: ['3.1.2'],
    needsAt: ['sr-nvda'], needs: ['nonvisual-access', 'language-clarity'],
    brokenNote: 'A passage in another language with no lang attribute and no dir, so a screen '
      + 'reader pronounces it with the wrong voice and it renders in the wrong direction.',
    broken: `<p>Your gate is <span>البوابة ١٤</span> — please proceed.</p>`,
    correctNote: 'lang and dir on the passage, so pronunciation and direction are correct.',
    correct: `<p>Your gate is <span lang="ar" dir="rtl">البوابة ١٤</span> — please proceed.</p>`,
  },
  {
    id: 'label_in_name', journey: 'input-only', sc: ['2.5.3'],
    needsAt: ['voice-control'], needs: ['non-voice-alternative', 'alternative-input', 'nonvisual-access'],
    brokenNote: 'The visible label says "Search flights" but the accessible name is "Submit". '
      + 'A voice-control command such as "click Search flights" gets nothing — this is the '
      + 'defect voice control is uniquely blocked by.',
    broken: `<button type="button" aria-label="Submit">Search flights</button>`,
    correctNote: 'The accessible name contains the visible label.',
    correct: `<button type="button">Search flights</button>`,
  },
  {
    // #54: the list items used to be draggable="true" with no listener and no script,
    // so nothing could be dragged. The handles now really reorder the list by
    // dragging, and are ALSO operable from the keyboard (arrow keys), so 2.1.1 holds
    // and the only thing missing is a single-pointer way to do it -- 2.5.7, whose
    // Understanding document is explicit that a keyboard alternative does not
    // satisfy it. 2.5.1 is dropped: it covers path-based and multipoint gestures,
    // and its Understanding document places free-form dragging under 2.5.7.
    id: 'dragging_required', journey: 'transfer', sc: ['2.5.7'],
    needsAt: ['keyboard', 'touch', 'switch'], needs: ['error-tolerant-pointer', 'hands-free-switch', 'constrained-use'],
    brokenNote: 'Reordering the trip requires dragging a handle. The handles also respond to the '
      + 'arrow keys, so the keyboard can do it, but a single tap or click does nothing: there is '
      + 'no way to reorder with a single pointer and no dragging.',
    broken: `<p id="reorder-help">Drag a handle to change the order. From the keyboard, focus a handle and press the Up or Down arrow.</p>
<style>.legs{list-style:none;padding:0}.legs li{display:flex;align-items:center;gap:.5rem;border:1px solid #767676;margin:.25rem 0;padding:.25rem .5rem;background:#fff}.legs .handle{touch-action:none;cursor:grab}</style>
<ul id="legs" class="legs">
<li data-name="Outbound"><button type="button" class="handle" aria-describedby="reorder-help">Move Outbound</button> Outbound</li>
<li data-name="Hotel transfer"><button type="button" class="handle" aria-describedby="reorder-help">Move Hotel transfer</button> Hotel transfer</li>
<li data-name="Return"><button type="button" class="handle" aria-describedby="reorder-help">Move Return</button> Return</li>
</ul>
<p id="order-status" role="status"></p>
<script>
var list = document.getElementById('legs');
var dragging = null;
function announce() {
  document.getElementById('order-status').textContent = 'Order: '
    + Array.from(list.children, function (li) { return li.dataset.name; }).join(', ') + '.';
}
list.addEventListener('pointerdown', function (event) {
  var handle = event.target.closest('.handle');
  if (!handle) return;
  dragging = handle.closest('li');
  handle.setPointerCapture(event.pointerId);
});
list.addEventListener('pointermove', function (event) {
  if (!dragging) return;
  var over = document.elementFromPoint(event.clientX, event.clientY);
  var li = over && over.closest('#legs li');
  if (!li || li === dragging) return;
  var box = li.getBoundingClientRect();
  list.insertBefore(dragging, event.clientY < box.top + box.height / 2 ? li : li.nextSibling);
});
list.addEventListener('pointerup', function () {
  if (!dragging) return;
  dragging = null;
  announce();
});
list.addEventListener('keydown', function (event) {
  var handle = event.target.closest('.handle');
  if (!handle) return;
  var li = handle.closest('li');
  if (event.key === 'ArrowUp' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
  else if (event.key === 'ArrowDown' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
  else return;
  event.preventDefault();
  handle.focus();
  announce();
});
</script>`,
    correctNote: 'The same drag handles and arrow keys, plus Up and Down buttons on every row, so '
      + 'the same reordering takes one tap or click and no dragging.',
    correct: `<p id="reorder-help">Drag a handle to change the order. From the keyboard, focus a handle and press the Up or Down arrow.</p>
<style>.legs{list-style:none;padding:0}.legs li{display:flex;align-items:center;gap:.5rem;border:1px solid #767676;margin:.25rem 0;padding:.25rem .5rem;background:#fff}.legs .handle{touch-action:none;cursor:grab}</style>
<ul id="legs" class="legs">
<li data-name="Outbound"><button type="button" class="handle" aria-describedby="reorder-help">Move Outbound</button> Outbound <button type="button" class="up">Up</button><button type="button" class="down">Down</button></li>
<li data-name="Hotel transfer"><button type="button" class="handle" aria-describedby="reorder-help">Move Hotel transfer</button> Hotel transfer <button type="button" class="up">Up</button><button type="button" class="down">Down</button></li>
<li data-name="Return"><button type="button" class="handle" aria-describedby="reorder-help">Move Return</button> Return <button type="button" class="up">Up</button><button type="button" class="down">Down</button></li>
</ul>
<p id="order-status" role="status"></p>
<script>
var list = document.getElementById('legs');
var dragging = null;
function announce() {
  document.getElementById('order-status').textContent = 'Order: '
    + Array.from(list.children, function (li) { return li.dataset.name; }).join(', ') + '.';
}
function move(li, direction) {
  if (direction < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
  else if (direction > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
  else return false;
  announce();
  return true;
}
list.addEventListener('pointerdown', function (event) {
  var handle = event.target.closest('.handle');
  if (!handle) return;
  dragging = handle.closest('li');
  handle.setPointerCapture(event.pointerId);
});
list.addEventListener('pointermove', function (event) {
  if (!dragging) return;
  var over = document.elementFromPoint(event.clientX, event.clientY);
  var li = over && over.closest('#legs li');
  if (!li || li === dragging) return;
  var box = li.getBoundingClientRect();
  list.insertBefore(dragging, event.clientY < box.top + box.height / 2 ? li : li.nextSibling);
});
list.addEventListener('pointerup', function () {
  if (!dragging) return;
  dragging = null;
  announce();
});
list.addEventListener('keydown', function (event) {
  var handle = event.target.closest('.handle');
  if (!handle) return;
  var direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
  if (!direction) return;
  event.preventDefault();
  move(handle.closest('li'), direction);
  handle.focus();
});
list.addEventListener('click', function (event) {
  var button = event.target.closest('.up, .down');
  if (!button) return;
  move(button.closest('li'), button.classList.contains('up') ? -1 : 1);
  button.focus();
});
</script>`,
  },
  {
    // Added with #54. Dropping 2.5.1 from dragging_required (dragging is 2.5.7)
    // would have left Pointer Gestures with no ground truth at all, so it gets a
    // case that really is path-based: a swipe, whose DIRECTION decides the result.
    // The card also answers the arrow keys, so 2.1.1 holds and the only thing
    // missing is a single-pointer way to change fare.
    id: 'swipe_required', journey: 'input-only', sc: ['2.5.1'],
    needsAt: ['touch', 'switch'], needs: ['error-tolerant-pointer', 'hands-free-switch', 'constrained-use'],
    brokenNote: 'Changing fare needs a horizontal swipe on the card: the direction of the pointer '
      + 'path picks next or previous. The arrow keys also work, but a single tap or click does '
      + 'nothing, so there is no single-pointer way to do it.',
    broken: `<p id="swipe-help">Swipe left or right on the card to see another fare. From the keyboard, focus the card and press the Left or Right arrow.</p>
<style>.fares{touch-action:pan-y;user-select:none;border:2px solid #30556e;padding:0 1rem}</style>
<section id="fares" class="fares" tabindex="0" aria-label="Fares" aria-describedby="swipe-help">
<p id="fare" aria-live="polite">Economy Light, GBP 89 (1 of 3)</p>
</section>
<script>
var fares = ['Economy Light, GBP 89', 'Economy, GBP 119', 'Premium, GBP 249'];
var index = 0;
var startX = null;
var card = document.getElementById('fares');
function show(step) {
  index = (index + step + fares.length) % fares.length;
  document.getElementById('fare').textContent = fares[index] + ' (' + (index + 1) + ' of ' + fares.length + ')';
}
card.addEventListener('pointerdown', function (event) {
  startX = event.clientX;
  card.setPointerCapture(event.pointerId);
});
card.addEventListener('pointerup', function (event) {
  if (startX === null) return;
  var dx = event.clientX - startX;
  startX = null;
  if (Math.abs(dx) > 40) show(dx < 0 ? 1 : -1);
});
card.addEventListener('keydown', function (event) {
  if (event.key === 'ArrowRight') show(1);
  else if (event.key === 'ArrowLeft') show(-1);
  else return;
  event.preventDefault();
});
</script>`,
    correctNote: 'The same swipe and arrow keys, plus Previous and Next buttons, so a single tap '
      + 'or click changes fare.',
    correct: `<p id="swipe-help">Swipe left or right on the card to see another fare. From the keyboard, focus the card and press the Left or Right arrow.</p>
<style>.fares{touch-action:pan-y;user-select:none;border:2px solid #30556e;padding:0 1rem}</style>
<section id="fares" class="fares" tabindex="0" aria-label="Fares" aria-describedby="swipe-help">
<p id="fare" aria-live="polite">Economy Light, GBP 89 (1 of 3)</p>
</section>
<p><button type="button" id="fare-prev">Previous fare</button> <button type="button" id="fare-next">Next fare</button></p>
<script>
var fares = ['Economy Light, GBP 89', 'Economy, GBP 119', 'Premium, GBP 249'];
var index = 0;
var startX = null;
var card = document.getElementById('fares');
function show(step) {
  index = (index + step + fares.length) % fares.length;
  document.getElementById('fare').textContent = fares[index] + ' (' + (index + 1) + ' of ' + fares.length + ')';
}
card.addEventListener('pointerdown', function (event) {
  startX = event.clientX;
  card.setPointerCapture(event.pointerId);
});
card.addEventListener('pointerup', function (event) {
  if (startX === null) return;
  var dx = event.clientX - startX;
  startX = null;
  if (Math.abs(dx) > 40) show(dx < 0 ? 1 : -1);
});
card.addEventListener('keydown', function (event) {
  if (event.key === 'ArrowRight') show(1);
  else if (event.key === 'ArrowLeft') show(-1);
  else return;
  event.preventDefault();
});
document.getElementById('fare-prev').addEventListener('click', function () { show(-1); });
document.getElementById('fare-next').addEventListener('click', function () { show(1); });
</script>`,
  },
  {
    id: 'touch_targets', journey: 'input-only', sc: ['2.5.8', '2.5.5'],
    needsAt: ['touch', 'pointer'], needs: ['error-tolerant-pointer', 'forgiving-interface', 'constrained-use'],
    brokenNote: 'Icon controls 16px square and touching, well under the 24px minimum with no '
      + 'spacing exception.',
    // min-width/min-height MUST be reset here. fixture.css sets both to 24px so the
    // scaffolding never generates its own target-size defect — and min-* beats width,
    // so without this reset the fixture rendered at 24x24 and had no defect at all.
    // Measured: the engine was correctly passing it.
    broken: `<style>.ic{display:inline-block;width:16px;height:16px;min-width:0;min-height:0;padding:0;margin:0;background:#30556e}</style>
<a href="#a" class="ic" aria-label="Seat map"></a><a href="#b" class="ic" aria-label="Baggage"></a>`,
    correctNote: 'At least 24x24 with spacing between targets.',
    correct: `<style>.ic2{display:inline-block;width:24px;height:24px;margin:4px;background:#30556e}</style>
<a href="#a" class="ic2" aria-label="Seat map"></a><a href="#b" class="ic2" aria-label="Baggage"></a>`,
  },
  {
    id: 'pointer_cancellation', journey: 'destructive', sc: ['2.5.2'],
    needsAt: ['pointer', 'touch'],
    needs: ['error-tolerant-pointer', 'alternative-input', 'forgiving-interface', 'constrained-use'],
    brokenNote: 'The destructive action fires on pointer-down. Moving away before release '
      + 'cannot cancel an accidental press.',
    broken: `<p id="pointer-status">Booking BA117 is active.</p>
<button type="button" onpointerdown="document.getElementById('pointer-status').textContent='Booking BA117 cancelled.'">Cancel booking</button>`,
    correctNote: 'The action fires on click (after release on the same control), and an Undo '
      + 'control reverses an accidental activation.',
    correct: `<p id="pointer-status-safe">Booking BA117 is active.</p>
<button type="button" onclick="document.getElementById('pointer-status-safe').textContent='Booking BA117 cancelled.';document.getElementById('undo-cancel').hidden=false">Cancel booking</button>
<button id="undo-cancel" type="button" hidden onclick="document.getElementById('pointer-status-safe').textContent='Booking BA117 is active.';this.hidden=true">Undo cancellation</button>`,
  },
  {
    id: 'change_on_focus', journey: 'navigate', sc: ['3.2.1'],
    needsAt: ['keyboard', 'sr-nvda'],
    needs: ['focus-support', 'task-guidance', 'nonvisual-access', 'alternative-input'],
    brokenNote: 'Focusing the destination field immediately replaces the search panel with '
      + 'results. Keyboard and screen-reader users did not request the context change.',
    broken: `<section id="focus-search"><label for="focus-destination">Destination</label>
<input id="focus-destination" value="Paris" onfocus="document.getElementById('focus-search').hidden=true;document.getElementById('focus-results').hidden=false"></section>
<section id="focus-results" hidden><h2>Flights to Paris</h2><p>12 results</p></section>`,
    correctNote: 'Focus only enters the field; an explicit button applies the search and '
      + 'changes the context.',
    correct: `<label for="focus-destination-safe">Destination</label>
<input id="focus-destination-safe" value="Paris">
<button type="button" onclick="document.getElementById('focus-results-safe').hidden=false">Search flights</button>
<section id="focus-results-safe" hidden><h2>Flights to Paris</h2><p>12 results</p></section>`,
  },
  {
    id: 'change_on_input', journey: 'form-lifecycle', sc: ['3.2.2'],
    needsAt: ['keyboard', 'sr-nvda'],
    needs: ['focus-support', 'task-guidance', 'nonvisual-access', 'alternative-input'],
    brokenNote: 'Choosing a destination immediately replaces the form with the next step, '
      + 'without warning or an explicit commit action.',
    broken: `<section id="input-step-one"><label for="input-destination">Destination</label>
<select id="input-destination" onchange="document.getElementById('input-step-one').hidden=true;document.getElementById('input-step-two').hidden=false">
<option value="">Choose</option><option>Paris</option><option>Rome</option></select></section>
<section id="input-step-two" hidden><h2>Choose dates</h2></section>`,
    correctNote: 'Changing the value does not change context; an Apply button advances the '
      + 'form when the user is ready.',
    correct: `<label for="input-destination-safe">Destination</label>
<select id="input-destination-safe"><option value="">Choose</option><option>Paris</option><option>Rome</option></select>
<button type="button" onclick="document.getElementById('input-step-two-safe').hidden=false">Apply destination</button>
<section id="input-step-two-safe" hidden><h2>Choose dates</h2></section>`,
  },
  {
    id: 'error_suggestion', journey: 'form-lifecycle', uiState: 'invalid', sc: ['3.3.3'],
    needsAt: ['keyboard', 'sr-nvda'],
    needs: ['language-clarity', 'task-guidance', 'memory-support', 'nonvisual-access'],
    brokenNote: 'The error is identified and associated with the field, but gives no known '
      + 'correction format or example.',
    broken: `<label for="travel-date">Travel date</label>
<input id="travel-date" value="31-31-2026" aria-invalid="true" aria-describedby="travel-date-error">
<p id="travel-date-error" role="alert">Date is invalid.</p>`,
    correctNote: 'The associated error explains the required format and gives a valid example.',
    correct: `<label for="travel-date-safe">Travel date</label>
<input id="travel-date-safe" value="31-31-2026" aria-invalid="true" aria-describedby="travel-date-error-safe">
<p id="travel-date-error-safe" role="alert">Use DD/MM/YYYY, for example 31/12/2026.</p>`,
  },
  {
    id: 'disabled_state', journey: 'form-lifecycle', uiState: 'disabled', sc: ['4.1.2', '1.4.1'],
    needsAt: ['keyboard', 'sr-nvda'],
    brokenNote: 'A control that looks unavailable but is not marked disabled, so it is still '
      + 'focusable and activatable and its state is conveyed by colour alone.',
    broken: `<style>.off{background:#eee;color:#aaa}</style>
<button type="button" class="off" onclick="void 0">Select seat</button>`,
    correctNote: 'Genuinely disabled, with the reason available in text.',
    correct: `<button type="button" disabled aria-describedby="dz">Select seat</button>
<p id="dz">Seat selection opens 24 hours before departure.</p>`,
  },
  {
    // #54: "shake to undo" used to exist only as text, with no devicemotion listener
    // and no script, so nothing on the page responded to motion. The page now really
    // undoes the last change when the device is shaken, and offers no control that
    // does the same and no way to turn the motion response off: both halves of 2.5.4.
    id: 'motion_actuation', journey: 'input-only', sc: ['2.5.4'],
    needsAt: ['touch'], needs: ['error-tolerant-pointer', 'hands-free-switch', 'constrained-use', 'environmental-resilience'],
    brokenNote: 'Shaking the device undoes the last seat change, and shaking is the only way to '
      + 'undo it. No control does the same, and the motion response cannot be turned off, so a '
      + 'device on a mount cannot undo and an accidental jolt can.',
    broken: `<p id="seat-status" role="status">Seat 14A selected (changed from 12C).</p>
<p>Shake your device to undo the last change.</p>
<script>
var undone = false;
function undo() {
  if (undone) return;
  undone = true;
  document.getElementById('seat-status').textContent = 'Seat change undone: seat 12C selected.';
}
addEventListener('devicemotion', function (event) {
  var a = event.acceleration;
  if (!a || a.x === null) return;
  if (Math.hypot(a.x, a.y || 0, a.z || 0) > 15) undo();
});
</script>`,
    correctNote: 'An Undo button does the same thing without motion, and the shake response can '
      + 'be turned off.',
    correct: `<p id="seat-status" role="status">Seat 14A selected (changed from 12C).</p>
<button type="button" id="undo">Undo last change</button>
<p><input type="checkbox" id="shake" checked> <label for="shake">Also undo when I shake my device</label></p>
<script>
var undone = false;
function undo() {
  if (undone) return;
  undone = true;
  document.getElementById('seat-status').textContent = 'Seat change undone: seat 12C selected.';
}
document.getElementById('undo').addEventListener('click', undo);
addEventListener('devicemotion', function (event) {
  if (!document.getElementById('shake').checked) return;
  var a = event.acceleration;
  if (!a || a.x === null) return;
  if (Math.hypot(a.x, a.y || 0, a.z || 0) > 15) undo();
});
</script>`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const s of S) {
  for (const [kind, body, note] of [['broken', s.broken, s.brokenNote], ['correct', s.correct, s.correctNote]]) {
    const file = kind === 'broken' ? `${s.id}.html` : `safe_${s.id}.html`;
    const header = `<!--\n  ${s.id} — ${kind}\n  WCAG: ${s.sc.join(', ')}\n  journey: ${s.journey}\n`
      + `  input/AT most affected: ${s.needsAt.join(', ')}\n  ${note}\n-->\n`;
    const html = header + page(`${s.id} — ${kind}`, `<p>${note}</p><hr>${body}`);
    fs.writeFileSync(path.join(DIR, file), html);
    cases.push({
      id: `scenario-${kind === 'broken' ? s.id : 'safe_' + s.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `scenarios/${file}`,
      surface: s.surface || 'web',
      journey: s.journey,
      ui_state: s.uiState || 'default',
      method: ['runtime-dom', 'ax-tree', 'visual', ...interactionMethods(html)],
      ...stateDependency(html),
      input_at: s.needsAt,
      user_needs: s.needs || [],
      min_criteria: kind === 'broken' ? Object.fromEntries(s.sc.map((x) => [x, 1])) : {},
      must_not_report: kind === 'correct' ? s.sc : [],
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('scenario fixtures',
  `<p>Scenario types that are not multi-page tasks. Each is at its honest unit: a page
   where the scenario is a page property, a short flow where it is not.</p>
   <ul>${S.map((s) => `<li><a href="${s.id}.html">${s.id}</a> ·
     <a href="safe_${s.id}.html">corrected</a> — ${s.sc.join(', ')} — <em>${s.journey}</em>,
     affects ${s.needsAt.join('/')}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'scenarios.json'), JSON.stringify({
  description: 'Remaining scenario types at their honest unit. Several target an input mode '
    + 'rather than a criterion family: label_in_name is the defect voice control is uniquely '
    + 'blocked by, dragging_required the one switch access is.',
  generated: new Date().toISOString().slice(0, 10),
  counts: { scenarios: S.length, cases: cases.length },
  cases,
}, null, 2) + '\n');

console.log(`${S.length} scenarios → ${cases.length} cases`);
console.log(`journeys: ${[...new Set(S.map((s) => s.journey))].join(', ')}`);
console.log(`input/AT: ${[...new Set(S.flatMap((s) => s.needsAt))].join(', ')}`);
console.log(`criteria: ${[...new Set(S.flatMap((s) => s.sc))].sort().join(' ')}`);
