// boomtown terminal: the model is drawn on, part by part, then the camera flies in and tours it.
// Everything that moves is a function of a few clocks, so a frame can be rebuilt for any time.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { build, CALLOUTS, META, ORDER, PART, LEVELS, TEXT } from 'boomtown-model';
import { sketches } from './sketch.js';
import { compile, updateRings } from './model.js';
import { G, inkMaterial, lineGeometry } from './ink.js';
import { setupLight, SUN, SUN2, aimShadows } from './paint.js';
import { createEnv, EYE, EYE_FOOT } from './env.js';
import { E, ENVU } from './envmat.js';
import { createPost } from './post.js';
import { UI } from './strings.js';
// the interface text with the model's own title, names and notes merged over it
const merge = (a, b) => { if (!b) return a; const o = { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
const STR = { en: merge(UI.en, TEXT.en), ru: merge(UI.ru, TEXT.ru || TEXT.en) };
const LOT = { x0: -20, x1: 20, z0: -11, z1: 11, h: .45, ...META.lot };
const TOP = META.top ?? 10;
import { COLOR } from './kit.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeQuick = (t) => .5 * (1 - Math.pow(1 - t, 3)) + .5 * t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const Q = new URLSearchParams(location.search);
const STILL = Q.has('t');                                   // frozen frame for captures: ?t=seconds
if (STILL) document.documentElement.classList.add('still');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── scene ────────────────────────────────────────────────────────────────
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
stage.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Interactive 3D model: ' + STR.en.ui.title);
const scene = new THREE.Scene();
// a camera with a lens: 50 mm for the frames, a little shorter at the eye on the meadow if the screen is narrow
const D2R = Math.PI / 180;
const FOV = 27;
const camera = new THREE.PerspectiveCamera(FOV, 1, .25, 3200);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true, dampingFactor: .18, rotateSpeed: .75, zoomSpeed: 3, panSpeed: 1,
  minDistance: 4, maxDistance: 280, minPolarAngle: .02, maxPolarAngle: Math.PI / 2 + .14, screenSpacePanning: true, zoomToCursor: true,
});
const focal = () => (H / 2) / Math.tan(camera.fov * D2R / 2);    // css px per metre at one metre
const post = createPost(renderer);

const parts = build();
const objs = compile(parts, scene);
const LIGHT = setupLight(scene, renderer);
const env = createEnv(scene);
const SOLIDS = objs.map((o) => o.solid).filter(Boolean);
const byId = Object.fromEntries(objs.map((o) => [o.part.id, o]));
// the ivy grows in with the planting (or with the last part, if the model has none)
const IVY = objs.find((o) => o.part.planting) || objs[objs.length - 1];
const BUILD_END = Math.max(...parts.map((p) => p.start + p.dur)) + .2;
// the show: the house builds in one second, then one unbroken camera move through the frames and parts, 24 s in all
const BUILD_TIME = 1, SHOW_LEN = 24, BUILD_RATE = BUILD_END / BUILD_TIME;
const LINES = objs.reduce((a, o) => a + (o.ink ? o.ink.geometry.attributes.instanceSeq.count : 0) + (o.fine ? o.fine.geometry.attributes.instanceSeq.count : 0) + (o.rings ? o.rings.geometry.attributes.instanceSeq.count : 0), 0);

// section planes: a vertical cut through the core (A–A) and a plan cut at 2.0 m above the deck
const CUT = { none: 1e4, section: META.cut?.section ?? (LOT.z0 + LOT.z1) / 2, plan: META.cut?.plan ?? LOT.h + 1.8 };
const CUTFAR = { section: LOT.z1 + 3, plan: TOP + 2 };
const cutPlane = G.uClip.value[0];
// the cut shows itself: a faint sheet with a dashed outline where the plane slices the model
const cutGroup = new THREE.Group(); scene.add(cutGroup);
{
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uRamp: G.uRamp, opacity: { value: .07 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uRamp[5]; uniform float opacity; varying vec2 vUv; void main(){ vec3 c = mix(uRamp[0], uRamp[4], vUv.x * .7 + vUv.y * .3); float e = smoothstep(0.0, .08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y))); gl_FragColor = vec4(c, opacity * (.4 + .6 * e));\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  sheet.renderOrder = 3; cutGroup.add(sheet);
  const seg = [];
  const dash = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay); for (let s = 0; s < L; s += .03) { const e = Math.min(L, s + .018); seg.push(ax + (bx - ax) * s / L - .5, ay + (by - ay) * s / L - .5, 0, ax + (bx - ax) * e / L - .5, ay + (by - ay) * e / L - .5, 0); } };
  dash(0, 0, 1, 0); dash(1, 0, 1, 1); dash(1, 1, 0, 1); dash(0, 1, 0, 0);
  const arr = new Float32Array(seg);
  const lg = lineGeometry(arr, new Float32Array(arr.length / 6));
  const lm = inkMaterial({ width: 1.1, opacity: .85 }); lm.clippingPlanes = []; lm.uniforms.uReveal.value = 2;
  const outline = new THREE.Mesh(lg, lm); outline.frustumCulled = false; outline.renderOrder = 3; cutGroup.add(outline);
  cutGroup.visible = false;
}
function cutViz(on) {
  cutGroup.visible = on;
  if (!on) return;
  const cx = (LOT.x0 + LOT.x1) / 2, w = LOT.x1 - LOT.x0 + 10;
  if (S.cutMode === 'plan') { cutGroup.position.set(cx, S.cutV, (LOT.z0 + LOT.z1) / 2); cutGroup.rotation.set(-Math.PI / 2, 0, 0); cutGroup.scale.set(w, LOT.z1 - LOT.z0 + 8, 1); }
  else { cutGroup.position.set(cx, (TOP + 1) / 2, S.cutV); cutGroup.rotation.set(0, 0, 0); cutGroup.scale.set(w, TOP + 2.5, 1); }
}

// ── state ────────────────────────────────────────────────────────────────
const S = {
  lang: document.documentElement.lang === 'ru' ? 'ru' : 'en',
  build: STILL ? +Q.get('t') : REDUCED ? BUILD_END : 0, playing: !STILL && !REDUCED, speed: 1,
  explode: +(Q.get('explode') || 0), explodeT: +(Q.get('explode') || 0),
  xray: +(Q.get('xray') || 0), xrayT: +(Q.get('xray') || 0),
  paint: Q.get('paint') === '0' ? 0 : 1,
  cut: Q.get('cut') || 'none', cutMode: Q.get('cut') === 'plan' ? 'plan' : 'section', cutV: 1e4,
  focus: null, hover: null, listHover: null,
  labels: Q.get('labels') !== '0',
  tour: false, tourIdx: -1, tourAt: 0, autoTour: !STILL && !REDUCED, touched: false,
  intro: !STILL && !REDUCED, introT: 0,
  time: STILL ? +Q.get('t') : 0,
  frame: Q.get('frame') || 'eye', free: false,
};
G.uPaint.value = 1; G.uColor.value = S.paint;

// ── layout: the free area between the panels, where the model is framed ──
let W = 1, H = 1, DPR = 1;
const SAFE = { l: 0, r: 1, t: 0, b: 1, cx: .5, cy: .5 };
function measure() {
  W = innerWidth; H = innerHeight;
  const L = $('.col-l'), R = $('.col-r'), dock = $('.dock'), fr = $('.frames');
  const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const u = W <= 900 ? clamp(W / 980, .72, .92) : clamp(Math.min(W / 1920, H / 1080), .6, 1.6);
  const mob = W <= 900;
  let l = 0, r = W, t = 0, b = H;
  t = vis(fr) ? fr.getBoundingClientRect().bottom : $('.wm-link').getBoundingClientRect().bottom;
  if (vis(dock)) b = dock.getBoundingClientRect().top;
  if (mob) {
    // on narrow screens the panels sit in a row under the model
    for (const c of [L, R]) if (vis(c)) { const cr = c.getBoundingClientRect(), card = [...c.children].find(vis); b = Math.min(b, card ? card.getBoundingClientRect().top : cr.top); }
  } else {
    if (vis(L)) l = L.getBoundingClientRect().right;
    if (vis(R)) r = R.getBoundingClientRect().left;
  }
  Object.assign(SAFE, { l: l + 12 * u, r: r - 12 * u, t: t + 10 * u, b: b - 12 * u, u, mob });
  SAFE.cx = (SAFE.l + SAFE.r) / 2; SAFE.cy = (SAFE.t + SAFE.b) / 2;
  // labels need room on both sides of the model at the overview
  SAFE.col = mob ? 0 : Math.min(150 * u, (SAFE.r - SAFE.l) * .12);
}
// quality: what the governor in the loop steps down through when frames run long (and back up when they are quick)
const QL = [
  { dpr: 2, env: 3, dof: true, shadowEvery: 2, near: 4096 },
  { dpr: 2, env: 2, dof: true, shadowEvery: 3, near: 2048 },
  { dpr: 1.5, env: 2, dof: false, shadowEvery: 3, near: 2048 },
  { dpr: 1.25, env: 1, dof: false, shadowEvery: 4, near: 2048 },
  { dpr: 1, env: 0, dof: false, shadowEvery: 4, near: 2048 },
];
// a big, dense screen starts one step down (the governor can still go back up)
const QUAL = { level: Q.has('q') ? clamp(+Q.get('q'), 0, QL.length - 1) : (devicePixelRatio || 1) >= 2 && innerWidth * innerHeight * devicePixelRatio ** 2 > 6.5e6 ? 1 : 0, ...QL[0] };
function applyQuality(l) {
  Object.assign(QUAL, QL[l], { level: l });
  document.documentElement.classList.toggle('lowfx', l >= 3);
  env.setQuality(QUAL.env);
  if (SUN.shadow.mapSize.x !== QUAL.near) { SUN.shadow.mapSize.set(QUAL.near, QUAL.near); if (SUN.shadow.map) { SUN.shadow.map.dispose(); SUN.shadow.map = null; } shadowDirty = true; }
  resize();
}
function resize() {
  measure();
  DPR = Math.min(devicePixelRatio || 1, QUAL.dpr);
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
  post.setSize(W, H, DPR);
  G.resolution.value.set(W, H);
  camera.aspect = W / H;
  camera.setViewOffset(W, H, -(SAFE.cx - W / 2), -(SAFE.cy - H / 2), W, H);
  camera.updateProjectionMatrix();
  E.uFocal.value = focal();
  viewCache.clear();
  layoutDirty = true;
}

// ── frames: exact framing of a set of points from a direction ────────────
// The camera looks from (theta, phi) through its lens; the points are measured in that view, the distance set to the
// nearest that keeps every one inside the free area, the target moved across so they sit centred, and again
// until it settles.
const sph = new THREE.Spherical();
const _V = new THREE.Vector3(), _R = new THREE.Vector3(), _U = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3();
function basis(theta, phi) {
  _V.setFromSphericalCoords(1, phi, theta);
  _R.crossVectors(_Y, _V); if (_R.lengthSq() < 1e-8) _R.set(Math.cos(theta), 0, -Math.sin(theta)); _R.normalize();
  _U.crossVectors(_V, _R).normalize();
}
// every part's own points (its solids' corners and its lobes), thinned to a 25 cm grid; moved with the part
const PTS = {};
for (const o of objs) {
  const seen = new Set(), out = [], add = (x, y, z) => { const k = `${Math.round(x * 4)},${Math.round(y * 4)},${Math.round(z * 4)}`; if (!seen.has(k)) { seen.add(k); out.push(x, y, z); } };
  const fp = o.part.fp; for (let i = 0; i < fp.length; i += 3) add(fp[i], fp[i + 1], fp[i + 2]);
  for (const q of o.part.spheres) { add(q.c.x + q.r, q.c.y, q.c.z); add(q.c.x - q.r, q.c.y, q.c.z); add(q.c.x, q.c.y + q.r, q.c.z); add(q.c.x, q.c.y - q.r, q.c.z); add(q.c.x, q.c.y, q.c.z + q.r); add(q.c.x, q.c.y, q.c.z - q.r); }
  if (!fp.length) { const a = o.part.ink; for (let i = 0; i < a.length; i += 3) add(a[i], a[i + 1], a[i + 2]); }
  PTS[o.part.id] = new Float32Array(out);
}
// the points of some parts in the view's basis
function inView(ids, explode, theta, phi) {
  basis(theta, phi);
  let n = 0; for (const id of ids) n += PTS[id] ? PTS[id].length / 3 : 0;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
  let k = 0;
  for (const id of ids) {
    const o = byId[id], a = PTS[id]; if (!a) continue;
    const e = ease(clamp(explode)), ex = o.part.explode ? o.part.explode : null;
    for (let i = 0; i < a.length; i += 3, k++) {
      _p.set(a[i], a[i + 1], a[i + 2]); if (ex) _p.addScaledVector(ex, e);
      X[k] = _p.dot(_R); Y[k] = _p.dot(_U); Z[k] = _p.dot(_V);
    }
  }
  return { X, Y, Z, R: _R.clone(), U: _U.clone(), V: _V.clone() };
}
function extent(ids, explode, theta, phi) {
  const { X, Y, Z, R, U, V } = inView(ids, explode, theta, phi);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < X.length; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
  return { x0, x1, y0, y1, z0, z1, R, U, V };
}
// room: css px kept free at the left and right (for labels); fill: share of the free area the points take
const viewCache = new Map();
// the frames' lens: 50 mm on a wide screen; on a tall one it widens to keep the house's width, up to 50 degrees
const frameFov = () => clamp(2 * Math.atan(Math.tan(FOV * D2R / 2) * Math.max(1, 1.6 / (W / H))) / D2R, FOV, 50);
function frameView(ids, theta, phi, { room = 0, fill = 1, explode = S.explodeT, fov = frameFov() } = {}) {
  const key = `${ids.length === ALL.length ? '*' : ids.join(',')}|${theta.toFixed(4)}|${phi.toFixed(4)}|${room.toFixed(1)}|${fill}|${explode.toFixed(3)}|${fov}`;
  const hit = viewCache.get(key); if (hit) return { ...hit, target: hit.target.clone() };
  const { X, Y, Z, R, U, V } = inView(ids, explode, theta, phi);
  const f = (H / 2) / Math.tan(fov * D2R / 2);
  const hw = Math.max(20, (SAFE.r - SAFE.l) / 2 - room) * fill, hh = Math.max(20, (SAFE.b - SAFE.t) / 2) * fill;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < X.length; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
  let tx = (x0 + x1) / 2, ty = (y0 + y1) / 2, tz = (z0 + z1) / 2, dist = 1;
  for (let it = 0; it < 7; it++) {
    dist = 0;
    for (let i = 0; i < X.length; i++) { const c = Z[i] - tz; dist = Math.max(dist, c + Math.abs(X[i] - tx) * f / hw, c + Math.abs(Y[i] - ty) * f / hh); }
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let i = 0; i < X.length; i++) { const d = Math.max(.1, dist - (Z[i] - tz)), sx = (X[i] - tx) * f / d, sy = (Y[i] - ty) * f / d; a0 = Math.min(a0, sx); a1 = Math.max(a1, sx); b0 = Math.min(b0, sy); b1 = Math.max(b1, sy); }
    tx += (a0 + a1) / 2 * dist / f; ty += (b0 + b1) / 2 * dist / f;
  }
  dist = 0;
  for (let i = 0; i < X.length; i++) { const c = Z[i] - tz; dist = Math.max(dist, c + Math.abs(X[i] - tx) * f / hw, c + Math.abs(Y[i] - ty) * f / hh); }
  const target = R.multiplyScalar(tx).add(U.multiplyScalar(ty)).add(V.multiplyScalar(tz));
  const v = { target, theta, phi, dist: Math.max(6, dist), fov };
  viewCache.set(key, v);
  return { ...v, target: target.clone() };
}
const ALL = objs.map((o) => o.part.id).filter((id) => !byId[id].part.site);   // the survey marks run far past the model
const HOUSE = ALL.filter((id) => !byId[id].part.planting);
const ISO = Math.atan(1 / Math.SQRT2);                          // true isometric: 35.26° down
const FRAMES = {
  eye: { theta: EYE.theta, phi: Math.PI / 2 + EYE.pitch },        // standing on the meadow, 1.6 m up, looking a little up
  axoL: { theta: -Math.PI / 4, phi: Math.PI / 2 - ISO },          // the classic view: from the front left
  axoR: { theta: Math.PI / 4, phi: Math.PI / 2 - ISO },
  top: { theta: 0, phi: .02 },
  front: { theta: 0, phi: Math.PI / 2 - .1 },
  back: { theta: Math.PI, phi: Math.PI / 2 - .1 },
  side: { theta: Math.PI / 2, phi: Math.PI / 2 - .1 },
};
const HOME = FRAMES.axoL;
// the eye: where it stands is fixed (the meadow is laid out round it); the lens is as long as lets the house fit
// across the free area, 45 mm on a wide screen, shorter on a narrow one
function eyeView(explode = S.explodeT) {
  const key = 'eye|' + explode.toFixed(3);
  const hit = viewCache.get(key); if (hit) return { ...hit, target: hit.target.clone() };
  const D = Math.hypot(EYE_FOOT[0], EYE_FOOT[1]);
  const target = new THREE.Vector3(0, EYE.h + D * Math.tan(EYE.pitch), 0);
  const theta = EYE.theta, phi = Math.PI / 2 + EYE.pitch, dist = D / Math.cos(EYE.pitch);
  const { X, Y, Z } = inView(HOUSE, explode, theta, phi);
  basis(theta, phi);
  const tx = target.dot(_R), ty = target.dot(_U), tz = target.dot(_V);
  // the house fills the view: its wings may run on under the side panels, which are clear glass
  const hw = (SAFE.r - SAFE.l) / 2 * (SAFE.mob ? .97 : 1.42), hh = (SAFE.b - SAFE.t) / 2 * .97;
  let f = 1e9;
  for (let i = 0; i < X.length; i++) {
    const d = dist - (Z[i] - tz), a = Math.abs(X[i] - tx), b = Math.abs(Y[i] - ty);
    if (a > 1e-3) f = Math.min(f, hw * d / a); if (b > 1e-3) f = Math.min(f, hh * d / b);
  }
  const fov = clamp(2 * Math.atan((H / 2) / f) / D2R, 26, 64);
  const v = { target, theta, phi, dist, fov, eye: true };
  viewCache.set(key, v);
  return { ...v, target: target.clone() };
}
function homeView(explode = S.explodeT, key = S.frame || 'axoL') {
  if (key === 'eye') return eyeView(explode);
  const f = FRAMES[key] || HOME, axo = key === 'axoL' || key === 'axoR';
  // on a phone the crowns may run a little past the edges, so the house itself reads larger
  return frameView(ALL, f.theta, f.phi, { room: axo ? SAFE.col : 0, fill: (axo ? 1 : .96) * (SAFE.mob ? 1.12 : 1), explode });
}
let fly = null;
function curView() {
  sph.setFromVector3(camera.position.clone().sub(controls.target));
  return { target: controls.target.clone(), theta: sph.theta, phi: sph.phi, dist: sph.radius, fov: camera.fov };
}
function flyTo(v, dur = .85) {
  const from = curView();
  let dt = v.theta - from.theta; dt = Math.atan2(Math.sin(dt), Math.cos(dt));
  fly = { from, to: { ...v, theta: from.theta + dt }, t: 0, dur: STILL ? 1e-6 : dur };
}
function placeCamera(target, theta, phi, dist, fov = camera.fov) {
  controls.target.copy(target);
  camera.position.setFromSphericalCoords(dist, phi, theta).add(target);
  // never under the turf
  if (camera.position.y < .9) camera.position.y = .9;
  camera.lookAt(target);
  if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); E.uFocal.value = focal(); }
}
function partView(id) {
  const o = byId[id];
  const v = o.part.view || { az: HOME.theta, el: .45 };
  // the deck and the planting span the whole site: framed like the overview
  const big = !!o.part.big;
  const theta = v.az, phi = Math.PI / 2 - v.el;
  return frameView(big ? ALL : [id], theta, phi, { room: SAFE.col * 1.4, fill: big ? 1 : .82 });
}

// ── focus, hover, tour ───────────────────────────────────────────────────
function focus(id, from = 'user') {
  if (from === 'user') stopTour();
  if (!id || id === S.focus && from === 'user') { S.focus = null; flyTo(homeView()); }
  else { S.focus = id; flyTo(partView(id), .9); }
  ui.focusChanged();
}
// the tour: one unbroken camera move through the frames (f:…) and parts close up, back to the meadow at the end.
// The views are knots of a Catmull-Rom spline parameterised by time (Barry-Goldman), over the target, azimuth,
// polar angle, log distance and lens; each leg gets time by how far the eye travels, so the speed stays even,
// and the camera only eases at the very start and the very end. It never stops between views.
const TOUR = META.tour || ['f:axoR', ...ORDER.filter((id) => !byId[id]?.part.big).slice(0, 6), 'f:top', 'f:front', 'f:axoL', 'f:eye'];
let show = null;
const viewOf = (id) => id.startsWith('f:') ? homeView(0, id.slice(2)) : partView(id);
const knot = (v) => [v.target.x, v.target.y, v.target.z, v.theta, v.phi, Math.log(v.dist), v.fov];
function startTour(len = SHOW_LEN - BUILD_TIME) {
  const keys = [{ id: null, v: curView() }, ...TOUR.map((id) => ({ id, v: viewOf(id) }))];
  for (let i = 1; i < keys.length; i++) { let d = keys[i].v.theta - keys[i - 1].v.theta; d = Math.atan2(Math.sin(d), Math.cos(d)); keys[i].v.theta = keys[i - 1].v.theta + d; }
  const w = [], pull = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i].v, b = keys[i + 1].v, md = Math.min(a.dist, b.dist);
    const sweep = Math.abs(b.theta - a.theta) + 1.3 * Math.abs(b.phi - a.phi);
    const shift = a.target.distanceTo(b.target) / md;
    w.push(.6 + sweep + .8 * Math.abs(Math.log(b.dist / a.dist)) + 1.3 * shift + Math.abs(b.fov - a.fov) / 25);
    pull.push(Math.min(.3, sweep * .1 + shift * .18));       // a crane lifts back a little in the middle of a long leg
  }
  const sw = w.reduce((s, x) => s + x, 0), T = [0];
  for (const x of w) T.push(T[T.length - 1] + x / sw * len);
  const P = keys.map((k) => knot(k.v)), n = P.length - 1;
  // phantom knots past both ends
  P.unshift(P[0].map((x, j) => 2 * x - P[1][j])); T.unshift(-T[1]);
  P.push(P[n + 1].map((x, j) => 2 * x - P[n][j])); T.push(2 * T[n + 1] - T[n]);
  show = { keys, P, T, pull, len, t: 0, idx: 0 };
  S.tour = true; S.tourIdx = -1; S.focus = null; controls.autoRotate = false; fly = null; ui.dockState(); ui.focusChanged();
}
function stopTour() { if (!S.tour) return; S.tour = false; show = null; ui.dockState(); }
const _sv = new THREE.Vector3();
function tourTick(dt) {
  if (!S.tour || !show) return;
  const L = show.len, ta = .6, td = 1.5, vm = L / (L - ta / 2 - td / 2);
  show.t = Math.min(L, show.t + (show.frozen ? 0 : dt));
  const t = show.t, s = t < ta ? vm * t * t / (2 * ta) : t < L - td ? vm * (t - ta / 2) : L - vm * (L - t) * (L - t) / (2 * td);
  const { P, T } = show;                  // knots 1..n+1 are the views, 0 and n+2 the phantoms
  let i = 1; while (i < T.length - 3 && s > T[i + 1]) i++;
  const t0 = T[i - 1], t1 = T[i], t2 = T[i + 1], t3 = T[i + 2];
  const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
  const v = p1.map((_, j) => {
    const A1 = ((t1 - s) * p0[j] + (s - t0) * p1[j]) / (t1 - t0);
    const A2 = ((t2 - s) * p1[j] + (s - t1) * p2[j]) / (t2 - t1);
    const A3 = ((t3 - s) * p2[j] + (s - t2) * p3[j]) / (t3 - t2);
    const B1 = ((t2 - s) * A1 + (s - t0) * A2) / (t2 - t0);
    const B2 = ((t3 - s) * A2 + (s - t1) * A3) / (t3 - t1);
    return ((t2 - s) * B1 + (s - t1) * B2) / (t2 - t1);
  });
  const u = clamp((s - t1) / (t2 - t1)), lift = 1 + show.pull[i - 1] * Math.sin(Math.PI * u) ** 2;
  placeCamera(_sv.set(v[0], v[1], v[2]), v[3], clamp(v[4], .02, Math.PI / 2 + .1), Math.exp(v[5]) * lift, v[6]);
  // the nearest view names the frame or the part being studied
  const near = s - t1 < t2 - s ? i - 1 : i;
  if (near !== show.idx && near > 0) {
    show.idx = near; S.tourIdx = near - 1;
    const id = show.keys[near].id;
    if (id.startsWith('f:')) { S.focus = null; S.frame = id.slice(2); S.free = false; } else S.focus = id;
    ui.focusChanged();
  }
  if (t >= L) { S.tour = false; show = null; S.autoTour = false; ui.dockState(); controls.autoRotate = !REDUCED && S.frame !== 'eye'; ui.frameState(); }
}
function userTouched() {
  S.touched = true; S.intro = false; S.autoTour = false; controls.autoRotate = false;
  ui?.frameState?.();
  if (fly && !fly.keep) fly = null;
  stopTour();
  $('.hint')?.classList.add('gone');
}
controls.addEventListener('start', () => { userTouched(); S.free = true; ui.frameState(); });

// picking
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pointer = null, downAt = null;
// fast ray tests against one part: its solid fill triangles (and glass), foliage as true spheres
const _wb = new THREE.Box3(), _lr = new THREE.Ray(), _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3(), _th = new THREE.Vector3(), _sp = new THREE.Sphere();
function hitPart(o, r, far, glass) {
  _wb.copy(o.box).translate(o.group.position);
  if (!r.intersectsBox(_wb)) return Infinity;
  const gp = o.group.position, clip = cutPlane.constant < 100;
  _lr.origin.copy(r.origin).sub(gp); _lr.direction.copy(r.direction);
  let best = far;
  const keep = () => !clip || cutPlane.distanceToPoint(_tc.copy(_th).add(gp)) >= 0;
  const tris = (a) => {
    for (let i = 0; i < a.length; i += 9) {
      _ta.fromArray(a, i); _tb.fromArray(a, i + 3); _tc.fromArray(a, i + 6);
      if (!_lr.intersectTriangle(_ta, _tb, _tc, false, _th)) continue;
      const d = _th.distanceTo(_lr.origin);
      if (d < best && keep()) best = d;
    }
  };
  tris(o.part.fp);
  if (glass) tris(o.part.gp);
  for (const s of o.part.spheres) {
    _sp.center.copy(s.c); _sp.radius = s.r;
    if (!_lr.intersectSphere(_sp, _th)) continue;
    const d = _th.distanceTo(_lr.origin);
    if (d < best && keep()) best = d;
  }
  return best;
}
function pick(x, y) {
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  let best = Infinity, id = null;
  for (const o of objs) {
    // parts thinned out around a studied part let clicks pass through them
    if (o.part.list === false || o.part.mono || !o.group.visible || o.reveal < .6 || o.gh > .5) continue;
    const d = hitPart(o, ray.ray, best, true);
    if (d < best) { best = d; id = o.part.id; }
  }
  return id;
}
const cv = renderer.domElement;
cv.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY, buttons: e.buttons, moved: true }; });
cv.addEventListener('pointerleave', () => { pointer = null; S.hover = null; ui.tip(null); });
cv.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cv.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  if (moved < 5 && performance.now() - downAt.t < 450) {
    const id = pick(e.clientX, e.clientY);
    userTouched();
    if (id) focus(id === S.focus ? null : id); else if (S.focus) focus(null);
  }
  downAt = null;
});
cv.addEventListener('wheel', userTouched, { passive: true });
cv.addEventListener('dblclick', () => { userTouched(); focus(null); });

// ── per-frame state of every part ────────────────────────────────────────
const lvlOf = (id) => byId[id];
// which parts stand between the camera and the studied part: rays to points on its own edges
const occRay = new THREE.Raycaster(), _od = new THREE.Vector3(), _op = new THREE.Vector3();
let occFrame = 0;
function findOccluders(dt, snap) {
  for (const o of objs) o.occT = Math.max(0, (o.occT || 0) - dt);
  const f = S.focus && byId[S.focus];
  if (!f || f.part.big || !f.samples.length) return;
  const n = f.samples.length, per = snap ? n : 6, from = snap ? 0 : (occFrame++ * per) % n;
  for (let i = 0; i < per; i++) {
    _op.copy(f.samples[(from + i) % n]).add(f.group.position);
    _od.subVectors(_op, camera.position); const dist = _od.length(); _od.multiplyScalar(1 / Math.max(1e-6, dist));
    occRay.ray.set(camera.position, _od);
    const far = Math.max(.1, dist - .35);
    for (const o of objs) {
      if (o === f || o.part.mono || !o.group.visible || o.part.planting || o.reveal < .6) continue;
      if (hitPart(o, occRay.ray, far, false) < far) o.occT = snap ? 1e3 : 1.2;
    }
  }
}
let shadowDirty = true;
function updateParts(dt, snap) {
  const k = snap ? 1e3 : 1;
  const C = G.uColor.value;                      // 1 painted, 0 drawing
  let moved = false;
  for (const o of objs) {
    const p = o.part;
    const r = clamp((S.build - p.start) / p.dur, 0, 1.3);
    o.reveal = r;
    const settle = easeOut(clamp(r * 1.25));
    const drop = (1 - settle) * (p.mono ? 0 : 1.6);
    const ex = p.explode ? p.explode.clone().multiplyScalar(ease(clamp(S.explodeT))) : new THREE.Vector3();
    const px = ex.x, py = ex.y + drop, pz = ex.z;
    if (Math.abs(o.group.position.x - px) + Math.abs(o.group.position.y - py) + Math.abs(o.group.position.z - pz) > 1e-4) moved = true;
    o.group.position.set(px, py, pz);
    const vis = r > 0;
    if (vis !== o.group.visible) moved = true;
    o.group.visible = vis;
    const focused = S.focus === p.id, other = S.focus && !focused && !p.mono;
    const hov = (S.hover === p.id || S.listHover === p.id) && !focused;
    o.hi = damp(o.hi || 0, focused ? 1 : hov ? .7 : 0, 9 * k, dt);
    o.dim = damp(o.dim || 0, other ? 1 : 0, 6 * k, dt);
    // while a part is studied, the trees and anything standing in front of it thin out to outlines
    // in an elevation the trees in front would hide the building: they stand back to a light ghost
    const elev = !S.focus && S.cut === 'none' && !S.free && (S.frame === 'front' || S.frame === 'back' || S.frame === 'side');
    o.gh = damp(o.gh || 0, other && (p.planting || o.occT > 0) || elev && p.planting ? 1 : 0, 6 * k, dt);
    const xr = S.xrayT;
    const fillA = clamp((r - .45) / .5) * (1 - xr * .9);
    // the house's own trees step out of the way completely (half-clear crowns read as green smudges)
    const ghost = 1 - o.gh * (p.planting ? 1 : .94);   // a part in front of the studied one: little more than its lines
    if (o.fill) {
      const m = o.fill.material, a = fillA * (1 - o.dim * .12) * ghost * (1 - C);
      m.uniforms.opacity.value = a;
      m.depthWrite = a > .4 && o.gh < .5;
      m.uniforms.uHi.value = o.hi * (1 - xr);
      o.fill.visible = a > .003;
    }
    if (o.solid) {
      const m = o.solid.material, a = fillA * ghost * C;
      m.opacity = a;
      m.depthWrite = a > .4 && o.gh < .5;
      m.userData.hi.value = o.hi * (1 - xr);
      m.userData.dim.value = o.dim;
      o.solid.visible = a > .003;
      const cast = a > .5;
      if (cast !== o.solid.castShadow) { o.solid.castShadow = cast; moved = true; }
      // the planting swells into place after the hard parts
      const g = o.lobes ? clamp((r - .25) / .85) * 1.35 : 2;
      if (Math.abs(m.userData.grow.value - g) > 1e-4) { m.userData.grow.value = g; moved = true; }
      if (a > .55 && o.gh < .5) o.solid.layers.enable(1); else o.solid.layers.disable(1);
    }
    if (o.glass) o.glass.material.uniforms.opacity.value = clamp((r - .55) / .45) * (1 - o.dim * .5) * (1 - xr * .5) * (1 - o.gh * .6);
    const rev = r * 1.15;
    const lineA = (1 - o.dim * .72) * (1 - o.gh * (p.planting ? 1 : .3));
    if (p.site) o.group.visible = vis && C < .98;
    if (o.ink) { const u = o.ink.material.uniforms; u.uReveal.value = rev; u.opacity.value = o.base.ink * lineA * (p.mono ? 1 - xr * .5 : 1) * (1 + xr * C * .4) * (p.site ? 1 - C : 1); u.uHi.value = o.hi; u.linewidth.value = o.base.wInk * (1 - .18 * C) + o.hi * .55; }
    if (o.fine) { const u = o.fine.material.uniforms; u.uReveal.value = rev; u.opacity.value = o.base.fine * (1 - o.dim * .78) * (1 + xr * .15); u.uHi.value = o.hi; }
    if (o.arcs) { const u = o.arcs.material.uniforms; u.uReveal.value = rev; u.opacity.value = o.base.fine * (1 - o.dim * .78) * (1 - C); o.arcs.visible = C < .999; u.uHi.value = o.hi; }
    if (o.rings) { const u = o.rings.material.uniforms; u.uReveal.value = clamp((r - .35) / .5) * 1.15; u.opacity.value = lineA * (1 - C); o.rings.visible = C < .999; u.uHi.value = o.hi; u.linewidth.value = 1.2 + o.hi * .4; }
  }
  if (moved || snap) shadowDirty = true;
}

// ── callouts: labels in two columns with leader lines to the model ───────
const coLayer = $('.callouts'), coSvg = $('.leaders');
const CO = CALLOUTS.map((c, i) => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'co'; el.tabIndex = -1;
  el.innerHTML = '<span class="co-t"></span><span class="co-e"></span>';
  el.addEventListener('mouseenter', () => { S.listHover = c.part; });
  el.addEventListener('mouseleave', () => { S.listHover = null; });
  el.addEventListener('click', () => { userTouched(); focus(c.part === S.focus ? null : c.part); });
  coLayer.appendChild(el);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const hl = document.createElementNS('http://www.w3.org/2000/svg', 'path'); hl.setAttribute('class', 'hl');
  dot.setAttribute('r', '3'); coSvg.append(hl, path, dot);
  return { part: c.part, k: c.k, o: c.o, anc: c.a, elev: c.el || '', i, el, path, hl, dot, y: null, al: 0, side: 0, occ: false, w: 0, h: 0 };
});
let coFrame = 0, layoutDirty = true;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function updateCallouts(dt, snap) {
  coFrame++;
  const u = SAFE.u;
  // overview labels belong to the axonometric: flat front, side and top views stay clean
  const camEl = Math.asin(clamp((camera.position.y - controls.target.y) / Math.max(1e-3, camera.position.distanceTo(controls.target)), -1, 1));
  const axo = camEl > .24 && camEl < 1.15;
  const show = (c) => {
    const o = byId[c.part];
    if (!o || o.reveal < .95) return false;
    if (S.focus) return c.part === S.focus;
    return S.labels && c.o && axo && !SAFE.mob && S.explodeT < .02 && S.xrayT < .5 && S.cut === 'none';
  };
  const act = [];
  for (const c of CO) {
    const want = show(c);
    c.al = damp(c.al, want ? 1 : 0, (snap ? 1e3 : 10), dt);
    if (c.al < .01) { if (c.vis !== false) { c.el.style.opacity = '0'; c.el.style.visibility = 'hidden'; c.path.setAttribute('d', ''); c.hl.setAttribute('d', ''); c.dot.style.opacity = '0'; c.vis = false; } continue; }
    const o = byId[c.part];
    const anchor = o.part.anchors[c.anc] || o.part.anchors.main || o.center;
    _w.copy(anchor).add(o.group.position);
    const hide = () => { c.al = 0; c.el.style.opacity = '0'; c.el.style.visibility = 'hidden'; c.path.setAttribute('d', ''); c.hl.setAttribute('d', ''); c.dot.style.opacity = '0'; c.vis = false; };
    if (cutPlane.constant < 100 && cutPlane.distanceToPoint(_w) < 0) { hide(); continue; }
    _v.copy(_w).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { hide(); continue; }
    c.sx = (_v.x + 1) / 2 * W; c.sy = (1 - _v.y) / 2 * H; c.world = _w.clone();
    act.push(c);
  }
  // occlusion, a few rays per frame
  if (coFrame % 4 === 0 || snap) for (const c of act) {
    const dir = c.world.clone().sub(camera.position), dist = dir.length(); dir.multiplyScalar(1 / Math.max(1e-6, dist));
    ray.ray.set(camera.position, dir);
    const far = dist - .25;
    c.occ = objs.some((o) => o.part.id !== c.part && !o.part.mono && o.group.visible && (o.fill?.material.uniforms.opacity.value || 0) > .5 && hitPart(o, ray.ray, far, false) < far);
  }
  // sides and stacking
  const midX = SAFE.cx;
  const L = [], R = [];
  for (const c of act) {
    if (c.side === 0 || snap) c.side = c.sx < midX ? -1 : 1;
    else if (c.side === -1 && c.sx > midX + 60 * u) c.side = 1;
    else if (c.side === 1 && c.sx < midX - 60 * u) c.side = -1;
    (c.side < 0 ? L : R).push(c);
  }
  const top = SAFE.t + 6 * u, bot = SAFE.b - 6 * u;
  const stack = (arr) => {
    arr.sort((a, b) => a.sy - b.sy);
    const gap = 34 * u;                               // a pill and a little air
    const ys = arr.map((c) => clamp(c.sy, top, bot));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + gap);
    if (ys.length && ys[ys.length - 1] > bot) { ys[ys.length - 1] = bot; for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - gap); }
    arr.forEach((c, i) => { c.ty = ys[i]; });
  };
  stack(L); stack(R);
  const colL = SAFE.l + (SAFE.mob ? 8 * u : 4 * u), colR = SAFE.r - (SAFE.mob ? 8 * u : 4 * u);
  for (const c of act) {
    if (c.y === null || snap || c.vis === false) c.y = c.ty; else c.y = damp(c.y, c.ty, 12, dt);
    if (c.vis === false || layoutDirty || c.dirty) { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; c.dirty = false; }
    const x = c.side < 0 ? colL : colR - c.w;
    const yTop = c.y - c.h / 2;                     // the pill sits centred on its leader
    c.el.style.transform = `translate(${x.toFixed(1)}px, ${yTop.toFixed(1)}px)`;
    c.el.style.opacity = (c.al * (c.occ ? .78 : 1)).toFixed(3);
    c.el.style.visibility = 'visible';
    c.el.classList.toggle('r', c.side > 0);
    c.el.classList.toggle('on', S.focus === c.part || S.listHover === c.part || S.hover === c.part);
    const ex = c.side < 0 ? x + c.w : x;            // the pill's inner end
    const kx = ex + c.side * -1 * 16 * u;           // elbow, a short level run out of the pill
    const d = `M${ex.toFixed(1)} ${c.y.toFixed(1)}H${kx.toFixed(1)}L${c.sx.toFixed(1)} ${c.sy.toFixed(1)}`;
    c.path.setAttribute('d', d); c.hl.setAttribute('d', d);
    c.path.style.opacity = c.al.toFixed(3); c.hl.style.opacity = (c.al * .85).toFixed(3);
    c.path.classList.toggle('occ', c.occ);
    c.path.classList.toggle('on', S.focus === c.part || S.listHover === c.part || S.hover === c.part);
    c.dot.setAttribute('cx', c.sx.toFixed(1)); c.dot.setAttribute('cy', c.sy.toFixed(1));
    c.dot.style.opacity = c.al.toFixed(3); c.dot.classList.toggle('occ', c.occ);
    c.vis = true;
  }
  layoutDirty = false;
}

// ── interface ────────────────────────────────────────────────────────────
const ui = (() => {
  const T = () => STR[S.lang];
  const list = $('#parts');
  const rows = {};
  // a material as the model paints it: a little isometric cube in its three tones (lit top, mid left, shade right)
  const TONE = { ...COLOR, planting: COLOR.leaf, glass: '#cfe6ea' };
  const mul = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const cube = (k) => { const c = TONE[k] || TONE.paper;
    return `<svg class="cube" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 14.2 5.1 8 8.6 1.8 5.1Z" fill="${c}"/><path d="M1.8 5.1 8 8.6V15.2L1.8 11.7Z" fill="${mul(c, .84)}"/><path d="M14.2 5.1 8 8.6V15.2L14.2 11.7Z" fill="${mul(c, .58)}"/><path d="M8 1.6 14.2 5.1V11.7L8 15.2 1.8 11.7V5.1ZM8 8.6V15.2M1.8 5.1 8 8.6 14.2 5.1" fill="none"/></svg>`; };
  const areaOf = (ids) => { const a = {}; for (const id of ids) { const m = byId[id]?.matArea; if (m) for (const k in m) a[k] = (a[k] || 0) + m[k]; } return a; };
  const topMat = (id) => Object.entries(areaOf([id])).sort((x, y) => y[1] - x[1])[0]?.[0] || 'paper';
  ORDER.forEach((id, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><span class="no">${String(i + 1).padStart(2, '0')}</span>${cube(topMat(id))}<span class="nm"></span><span class="el">${PART[id].el}</span><i class="pr"><b></b></i></button>`;
    li.dataset.id = id;
    const b = li.firstElementChild;
    b.addEventListener('click', () => { userTouched(); focus(id === S.focus ? null : id); });
    b.addEventListener('mouseenter', () => { S.listHover = id; });
    b.addEventListener('mouseleave', () => { S.listHover = null; });
    list.appendChild(li); rows[id] = { li, nm: li.querySelector('.nm'), pr: li.querySelector('.pr b') };
  });
  // dock
  const dock = $('.dock');
  dock.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    act(b.dataset.act);
  });
  function act(a) {
    userTouched();
    if (a === 'overview') { S.focus = null; flyTo(homeView()); focusChanged(); }
    if (a === 'explode') { S.explode = S.explode ? 0 : 1; if (!S.focus) flyTo(homeView(S.explode)); }
    if (a === 'xray') S.xray = S.xray ? 0 : 1;
    if (a === 'section') setCut(S.cut === 'section' ? 'none' : 'section');
    if (a === 'plan') setCut(S.cut === 'plan' ? 'none' : 'plan');
    if (a === 'paint') { S.paint = S.paint ? 0 : 1; }
    if (a === 'labels') S.labels = !S.labels;
    if (a === 'tour') { if (S.tour) stopTour(); else { S.focus = null; startTour(); } }
    dockState();
  }
  function setCut(c) {
    if (c !== 'none' && S.cutMode !== c) { S.cutMode = c; S.cutV = CUTFAR[c]; }
    S.cut = c;
    if (c === 'section') flyTo(frameView(ALL.filter((id) => !byId[id].part.planting), .12, Math.PI / 2 - .22, { fill: .96 }));
    if (c === 'plan') flyTo(frameView(ALL, .0001, .06, { fill: .96 }));
    if (c === 'none') { S.focus = null; flyTo(homeView()); }
    S.focus = null; focusChanged();
  }
  function dockState() {
    const on = { explode: !!S.explode, xray: !!S.xray, section: S.cut === 'section', plan: S.cut === 'plan', paint: !!S.paint, labels: S.labels, tour: S.tour, overview: false };
    $$('.dock button[data-act]').forEach((b) => { b.classList.toggle('on', !!on[b.dataset.act]); b.setAttribute('aria-pressed', on[b.dataset.act] ? 'true' : 'false'); });
  }
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const map = { e: 'explode', x: 'xray', s: 'section', p: 'plan', c: 'paint', l: 'labels', t: 'tour', o: 'overview', escape: 'overview' };
    if (map[k]) { act(map[k]); e.preventDefault(); }
    if (k === ' ') { togglePlay(); e.preventDefault(); }
    if (k === 'r') replay();
    if (/^[1-9]$/.test(k)) { userTouched(); focus(ORDER[+k - 1]); }
  });
  // assembly card
  const grad = $('.c-grad');
  const segs = $('.segs');
  ORDER.forEach(() => { const s = document.createElement('i'); s.innerHTML = '<b></b>'; segs.appendChild(s); });
  const segB = $$('.segs b');
  function replay() { S.build = 0; S.playing = true; objs.forEach((o) => { o.hi = 0; }); if (!S.focus) flyTo(homeView()); }
  function togglePlay() { if (S.build >= BUILD_END) replay(); else S.playing = !S.playing; }
  $('[data-k="replay"]').addEventListener('click', () => { userTouched(); replay(); });
  $('[data-k="play"]').addEventListener('click', () => { userTouched(); togglePlay(); });
  $('[data-k="speed"]').addEventListener('click', (e) => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? .5 : 1; e.currentTarget.querySelector('b').textContent = '×' + (S.speed === .5 ? '½' : S.speed); });
  let scrub = false;
  const scrubTo = (e) => { const r = segs.getBoundingClientRect(); S.build = clamp((e.clientX - r.left) / r.width) * BUILD_END; S.playing = false; };
  segs.addEventListener('pointerdown', (e) => { scrub = true; segs.setPointerCapture(e.pointerId); userTouched(); scrubTo(e); });
  segs.addEventListener('pointermove', (e) => { if (scrub) scrubTo(e); });
  segs.addEventListener('pointerup', () => { scrub = false; });
  // frames: the tabs under the wordmark, the turntable and the zoom
  const tabs = $$('.frames [data-f]');
  function setFrame(key, dur = .85) {
    S.frame = key; S.focus = null; S.free = false;
    if (S.cut !== 'none') { S.cut = 'none'; }
    flyTo(homeView(S.explodeT, key), dur);
    focusChanged();
  }
  function frameState() {
    const t = T();
    tabs.forEach((b) => { const on = b.dataset.f === S.frame && !S.focus && S.cut === 'none' && !S.free; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    $('.f-spin').classList.toggle('on', !!controls.autoRotate);
    const cap = S.focus ? `${t.ui.fcap.focus} · ${t.name[S.focus]}` : S.cut !== 'none' ? t.ui.fcap[S.cut] : S.free ? t.ui.fcap.free : t.ui.fcap[S.frame];
    $('.f-cap').textContent = cap;
    // the title block names the drawing on screen: the house and the kind of view
    $('[data-t=drawingV]').textContent = `${t.ui.title} · ${S.focus ? t.ui.fcap.focus : cap.split(' · ')[0]}`;
  }
  tabs.forEach((b) => b.addEventListener('click', () => { userTouched(); setFrame(b.dataset.f); }));
  $('.f-spin').addEventListener('click', () => {
    const on = !controls.autoRotate; userTouched();
    if (on && (S.focus || S.cut !== 'none' || S.frame === 'eye')) setFrame(S.frame === 'eye' ? 'axoL' : S.frame);
    controls.autoRotate = on; frameState();
  });
  const fitDist = () => homeView(S.explodeT, S.frame).dist;
  $$('.frames [data-z]').forEach((b) => b.addEventListener('click', () => {
    userTouched();
    const v = curView(), k = b.dataset.z === '+' ? 1 / 1.5 : 1.5;
    flyTo({ ...v, dist: clamp(v.dist * k, controls.minDistance, controls.maxDistance) }, .3);
  }));
  $('.f-pct').addEventListener('click', () => { userTouched(); setFrame(S.frame, .7); });
  // tooltip
  const tipEl = $('.tip');
  function tip(id, x, y) {
    if (!id) { tipEl.classList.remove('on'); return; }
    tipEl.querySelector('b').textContent = T().name[id];
    tipEl.querySelector('i').textContent = PART[id].el;
    tipEl.querySelector('span').textContent = T().ui.tipClick;
    tipEl.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 18)}px)`;
    tipEl.classList.add('on');
  }
  // inspector
  const insp = $('.c-insp');
  function focusChanged() { dockState(); inspect(); frameState(); document.body.classList.toggle('focusing', !!S.focus); for (const id of ORDER) rows[id].li.classList.toggle('on', S.focus === id); }
  let lastInspect = '';
  function inspect() {
    const id = S.focus || S.listHover || S.hover || null;
    const key = id + S.lang;
    if (key === lastInspect) return; lastInspect = key;
    const t = T();
    insp.classList.toggle('ov', !id);
    if (!id) {
      $('.i-code').textContent = (META.code || 'BT') + '-00';
      $('.i-name').textContent = t.ui.overview;
      $('.i-el b').textContent = '+' + TOP.toFixed(2);
      $('.i-note').textContent = t.ui.focusHint;
      const st = $('.i-rows');
      const ru = S.lang === 'ru';
      st.innerHTML = [...(t.stats || []).slice(0, 3), [t.ui.stats.lines, LINES.toLocaleString('en').replace(/,/g, ' ')]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      markLevel(null, TOP);
      palette(ALL);
      return;
    }
    const info = t.info[id], P = PART[id];
    $('.i-code').textContent = P.code;
    $('.i-name').textContent = t.name[id];
    $('.i-el b').textContent = P.el;
    $('.i-note').textContent = info.note;
    $('.i-rows').innerHTML = [[t.ui.rows.size, info.size], [t.ui.rows.mass, P.mass ? (S.lang === 'ru' ? (P.mass < 1 ? (P.mass * 1000).toFixed(0) + ' кг' : P.mass.toFixed(1).replace('.', ',') + ' т') : (P.mass < 1 ? (P.mass * 1000).toFixed(0) + ' kg' : P.mass.toFixed(1) + ' t')) : '—'], [t.ui.rows.mat, info.mat], [t.ui.rows.qty, info.qty], [t.ui.rows.trade, info.trade]]
      .map(([k, v], i) => `<div class="${i === 2 ? 'w' : ''}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    markLevel(id, parseFloat(P.el));
    palette([id]);
  }
  // the palette: the part's materials as a bar of their painted tones, the four largest named with a cube
  function palette(ids) {
    const t = T(), a = areaOf(ids), tot = Object.values(a).reduce((x, y) => x + y, 0) || 1;
    const e = Object.entries(a).filter(([, v]) => v / tot > .004).sort((x, y) => y[1] - x[1]);
    $('.m-bar').innerHTML = e.map(([k, v]) => { const c = TONE[k] || TONE.paper;
      return `<i style="flex:${(v / tot).toFixed(4)};background:linear-gradient(180deg,${c} 0 46%,${mul(c, .84)} 46% 74%,${mul(c, .58)} 74%)" title="${t.ui.matN[k] || k}"></i>`; }).join('');
    $('.m-leg').innerHTML = e.slice(0, 4).map(([k, v]) => `<li>${cube(k)}<span>${t.ui.matN[k] || k}</span><b>${Math.max(1, Math.round(100 * v / tot))}%</b></li>`).join('');
  }
  // a small front elevation (seen from the south) with the element picked out
  const elev = $('.elev'), kplan = $('.kplan');
  {
    const sk = sketches(parts, ORDER, LOT, TOP, CUT.section);
    elev.setAttribute('viewBox', sk.elev.viewBox);
    elev.innerHTML = `<defs><linearGradient id="elg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#e43a33"/><stop offset=".6" stop-color="#c8336f"/><stop offset="1" stop-color="#7c22a0"/></linearGradient>
      <linearGradient id="elk" x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#e43a33"/><stop offset="1" stop-color="#a82c92"/></linearGradient></defs>
      <line class="gl" x1="${sk.elev.x0}" x2="${sk.elev.x1}" y1="0" y2="0" stroke="rgb(62 38 74 / .35)" stroke-width=".05"/>
      <line class="lvl" x1="${sk.elev.x0}" x2="${sk.elev.x1}" y1="0" y2="0"/>` + sk.elev.html;
    kplan.setAttribute('viewBox', sk.plan.viewBox);
    kplan.innerHTML = `<defs><linearGradient id="kpg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#e43a33"/><stop offset=".6" stop-color="#c8336f"/><stop offset="1" stop-color="#7c22a0"/></linearGradient></defs>` + sk.plan.html;
  }
  const lvlLine = elev.querySelector('.lvl');
  function markLevel(id, v) {
    for (const svg of [elev, kplan]) {
      svg.classList.toggle('all', !id);
      svg.querySelectorAll('g[data-p]').forEach((g) => g.classList.toggle('on', g.dataset.p === id));
    }
    lvlLine.setAttribute('y1', -v); lvlLine.setAttribute('y2', -v);
    lvlLine.classList.toggle('on', !!id);
    const lv = LEVELS.reduce((a, l) => Math.abs(l.v - v) < Math.abs(a.v - v) ? l : a, LEVELS[0]);
    $('.i-lvn').textContent = id ? T().lv[lv.k] : T().ui.stats.height;
  }
  // language
  function lang(l) {
    S.lang = l; const t = T();
    $$('[data-t]').forEach((e) => { const v = e.dataset.t.split('.').reduce((a, k) => a && a[k], t.ui); if (typeof v === 'string') e.textContent = v; });
    tabs.forEach((b) => { b.textContent = t.ui.frames[b.dataset.f]; });
    frameState();
    $$('[data-lv]').forEach((e) => { e.textContent = t.lv[e.dataset.lv]; });
    for (const id of ORDER) rows[id].nm.textContent = t.name[id];
    for (const c of CO) { c.el.querySelector('.co-t').textContent = t.co[c.k]; c.el.querySelector('.co-e').textContent = c.elev; c.el.classList.toggle('noe', !c.elev); c.dirty = true; }
    lastInspect = ''; inspect(); layoutDirty = true;
  }
  // per-frame text
  let frame = 0, lastStep = -1;
  function tick(force) {
    frame++;
    const t = T();
    // list progress and the assembly card
    let step = 0;
    for (const id of ORDER) {
      const o = byId[id], r = clamp(o.reveal / 1.0);
      rows[id].pr.style.transform = `scaleX(${r.toFixed(3)})`;
      rows[id].li.classList.toggle('done', o.reveal >= 1);
      rows[id].li.classList.toggle('live', o.reveal > 0 && o.reveal < 1);
      if (o.reveal > 0) step = ORDER.indexOf(id) + 1;
    }
    const pct = Math.round(clamp(S.build / BUILD_END) * 100);
    if (frame % 2 === 0 || force) {
      $('.g-pct b').textContent = pct;
      ORDER.forEach((id, i) => { segB[i].style.transform = `scaleX(${clamp(byId[id].reveal).toFixed(3)})`; });
      const cur = ORDER[Math.max(0, step - 1)];
      if (step !== lastStep) {
        $('.g-step').textContent = `${String(step).padStart(2, '0')} / ${ORDER.length} · ${t.name[cur]}`;
        $('#stepNo').textContent = String(step).padStart(2, '0');
        $('#stepName').textContent = t.name[cur];
        lastStep = step;
      }
      const state = S.tour ? `${t.ui.tour} ${Math.max(1, S.tourIdx + 1)}/${TOUR.length}` : S.build >= BUILD_END ? t.ui.built : S.playing ? t.ui.building : t.ui.paused;
      $('.g-state').textContent = state;
      grad.classList.toggle('run', S.playing && S.build < BUILD_END);
      $('[data-k="play"]').classList.toggle('on', S.playing && S.build < BUILD_END);
    }
    if (frame % 6 === 0 || force) {
      sph.setFromVector3(camera.position.clone().sub(controls.target));
      const az = ((THREE.MathUtils.radToDeg(sph.theta) % 360) + 360) % 360;
      const el = 90 - THREE.MathUtils.radToDeg(sph.phi);
      $('#tbCam').textContent = `${String(Math.round(az)).padStart(3, '0')}° · ${String(Math.round(el)).padStart(2, '0')}°`;
      // drawing scale at the target: px per metre vs a 96 dpi sheet
      const camDist = camera.position.distanceTo(controls.target);
      const pxPerM = focal() / Math.max(.1, camDist);
      $('.f-pct').textContent = Math.round(100 * fitDist() / Math.max(.1, camDist)) + '%';
      const lens = $('#tbLens'); if (lens) lens.textContent = Math.round(12 / Math.tan(camera.fov * D2R / 2)) + ' mm';
      const scale = Math.round((96 / .0254) / pxPerM / 10) * 10;
      $('#tbScale').textContent = '1:' + scale;
      // scale bar: the longest round length that still fits the title block
      const u = SAFE.u;
      let m = .5; for (const v of [1, 2, 5, 10, 20, 50]) if (v * pxPerM <= 64 * u) m = v;
      $('.sbar').style.setProperty('--w', Math.round(m * pxPerM) + 'px');
      $('.sbar b').textContent = String(m).replace('.', S.lang === 'ru' ? ',' : '.') + (S.lang === 'ru' ? ' м' : ' m');
      $('.north').style.transform = `rotate(${(-az).toFixed(1)}deg)`;
      const d = new Date();
      $('#tbDate').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      $('#tbPhase').textContent = t.ui.phaseV[S.build >= BUILD_END ? 1 : 0];
    }
    inspect();
  }
  return { tip, focusChanged, dockState, lang, tick, inspect, frameState, fitDist };
})();

// language from the header switch
addEventListener('bt:lang', (e) => ui.lang(e.detail));
ui.lang(S.lang);

// ── the trees of the place stand back when they come between the eye and what it studies ──
const _ln = new THREE.Line3(), _cp = new THREE.Vector3(), _aim = new THREE.Vector3();
function ghostTrees(dt, snap) {
  const H8 = ENVU.uHide.value;
  const low = camera.position.y < 4.5 && !S.focus;               // on the meadow the trees frame the view
  if (S.focus) _aim.copy(byId[S.focus].center).add(byId[S.focus].group.position); else _aim.copy(controls.target);
  _ln.set(camera.position, _aim);
  env.heroes.forEach((t, i) => {
    let want = 0;
    if (!low) {
      for (const [p, r] of t.probes) { _ln.closestPointToPoint(p, true, _cp); if (_cp.distanceTo(p) < r) want = 1; }
      if (camera.position.distanceTo(t.probes[0][0]) < t.probes[0][1] * 1.3) want = 1;
    }
    H8[i + 1] = snap ? want : damp(H8[i + 1], want, 5, dt);
  });
}

// ── loop ─────────────────────────────────────────────────────────────────
let last = performance.now(), hoverFrame = 0, frameNo = 0;
const _lastCam = new THREE.Vector3(1e9, 0, 0), _lastTgt = new THREE.Vector3();
// the governor: a running mean of the frame time; long frames step the quality down, a long run of quick ones up
const GOV = { avg: 16.7, at: 0, good: 0, changes: 0, since: 0 };
function govern(ms, dt) {
  if (STILL || Q.has('q') || document.hidden || ms > 1500) return;   // ?q= fixes the quality (films)            // a hidden tab or a long pause says nothing
  ms = Math.min(ms, 100);
  GOV.avg += (ms - GOV.avg) * .12;
  GOV.since += dt; GOV.at += dt;
  if (GOV.at < 1.2) return;                                       // the first moments compile shaders
  if (GOV.avg > 20 && GOV.since > .7 && QUAL.level < QL.length - 1) {
    applyQuality(Math.min(QL.length - 1, QUAL.level + (GOV.avg > 34 ? 2 : 1))); GOV.since = 0; GOV.good = 0; GOV.changes++; GOV.avg = 16.7;
  } else if (GOV.avg < 12) { GOV.good += dt; if (GOV.good > 6 && QUAL.level > 0 && GOV.changes < 6) { applyQuality(QUAL.level - 1); GOV.since = 0; GOV.good = 0; GOV.changes++; } }
  else GOV.good = 0;
}
const _eyeP = new THREE.Vector3();
function introLook(k) {
  const h = eyeView();
  _eyeP.setFromSphericalCoords(h.dist, h.phi, h.theta).add(h.target);
  const th = h.theta - .07 * (1 - k), ph = h.phi - .055 * (1 - k);
  placeCamera(_eyeP.clone().sub(new THREE.Vector3().setFromSphericalCoords(h.dist, ph, th)), th, ph, h.dist, h.fov);
}
function frame(now, snap = false) {
  const ms = now - last;
  const dt = Math.min(.05, ms / 1000); last = now;
  const dtw = Math.min(.25, ms / 1000);   // the show's clock keeps to the wall clock, so it lasts 24 s on a slow computer too
  frameNo++;
  govern(ms, dt);
  if (!STILL) S.time += dt;
  G.uTime.value = S.time;
  // assembly clock
  if (S.playing) { S.build += dtw * S.speed * BUILD_RATE; if (S.build >= BUILD_END) { S.build = BUILD_END; S.playing = false; } }
  // eased toggles
  S.explodeT = snap ? S.explode : damp(S.explodeT, S.explode, 4.2, dt);
  S.xrayT = snap ? S.xray : damp(S.xrayT, S.xray, 6, dt);
  G.uColor.value = snap ? S.paint : damp(G.uColor.value, S.paint, 5, dt);
  if (Math.abs(G.uColor.value - S.paint) < 1e-3) G.uColor.value = S.paint;
  post.uniforms.uOn.value = G.uColor.value;
  if (S.cut !== 'none') { if (S.cutV > 100) S.cutV = CUTFAR[S.cut]; S.cutV = snap ? CUT[S.cut] : damp(S.cutV, CUT[S.cut], 3.0, dt); }
  else if (S.cutV < 100) { S.cutV = snap ? 1e4 : damp(S.cutV, CUTFAR[S.cutMode] + .5, 3.0, dt); if (S.cutV > CUTFAR[S.cutMode]) S.cutV = 1e4; }
  cutPlane.normal.set(0, S.cutMode === 'plan' ? -1 : 0, S.cutMode === 'plan' ? 0 : -1);
  cutPlane.constant = S.cutV;
  cutViz(S.cutV < 100);
  // intro: standing on the meadow while the house draws itself; the eye stays put and slowly lifts its gaze
  // from the grass and turns to the house
  if (S.intro && !fly) {
    S.introT += dtw;
    introLook(easeOut(clamp(S.introT / BUILD_TIME)));
    if (S.introT >= BUILD_TIME) S.intro = false;
  }
  if (S.autoTour && !S.tour && !S.intro && S.build >= BUILD_END && !S.touched) { S.autoTour = false; startTour(); }
  tourTick(dtw);
  // flights
  if (fly) {
    fly.t += dt / fly.dur;
    const k = easeQuick(clamp(fly.t));
    const a = fly.from, b = fly.to;
    const tg = a.target.clone().lerp(b.target, k);
    const lift = Math.sin(Math.PI * k) * Math.min(.18, Math.abs(b.theta - a.theta) * .1);
    // the distance eases on a log scale, with a little pull back in the middle of a long move, as a camera on a crane
    const pull = 1 - Math.sin(Math.PI * k) * Math.min(.22, Math.abs(b.theta - a.theta) * .12 + Math.abs(b.phi - a.phi) * .2);
    placeCamera(tg, a.theta + (b.theta - a.theta) * k, Math.max(.02, a.phi + (b.phi - a.phi) * k - lift), a.dist * Math.pow(b.dist / a.dist, k) / pull, a.fov + (b.fov - a.fov) * k);
    if (fly.t >= 1) fly = null;
  } else if (!S.intro) {
    controls.update(dt);
    if (camera.position.y < .9) { camera.position.y = .9; camera.lookAt(controls.target); }
  }
  camera.updateMatrixWorld();
  const camDist = camera.position.distanceTo(controls.target);
  G.uDetail.value = clamp((focal() / camDist - 16) / 44);
  // the place: its own clock and wind (both still under reduced motion), the sky round the eye, ivy with the planting
  if (STILL) E.uEnvT.value = S.time; else if (!REDUCED) E.uEnvT.value += dt;
  E.uWindOn.value = REDUCED ? 0 : 1;
  env.update(camera, focal(), frameNo);
  env.setIvy(clamp((IVY.reveal - .05) / .95));
  // depth of field at the eye's height, focused where it looks
  post.uniforms.uDof.value = QUAL.dof ? clamp((5 - camera.position.y) / 2.6) * G.uColor.value : 0;
  post.uniforms.uFocus.value = camDist;
  ghostTrees(dt, snap);
  findOccluders(dt, snap);
  updateParts(dt, snap);
  updateRings(objs, camera);
  // shadows: both cascades follow the view; while the wind blows the fine one is redrawn so the dapples move
  aimShadows(camera, controls.target, W / Math.max(1, H));
  const camMoved = _lastCam.distanceToSquared(camera.position) > 1e-6 || _lastTgt.distanceToSquared(controls.target) > 1e-6;
  _lastCam.copy(camera.position); _lastTgt.copy(controls.target);
  const windy = !REDUCED && !STILL && G.uColor.value > .02;
  if (shadowDirty || snap || (camMoved || windy) && frameNo % QUAL.shadowEvery === 0) SUN.shadow.needsUpdate = true;
  if (shadowDirty || snap || (camMoved || windy) && frameNo % (QUAL.shadowEvery * 4) === 0) SUN2.shadow.needsUpdate = true;
  shadowDirty = false;
  // hover: test again when the pointer moves, and now and then while the camera drifts under it
  if (pointer && !pointer.buttons && (++hoverFrame % 12 === 0 || pointer.moved && hoverFrame % 2 === 0)) {
    pointer.moved = false;
    const id = pick(pointer.x, pointer.y);
    if (id !== S.hover) { S.hover = id; cv.style.cursor = id ? 'pointer' : ''; }
    ui.tip(id, pointer.x, pointer.y);
  } else if (pointer && pointer.buttons) ui.tip(null);
  G.uShift.value = 0;
  post.render(scene, camera, SOLIDS);
  updateCallouts(dt, snap);
  ui.tick(snap);
}
function loop(now) { frame(now); requestAnimationFrame(loop); }

addEventListener('resize', () => { resize(); if (!S.focus && !fly && !S.touched && !S.intro) { const h = homeView(); placeCamera(h.target, h.theta, h.phi, h.dist, h.fov); } });
applyQuality(QUAL.level);
{
  const h = homeView();
  if (S.intro) introLook(0);
  else placeCamera(h.target, h.theta, h.phi, h.dist, h.fov);
}
ui.dockState();
if (Q.get('focus')) focus(Q.get('focus'), 'tour');
if (Q.get('frame') && FRAMES[Q.get('frame')]) { S.frame = Q.get('frame'); const h = homeView(); placeCamera(h.target, h.theta, h.phi, h.dist, h.fov); ui.focusChanged(); }
ui.frameState();
if (STILL) {
  // a still: settle the camera and every eased value, then draw twice so the outlines face the camera
  if (Q.get('cut')) ui.dockState();
  // ?show=<s>: the camera of the show at that second (the house built), for stills of the tour
  if (Q.has('show')) { S.build = BUILD_END; S.frame = 'eye'; const h = eyeView(); placeCamera(h.target, h.theta, h.phi, h.dist, h.fov); startTour(); show.t = Math.max(0, +Q.get('show') - BUILD_TIME); if (show) show.frozen = true; tourTick(0); }
  for (let i = 0; i < 3; i++) { if (fly) fly.t = 1; frame(performance.now(), true); }
  window.__done = true;
} else {
  // compile every program before the first frame, so the first seconds do not stutter
  const go = () => requestAnimationFrame((t) => { last = t; document.documentElement.classList.add('live'); loop(t); });
  (renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve()).then(go);
}

// capture hooks
window.BT = { S, SAFE, extent, ALL, camera, controls, env, renderer, QUAL, GOV, applyQuality, focus, flyTo, homeView, startTour, tourTick, get show() { return show; }, frame: (t) => frame(t ?? performance.now(), true), objs,
  settle: () => { for (let i = 0; i < 3; i++) { if (fly) fly.t = 1; frame(performance.now(), true); } } };
addEventListener('bt:home', () => { userTouched(); S.focus = null; flyTo(homeView()); ui.focusChanged(); });
