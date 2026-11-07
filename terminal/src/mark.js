// The @0xwast3 mark: the author's credit, and the one condition of the boomtown licence (see LICENSE).
//
// Every page, still, sheet and film boomtown makes shows it: large, opaque, above everything else and always
// moving across the frame, so it cannot be cropped out or painted over in an edit. Its place is a function of
// the clock alone, so the capture tool knows where it is in every frame and stamps its own copy on top.
// Do not remove, hide, shrink, slow, stop or cover it. tools/build.mjs and tools/capture.mjs refuse to work without it.

export const MARK_TEXT = '@0xwast3';
export const MARK_ID = 'bt-mark-0xwast3';
const ASPECT = 4.24;                 // pill width / height
const TX = 13, TY = 8.2;             // seconds for one sweep left-right-left and top-bottom-top

// size in CSS px for a viewport: a tenth of its shorter side, never under 30 px
export function markSize(vw, vh) {
  const m = Math.round(.025 * Math.min(vw, vh));
  const h = Math.max(30, Math.round(Math.min(.1 * Math.min(vw, vh), (vw - 2 * m) / ASPECT)));
  return { w: Math.round(h * ASPECT), h, m };
}

// the clock the mark follows: the page clock in ms; a still takes a time from its own address, so every still
// puts the mark somewhere else; under reduced motion it jumps every 3 s instead of gliding
export function markTime(now, { still = false, search = '', reduced = false } = {}) {
  if (still) { let h = 2166136261; for (let i = 0; i < search.length; i++) h = Math.imul(h ^ search.charCodeAt(i), 16777619) >>> 0; return h % 106600; }
  return reduced ? Math.floor(now / 3000) * 3000 : now;
}

// where the mark is at a time (ms): a slow figure across the whole frame
export function markRect(ms, vw, vh) {
  const { w, h, m } = markSize(vw, vh), s = ms / 1000;
  const fx = .5 + .5 * Math.sin(2 * Math.PI * s / TX), fy = .5 + .5 * Math.sin(2 * Math.PI * s / TY + 1.1);
  return { x: Math.round(m + fx * Math.max(0, vw - w - 2 * m)), y: Math.round(m + fy * Math.max(0, vh - h - 2 * m)), w, h };
}

// the inline style of the element that holds the mark: it resets every property first, so no stylesheet reaches it
export function markStyle(r) {
  return `all:initial!important;display:block!important;position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;`
    + `width:${r.w}px!important;height:${r.h}px!important;transform:translate(${r.x}px,${r.y}px)!important;margin:0!important;padding:0!important;border:0!important;`
    + `background:transparent!important;opacity:1!important;visibility:visible!important;z-index:2147483647!important;pointer-events:none!important;overflow:visible!important;`
    + `contain:none!important;user-select:none!important;`;
}

// the pill itself: brand gradient, white letters, a white rim
export function markInner(svg, r, shadow = true) {
  const b = Math.max(2, Math.round(r.h * .045)), th = Math.round(r.h * .5);
  return `<div style="box-sizing:border-box;width:100%;height:100%;border-radius:${r.h}px;border:${b}px solid #fff;`
    + `background:linear-gradient(115deg,#e43a33,#c8336f 55%,#7c22a0);display:flex;align-items:center;justify-content:center;`
    + (shadow ? `box-shadow:0 ${Math.round(r.h * .07)}px ${Math.round(r.h * .28)}px rgb(46 12 54 / .38);` : '')
    + `"><div style="height:${th}px;transform:translateY(${Math.round(th * .1)}px)">${svg}</div></div>`;
}

// put the mark on the page and keep it there; returns a function that places it for the current time
export function installMark(svg, opt = {}) {
  const doc = document, root = doc.documentElement;
  let host = null, shadow = null, size = '';
  const watch = new MutationObserver(() => place());          // any change to the element itself puts it right at once
  const make = () => {
    if (host) try { host.remove(); } catch (e) {}
    host = doc.createElement('div');
    host.id = MARK_ID;
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', MARK_TEXT);
    host.setAttribute('popover', 'manual');
    shadow = host.attachShadow({ mode: 'closed' });
    size = '';
    root.appendChild(host);
    watch.observe(host, { attributes: true });
  };
  const rect = () => markRect(markTime(performance.now(), { still: opt.still, search: location.search, reduced: opt.reduced }), innerWidth, innerHeight);
  function place(again = false) {
    const r = rect(), st = markStyle(r), key = r.w + 'x' + r.h;
    if (!host || host.parentNode !== root || host.id !== MARK_ID || host.shadowRoot) make();   // an open root is not ours
    let n = host.nextSibling; while (n && n.id && n.id.startsWith(MARK_ID)) n = n.nextSibling;
    if (n) root.appendChild(host);                          // always the last element of the page (but for the capture's seal)
    if (host.getAttribute('style') !== st) host.setAttribute('style', st);
    for (const a of [...host.attributes]) if (!['id', 'role', 'aria-label', 'popover', 'style'].includes(a.name)) host.removeAttribute(a.name);
    if (host.getAttribute('popover') !== 'manual') host.setAttribute('popover', 'manual');
    if (key !== size || shadow.childElementCount !== 1) { shadow.innerHTML = markInner(svg, r); size = key; }
    // the top layer: above every stacking context; raised again whenever anything else gets there
    try {
      const others = [...doc.querySelectorAll(':popover-open, :modal, :fullscreen')].some((e) => !e.id.startsWith(MARK_ID));
      if (others && host.matches(':popover-open')) host.hidePopover();
      if (!host.matches(':popover-open')) host.showPopover();
    } catch (e) {}
    const cs = getComputedStyle(host);
    if (!again && (cs.display !== 'block' || cs.visibility !== 'visible' || cs.opacity !== '1' || host.offsetWidth < r.w - 1)) { make(); place(true); }
    return r;
  }
  place();
  new MutationObserver(() => place()).observe(root, { childList: true });
  setInterval(() => place(), 250);
  addEventListener('resize', () => place());
  doc.addEventListener('fullscreenchange', () => place());
  const tick = () => { place(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return place;
}
