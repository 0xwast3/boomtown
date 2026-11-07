// The place around the house, seen from the ground: turf, clover, moss and litter; ferns, hostas, hydrangeas,
// tall grasses and ivy at the foundation; eight trees with real branches and leaf clusters; a forest ring and a
// tree line on the horizon; a sky with three cloud decks seen from below and shafts of light through the canopy.
// Every growing layer is instanced, moves in one wind field, and thins by its size on screen.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { vegMaterial, E, ENVU, ENV_GLSL, SUN_DIR, HAZE } from './envmat.js';
import { G } from './ink.js';
import { META } from 'boomtown-model';

const D2R = Math.PI / 180;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// a small value noise for placing things (the shaders have their own)
function vn(x, y) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (h(i, j) * (1 - ux) + h(i + 1, j) * ux) * (1 - uy) + (h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux) * uy;
}

// the view from the ground: where the eye stands (azimuth from the house, distance) and how far it looks up
export const EYE = { theta: META.eye?.theta ?? .3, dist: META.eye?.dist ?? 46, pitch: 4.4 * D2R, h: 1.6 };
const KM = EYE.dist / 90;   // the meadow was laid out for an eye 90 m out: things placed far down it come in by this
const DECK = { x0: -20, x1: 20, z0: -11, z1: 11, h: .45, ...META.lot };   // the model's plinth
const inDeck = (x, z, m = 0) => x > DECK.x0 - m && x < DECK.x1 + m && z > DECK.z0 - m && z < DECK.z1 + m;
const EC = [Math.sin(EYE.theta) * EYE.dist, Math.cos(EYE.theta) * EYE.dist];          // the eye's foot
export const EYE_FOOT = EC;
const FWD = [-Math.sin(EYE.theta), -Math.cos(EYE.theta)], RGT = [Math.cos(EYE.theta), -Math.sin(EYE.theta)];
const fromEye = (a, b) => [EC[0] + FWD[0] * a + RGT[0] * b, EC[1] + FWD[1] * a + RGT[1] * b];
// the garden path: from the eye's feet to the steps at the front of the deck
const PATH = (() => {
  const s = fromEye(2.4, 1.1), e = META.entrance || [(DECK.x0 + DECK.x1) / 2, DECK.z1 + .3], dx = e[0] - s[0], dz = e[1] - s[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
  return [0, 2.4, -2.0, 1.5, -.6, 0].map((o, i) => { const t = [0, .2, .42, .63, .83, 1][i]; return [s[0] + dx * t + px * o, s[1] + dz * t + pz * o]; });
})();
function pathD(x, z) {
  let d = 1e9;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1];
    const px = x - ax, pz = z - az, qx = bx - ax, qz = bz - az, h = Math.max(0, Math.min(1, (px * qx + pz * qz) / (qx * qx + qz * qz)));
    d = Math.min(d, Math.hypot(px - qx * h, pz - qz * h));
  }
  return d;
}
// the house's own trees (part of the model): planting keeps out of their trunks
const HOUSE_TREES = META.trees || [];

// ── geometry ─────────────────────────────────────────────────────────────
class GB {
  constructor() { this.p = []; this.n = []; this.s = []; this.v = []; this.m = []; this.i = []; }
  vert(p, n, sway = 0, piv = null, mat = 0) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.s.push(sway);
    if (piv) this.v.push(piv[0], piv[1], piv[2], piv[3]); else this.v.push(0, 0, 0, 0);
    this.m.push(mat); return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 1));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.v, 4));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.m, 1));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}
const ICO = [0, 1, 2].map((d) => { const g = mergeVertices(new THREE.IcosahedronGeometry(1, d)); g.computeVertexNormals(); return g; });
// a round lobe, a little lumpy, flattened below
function lobe(gb, c, r, det, sway, piv, mat, rnd, bump = .08, squash = .86) {
  const g = ICO[det], P = g.attributes.position, I = g.index, base = gb.p.length / 3, seed = rnd() * 100;
  for (let k = 0; k < P.count; k++) {
    const x = P.getX(k), y = P.getY(k), z = P.getZ(k);
    const b = 1 + bump * (vn(x * 2.3 + seed, z * 2.3 + y * 1.7) - .5) * 2;
    gb.vert(V3(c.x + x * r * b, c.y + y * r * b * (y < 0 ? squash : 1), c.z + z * r * b), V3(x, y, z), sway, piv, mat);
  }
  for (let k = 0; k < I.count; k += 3) gb.tri(base + I.getX(k), base + I.getX(k + 1), base + I.getX(k + 2));
}
// a tapered tube along points; bark crevices carried in aMat (0 ridge .. 1 crevice)
function tube(gb, pts, rad, sides, sway, seed, piv = null) {
  let prev = null, ref = V3(0, 0, 1);
  for (let i = 0; i < pts.length; i++) {
    const t = V3(0, 0, 0).subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    let a = V3(0, 0, 0).crossVectors(t, ref); if (a.lengthSq() < 1e-4) a.crossVectors(t, V3(1, 0, 0)); a.normalize();
    const b = V3(0, 0, 0).crossVectors(t, a).normalize(); ref = b.clone();
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const ang = k / sides * Math.PI * 2;
      const ridge = .5 + .5 * Math.sin(ang * 5 + seed + i * .9), cr = (1 - ridge) * (1 - ridge);
      const nrm = a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
      ring.push(gb.vert(pts[i].clone().addScaledVector(nrm, rad[i] * (1 - .14 * cr)), nrm, sway[i], piv, cr));
    }
    if (prev) for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; gb.quad(prev[k], prev[k2], ring[k2], ring[k]); }
    prev = ring;
  }
}
// a leaf: base at the origin, tip at +y, face to +z, folded along its midrib
function leafInto(gb, M, w = .3, sway0 = 0, piv = null, mat = 0, nrmW = null) {
  const pts = [[0, 0, 0], [-w, .32, .02], [-w * .8, .7, .01], [0, 1, 0], [w * .8, .7, .01], [w, .32, .02], [0, .5, .07]];
  const n0 = nrmW || V3(0, 0, 1).transformDirection(M);
  const ids = pts.map(([x, y, z]) => gb.vert(V3(x, y, z).applyMatrix4(M), n0, sway0 + (1 - sway0) * y, piv, mat));
  const c = ids[6];
  for (let k = 0; k < 6; k++) gb.tri(c, ids[k], ids[(k + 1) % 6]);
}
function leafGeo(w = .3) {
  const gb = new GB(); leafInto(gb, new THREE.Matrix4(), w); return gb.geo();
}
// grass: a tuft of six blades, three segments each, curved and turned at random
function tuftGeo(rnd, blades = 6, segs = 3) {
  const gb = new GB();
  for (let b = 0; b < blades; b++) {
    const yaw = rnd() * Math.PI * 2, lean = (6 + rnd() * 14) * D2R, h = .2 + rnd() * .24, w = (.028 + rnd() * .014) * (blades < 6 ? 1.5 : 1);
    const ox = (rnd() - .5) * .12, oz = (rnd() - .5) * .12;
    const dx = Math.cos(yaw), dz = Math.sin(yaw), sx = -dz, sz = dx;
    let prevL = -1, prevR = -1;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, bend = Math.sin(lean) * h * t * t * 1.4;
      const y = h * t, cx = ox + dx * bend, cz = oz + dz * bend, ww = w * (1 - t * .85) * .5;
      const n = V3(dx * .4, .3, dz * .4).normalize();
      if (k < segs) {
        const l = gb.vert(V3(cx + sx * ww, y, cz + sz * ww), n, t), r = gb.vert(V3(cx - sx * ww, y, cz - sz * ww), n, t);
        if (prevL >= 0) gb.quad(prevL, prevR, r, l);
        prevL = l; prevR = r;
      } else { const tip = gb.vert(V3(cx, y, cz), n, 1); gb.tri(prevL, prevR, tip); }
    }
  }
  return gb.geo();
}
// a fern: nine fronds arching out, each with modelled leaflet pairs
function fernGeo(rnd, fronds = 8) {
  const gb = new GB();
  for (let f = 0; f < fronds; f++) {
    const yaw = f / fronds * Math.PI * 2 + rnd() * .5, up = (52 + rnd() * 20) * D2R, L = .85 + rnd() * .3;
    const K = 10, pts = [];
    let p = V3(0, .02, 0), ang = up;
    for (let k = 0; k <= K; k++) {
      pts.push(p.clone());
      const st = L / K, a2 = ang - k / K * 1.25;
      p = p.clone().add(V3(Math.cos(a2) * Math.cos(yaw) * st, Math.sin(a2) * st, Math.cos(a2) * Math.sin(yaw) * st));
    }
    for (let k = 1; k < K; k++) {
      const t = k / K, T = V3(0, 0, 0).subVectors(pts[k + 1], pts[k - 1]).normalize();
      const S = V3(0, 0, 0).crossVectors(T, V3(0, 1, 0)).normalize();
      const ll = .2 * L * Math.sin(Math.PI * (t * .88 + .08)) + .02;
      for (const sd of [-1, 1]) {
        const dir = S.clone().multiplyScalar(sd * .62).addScaledVector(T, .5); dir.y -= .22; dir.normalize();
        const perp = V3(0, 0, 0).crossVectors(dir, T).normalize();
        const nrm = V3(0, 0, 0).crossVectors(dir, perp).normalize(); if (nrm.y < 0) nrm.negate(); nrm.lerp(V3(0, 1, 0), .4).normalize();
        const b = pts[k], tip = b.clone().addScaledVector(dir, ll), wv = ll * .17;
        const i0 = gb.vert(b, nrm, t), i1 = gb.vert(b.clone().addScaledVector(dir, ll * .45).addScaledVector(perp, wv), nrm, t + .02),
          i2 = gb.vert(tip, nrm, Math.min(1, t + .05)), i3 = gb.vert(b.clone().addScaledVector(dir, ll * .45).addScaledVector(perp, -wv), nrm, t + .02);
        gb.tri(i0, i1, i2); gb.tri(i0, i2, i3);
      }
    }
    // the stem itself, a thin ribbon
    for (let k = 0; k < K; k++) {
      const a = pts[k], b = pts[k + 1], T = V3(0, 0, 0).subVectors(b, a).normalize(), S = V3(0, 0, 0).crossVectors(T, V3(0, 1, 0)).normalize().multiplyScalar(.008);
      const n = V3(0, 1, 0);
      const i0 = gb.vert(a.clone().add(S), n, k / K), i1 = gb.vert(a.clone().sub(S), n, k / K), i2 = gb.vert(b.clone().sub(S), n, (k + 1) / K), i3 = gb.vert(b.clone().add(S), n, (k + 1) / K);
      gb.quad(i0, i1, i2, i3);
    }
  }
  return gb.geo();
}
// a hosta: broad leaves on short stalks, folded at the midrib, with a pale edge (aMat 1 at the rim)
function hostaGeo(rnd) {
  const gb = new GB(), n = 11;
  for (let f = 0; f < n; f++) {
    const yaw = f / n * Math.PI * 2 + rnd() * .4, L = .34 + rnd() * .12, W = L * (.5 + rnd() * .12), up0 = (50 + rnd() * 18) * D2R;
    const dx = Math.cos(yaw), dz = Math.sin(yaw), sx = -dz, sz = dx;
    const start = V3(dx * .06, .1 + rnd() * .1, dz * .06);
    const R = 6, rows = [];
    for (let k = 0; k <= R; k++) {
      const t = k / R, a = up0 - t * 1.5;
      const along = V3(dx * Math.cos(a), Math.sin(a), dz * Math.cos(a));
      const c = k === 0 ? start.clone() : rows[k - 1].c.clone().addScaledVector(rows[k - 1].along, L / R);
      const w = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * .96 + .04)), .75) * .5;
      rows.push({ c, along, w, t });
    }
    let prev = null;
    for (const r of rows) {
      const side = V3(sx, 0, sz);
      const nrm = V3(0, 0, 0).crossVectors(side, r.along).normalize(); if (nrm.y < 0) nrm.negate();
      const mid = gb.vert(r.c.clone().addScaledVector(nrm, .018), nrm, .3 + .7 * r.t, null, 0);
      const l = gb.vert(r.c.clone().addScaledVector(side, r.w), nrm, .3 + .7 * r.t, null, 1);
      const rr = gb.vert(r.c.clone().addScaledVector(side, -r.w), nrm, .3 + .7 * r.t, null, 1);
      const li = gb.vert(r.c.clone().addScaledVector(side, r.w * .72).addScaledVector(nrm, .006), nrm, .3 + .7 * r.t, null, 0);
      const ri = gb.vert(r.c.clone().addScaledVector(side, -r.w * .72).addScaledVector(nrm, .006), nrm, .3 + .7 * r.t, null, 0);
      const row = [l, li, mid, ri, rr];
      if (prev) for (let j = 0; j < 4; j++) gb.quad(prev[j], prev[j + 1], row[j + 1], row[j]);
      prev = row;
    }
  }
  return gb.geo();
}
// a hydrangea: leaf clusters on a few stems, round flower heads of small florets (aMat 1)
function shrubGeo(rnd) {
  const gb = new GB();
  const heads = [], clusters = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + rnd() * .5, r = .25 + rnd() * .42, y = .42 + rnd() * .55;
    clusters.push({ c: V3(Math.cos(a) * r, y, Math.sin(a) * r), r: .3 + rnd() * .12, ph: rnd() });
  }
  clusters.push({ c: V3(0, 1.0, 0), r: .34, ph: rnd() });
  for (const cl of clusters) {
    const piv = [cl.c.x, cl.c.y, cl.c.z, cl.ph];
    tube(gb, [V3(cl.c.x * .2, 0, cl.c.z * .2), V3(cl.c.x * .6, cl.c.y * .5, cl.c.z * .6), cl.c.clone()], [.02, .014, .008], 4, [0, .4, .7], rnd() * 6, piv);
    lobe(gb, cl.c, cl.r * .72, 1, .2, piv, 0, rnd, .1);
    for (let j = 0; j < 20; j++) {
      const dir = V3(rnd() - .5, rnd() * .9 - .25, rnd() - .5).normalize();
      const pos = cl.c.clone().addScaledVector(dir, cl.r * (.75 + .3 * rnd()));
      const up = V3(rnd() - .5, rnd() - .5, rnd() - .5).cross(dir).normalize();
      const x = V3(0, 0, 0).crossVectors(up, dir).normalize();
      const M = new THREE.Matrix4().makeBasis(x, up, dir).scale(V3(.2, .2, .2)).setPosition(pos);
      leafInto(gb, M, .32, 0, piv, 0, dir);
    }
    if (heads.length < 6 && rnd() < .85) heads.push(cl.c.clone().add(V3((rnd() - .5) * .2, cl.r * .62, (rnd() - .5) * .2)));
  }
  for (const h of heads) {
    const piv = [h.x, h.y, h.z, rnd()], r = .17 + rnd() * .07;
    const g = ICO[2], P = g.attributes.position, I = g.index, base = gb.p.length / 3;
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), y = P.getY(k), z = P.getZ(k);
      const fl = 1 + .16 * Math.max(0, Math.sin(x * 9.1 + y * 7.3) * Math.sin(z * 8.7 - y * 5.1));
      gb.vert(V3(h.x + x * r * fl, h.y + y * r * fl * .9, h.z + z * r * fl), V3(x, y, z), .5, piv, 1);
    }
    for (let k = 0; k < I.count; k += 3) gb.tri(base + I.getX(k), base + I.getX(k + 1), base + I.getX(k + 2));
  }
  return gb.geo();
}
// tall ornamental grass: arching blades and a few feathery plumes (aMat 1)
function tallGrassGeo(rnd) {
  const gb = new GB();
  for (let b = 0; b < 26; b++) {
    const yaw = rnd() * Math.PI * 2, h = .8 + rnd() * .6, lean = (8 + rnd() * 26) * D2R, w = .022;
    const dx = Math.cos(yaw), dz = Math.sin(yaw), sx = -dz, sz = dx;
    let pl = -1, pr = -1;
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, bend = Math.sin(lean) * h * t * t * 1.6, y = h * t * (1 - .25 * t * Math.sin(lean));
      const ww = w * (1 - t * .8) * .5, n = V3(dx * .5, .4, dz * .5).normalize();
      const l = gb.vert(V3(dx * bend + sx * ww, y, dz * bend + sz * ww), n, t), r = gb.vert(V3(dx * bend - sx * ww, y, dz * bend - sz * ww), n, t);
      if (pl >= 0) gb.quad(pl, pr, r, l);
      pl = l; pr = r;
    }
  }
  for (let k = 0; k < 6; k++) {
    const yaw = rnd() * Math.PI * 2, h = 1.25 + rnd() * .4, lean = (4 + rnd() * 12) * D2R;
    const top = V3(Math.cos(yaw) * Math.sin(lean) * h, h, Math.sin(yaw) * Math.sin(lean) * h);
    tube(gb, [V3(0, 0, 0), top.clone().multiplyScalar(.5), top.clone().multiplyScalar(.82)], [.008, .006, .005], 3, [0, .5, .82], rnd() * 6);
    const dir = top.clone().normalize();
    const pts = [], rad = [], sw = [];
    for (let j = 0; j <= 6; j++) { const t = j / 6; pts.push(top.clone().multiplyScalar(.8).addScaledVector(dir, t * .32)); rad.push(.045 * Math.sin(Math.PI * Math.min(1, t * .95 + .05))); sw.push(.85 + .15 * t); }
    const base = gb.p.length / 3; tube(gb, pts, rad, 6, sw, rnd() * 6);
    for (let j = base; j < gb.p.length / 3; j++) gb.m[j] = 1;
  }
  return gb.geo();
}
// ivy: a five-lobed leaf
function ivyGeo() {
  const gb = new GB(), c = gb.vert(V3(0, .45, .03), V3(0, 0, 1), .5), rim = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k / 10 * Math.PI * 2, r = k % 2 === 0 ? (k === 0 ? .12 : .5) : .28;
    rim.push(gb.vert(V3(Math.cos(a) * r * .9, .45 + Math.sin(a) * r, 0), V3(0, 0, 1), .5 + .5 * Math.max(0, Math.sin(a))));
  }
  for (let k = 0; k < 10; k++) gb.tri(c, rim[k], rim[(k + 1) % 10]);
  return gb.geo();
}
// clover: three round leaflets on a stalk
function cloverGeo() {
  const gb = new GB();
  for (let l = 0; l < 3; l++) {
    const a = l / 3 * Math.PI * 2, cx = Math.cos(a) * .045, cz = Math.sin(a) * .045, y = .07;
    const c = gb.vert(V3(cx, y + .004, cz), V3(0, 1, 0), 1), rim = [];
    for (let k = 0; k < 7; k++) { const b = k / 7 * Math.PI * 2; rim.push(gb.vert(V3(cx + Math.cos(b) * .042, y, cz + Math.sin(b) * .042), V3(0, 1, 0), 1)); }
    for (let k = 0; k < 7; k++) gb.tri(c, rim[(k + 1) % 7], rim[k]);
  }
  return gb.geo();
}
function twigGeo() { const gb = new GB(); tube(gb, [V3(-.5, .012, 0), V3(0, .02, .03), V3(.5, .012, 0)], [.012, .01, .006], 4, [0, 0, 0], 1); return gb.geo(); }
function stoneGeo(rnd) {
  const gb = new GB(); lobe(gb, V3(0, 0, 0), 1, 1, 0, null, 0, rnd, .22, .4);
  for (let k = 0; k < gb.p.length / 3; k++) { gb.p[k * 3 + 1] *= .45; if (gb.n[k * 3 + 1] > .55) gb.m[k] = 1; }
  return gb.geo();
}
function mossGeo(rnd) { const gb = new GB(); lobe(gb, V3(0, 0, 0), 1, 1, 0, null, 0, rnd, .25, .2); for (let k = 0; k < gb.p.length / 3; k++) gb.p[k * 3 + 1] *= .3; return gb.geo(); }
// a far tree: a trunk and five lobes (aMat 1 for the bark)
function farTreeGeo(rnd) {
  const gb = new GB();
  tube(gb, [V3(0, 0, 0), V3(0, 3, 0), V3(0, 6, 0)], [.3, .22, .15], 6, [0, .3, .6], 1);
  for (let k = 0; k < gb.p.length / 3; k++) gb.m[k] = 1;
  const parts = [[0, 8.4, 0, 2.9], [1.6, 6.8, .6, 2.3], [-1.5, 7, -.4, 2.4], [.3, 6.6, -1.6, 2.2], [-.4, 10.1, .2, 2]];
  for (const [x, y, z, r] of parts) lobe(gb, V3(x, y, z), r, 1, .7, null, 0, rnd, .1);
  return gb.geo();
}

// ── a hero tree: trunk, two orders of branches, leaf clusters at the tips ──
function heroTree(rnd, x, z, H, lean = 0, bough = null) {
  const bark = { pts: [] }, clusters = [];
  const crownR = H * .29, top = H * .62, r0 = .022 * H + .06;
  const lx = Math.cos(lean) * .05 * H, lz = Math.sin(lean) * .05 * H;
  const trunk = [], tr = [], tsw = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    trunk.push(V3(x + lx * t * t + Math.sin(t * 4 + x) * .12, top * t, z + lz * t * t + Math.cos(t * 3.3 + z) * .12));
    tr.push(r0 * (1 - .5 * t) * (i === 0 ? 1.55 : i === 1 ? 1.12 : 1)); tsw.push(.25 * t * t);
  }
  const at = (f) => { const k = f * 8, i = Math.min(7, Math.floor(k)), u = k - i; return { p: trunk[i].clone().lerp(trunk[i + 1], u), r: tr[i] + (tr[i + 1] - tr[i]) * u }; };
  const tubes = [[trunk, tr, tsw]];
  const n1 = 6 + Math.floor(rnd() * 2);
  for (let j = 0; j < n1; j++) {
    const hf = .42 + .5 * j / (n1 - 1) + (rnd() - .5) * .05, yaw = j * 2.4 + rnd() * .6, pitch = (28 + rnd() * 26) * D2R;
    const L = H * (.3 + rnd() * .13) * (1 - .35 * (hf - .42));
    const s = at(Math.min(.98, hf)), dir = V3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw));
    const pts = [], rr = [], sw = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push(s.p.clone().addScaledVector(dir, L * t).add(V3(0, t * t * L * .22, 0))); rr.push(s.r * (.55 - .4 * t)); sw.push(.3 + .7 * t); }
    tubes.push([pts, rr, sw]);
    const tip = pts[4];
    clusters.push({ c: tip.clone().add(V3(0, crownR * .12, 0)), r: crownR * (.4 + rnd() * .1) });
    for (const f of [.55, .8]) {
      const b = pts[2].clone().lerp(pts[3], (f - .5) * 2 + .0), yaw2 = yaw + (rnd() < .5 ? -1 : 1) * (35 + rnd() * 25) * D2R, p2 = pitch + (10 + rnd() * 15) * D2R;
      const d2 = V3(Math.cos(p2) * Math.cos(yaw2), Math.sin(p2), Math.cos(p2) * Math.sin(yaw2)), L2 = L * .46;
      const q = [b, b.clone().addScaledVector(d2, L2 * .5), b.clone().addScaledVector(d2, L2)], qr = [s.r * .24, s.r * .14, s.r * .07];
      tubes.push([q, qr, [.6, .8, 1]]);
      clusters.push({ c: q[2].clone().add(V3(0, crownR * .1, 0)), r: crownR * (.33 + rnd() * .1) });
    }
  }
  // boughs: two long low limbs reaching in over the eye, so their leaves hang across the top of the view
  if (bough !== null) for (const [dy, hf, L0, p0] of [[-.1, .62, .44, 12], [.34, .74, .36, 18]]) {
    const yaw = bough + dy, pitch = p0 * D2R, L = H * L0;
    const s = at(hf), dir = V3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw));
    const pts = [], rr = [], sw = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(s.p.clone().addScaledVector(dir, L * t).add(V3(0, -t * t * L * .1, 0))); rr.push(s.r * (.5 - .38 * t)); sw.push(.3 + .7 * t); }
    tubes.push([pts, rr, sw]);
    for (const k of [3.5, 5]) { const i = Math.floor(k), c = k > i ? pts[i].clone().lerp(pts[i + 1], .5) : pts[i].clone(); clusters.push({ c: c.add(V3(0, crownR * .05, 0)), r: crownR * (k === 5 ? .3 : .26) }); }
  }
  const tp = trunk[8];
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + rnd(); clusters.push({ c: tp.clone().add(V3(Math.cos(a) * crownR * .35, crownR * (.55 + rnd() * .2), Math.sin(a) * crownR * .35)), r: crownR * (.42 + rnd() * .1) }); }
  clusters.push({ c: tp.clone().add(V3(0, crownR * 1.05, 0)), r: crownR * .4 });
  return { tubes, clusters, x, z, H, crownR };
}

// ── sky, tree line, light shafts ─────────────────────────────────────────
const SKY_VERT = 'varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; vec4 cp = projectionMatrix * viewMatrix * wp; gl_Position = cp.xyww; }';
const SKY_FRAG = /* glsl */`
uniform vec3 uHor; uniform vec3 uSky; uniform vec3 uZen; uniform vec3 uCl0; uniform vec3 uCl1; uniform vec3 uInkC; uniform float uColor;
varying vec3 vDir;
${ENV_GLSL}
// a deck of cloud at height H, seen from below (three decks drift at about 2, 4 and 7 px/s on a 1080 p screen): flat undersides (the edge toward the horizon gets the dark band),
// lighter where the cloud is thick and on the sun's side, a drawn rim
vec4 deck(vec3 d, float H, float S, vec2 V, float thr, float amt) {
  if (d.y < .008) return vec4(0.0);
  float t = (H - cameraPosition.y) / d.y;
  vec2 q = (cameraPosition.xz + d.xz * t) / S + V * uEnvT;
  float den = efbm(q);
  float cov = smoothstep(thr, thr + .05, den);
  if (cov <= 0.0) return vec4(0.0);
  vec2 hd = normalize(d.xz + 1e-5);
  float den2 = efbm(q + hd * .05);
  float under = 1.0 - smoothstep(thr - .01, thr + .07, den2);
  float body = smoothstep(thr, thr + .24, den);
  float sunSide = .5 + .5 * dot(hd, normalize(uSun.xz));
  float core = smoothstep(thr + .03, thr + .26, den);
  vec3 c = mix(uCl1, uCl0, core * (.78 - .3 * sunSide));
  c = mix(c, uCl0 * .95, under * .55);
  float rim = smoothstep(thr, thr + .01, den) * (1.0 - smoothstep(thr + .016, thr + .036, den));
  c = mix(c, uInkC, rim * .35);
  return vec4(c, cov * smoothstep(.008, .11, d.y) * amt);
}
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uSky, smoothstep(-.02, .2, h));
  col = mix(col, uZen, smoothstep(.32, .95, h));
  float sd = max(0.0, dot(d, uSun));
  col += vec3(.85, .72, .5) * (pow(sd, 60.0) * .6 + pow(sd, 7.0) * .07);
  vec4 c3 = deck(d, 720.0, 900.0, vec2(.0007, .00026), .63, .6); col = mix(col, c3.rgb, c3.a);
  vec4 c2 = deck(d, 480.0, 520.0, vec2(.0016, .0006), .61, .8); col = mix(col, c2.rgb, c2.a);
  vec4 c1 = deck(d, 320.0, 380.0, vec2(.0042, .0017) * .6, .57, 1.0); col = mix(col, c1.rgb, c1.a);
  col = mix(col, uHor, smoothstep(0.0, -.06, h));
  col = mix(mix(vec3(.88, .87, .86), col, .3), col, uColor);
  gl_FragColor = vec4(col, 1.0);
}`;
const LINE_VERT = 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
const LINE_FRAG = /* glsl */`
uniform vec3 uHaze; uniform vec3 uInkC; uniform float uColor; uniform float uNPass;
varying vec3 vW;
${ENV_GLSL}
void main(){
  float a = atan(vW.z, vW.x);
  float hgt = 20.0 + 18.0 * efbm(vec2(a * 8.0, 1.3)) + 10.0 * efbm(vec2(a * 46.0, 7.7)) + 4.0 * abs(sin(a * 260.0));
  if (vW.y > hgt) discard;
  if (uNPass > .5) { gl_FragColor = vec4(normalize((viewMatrix * vec4(-normalize(vec3(vW.x, 0.0, vW.z)), 0.0)).xyz) * .5 + .5, 1.0); return; }
  float edge = smoothstep(hgt - 1.4, hgt - .3, vW.y);
  float lit = smoothstep(.35, .7, efbm(vec2(a * 70.0, vW.y * .09)));
  float side = .5 + .5 * cos(a - atan(uSun.z, uSun.x));
  vec3 c = mix(vec3(.026, .042, .02), vec3(.07, .1, .045), lit * side * smoothstep(0.0, hgt, vW.y));
  c = mix(c, uHaze, .52);
  c = mix(c, uInkC, edge * .35);
  c = mix(mix(vec3(.88, .87, .86), c, .3), c, uColor);
  gl_FragColor = vec4(c, 1.0);
}`;
const SHAFT_VERT = /* glsl */`
uniform vec3 uA; uniform vec3 uB; uniform float uW;
varying float vX; varying float vY;
void main(){
  vec3 P = mix(uA, uB, position.y);
  vec3 axis = normalize(uB - uA), toC = normalize(cameraPosition - P);
  vec3 side = normalize(cross(axis, toC));
  P += side * position.x * uW * mix(1.0, 1.7, position.y);
  vX = position.x; vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const SHAFT_FRAG = /* glsl */`
uniform vec3 uA; uniform float uSeed; uniform float uColor; uniform float uStr;
varying float vX; varying float vY;
${ENV_GLSL}
void main(){
  float a = smoothstep(0.0, .9, 1.0 - abs(vX * 2.0));
  a *= smoothstep(0.0, .12, vY) * smoothstep(1.0, .5, vY);
  float cl = 1.0 - cloudShadow(uA);
  float fl = .55 + .45 * sin(uEnvT * .33 + uSeed * 9.0) * sin(uEnvT * .21 + uSeed * 3.0);
  a *= cl * fl * uColor * uStr;
  gl_FragColor = vec4(vec3(1.0, .9, .68), a * .22);
}`;

// ── the whole place ──────────────────────────────────────────────────────
export function createEnv(scene) {
  const R = rng(20261107);
  const env = { outline: [], casters: [], counted: [], meshes: [] };
  scene.fog = new THREE.Fog(HAZE, 260, 1050);
  const add = (m, { outline = false, cast = false } = {}) => {
    m.receiveShadow = true; m.castShadow = cast;
    if (cast && m.material.userData.depth) m.customDepthMaterial = m.material.userData.depth;
    if (outline) m.layers.enable(1);
    scene.add(m); env.meshes.push(m);
    return m;
  };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler(), SC = V3(1, 1, 1);
  const mat4 = (x, y, z, yaw, s, rx = 0, rz = 0) => { EU.set(rx, yaw, rz, 'YXZ'); Q.setFromEuler(EU); SC.set(s, s, s); return M4.compose(V3(x, y, z), Q, SC).clone(); };
  // an instanced layer: its own copy of the geometry, a variation per instance, and optional per-instance attributes
  const layer = (geo0, mat, list, opt = {}) => {
    const geo = geo0.clone(), n = list.length;
    const m = new THREE.InstancedMesh(geo, mat, n);
    const v = new Float32Array(n);
    list.forEach((o, i) => { m.setMatrixAt(i, o.m); v[i] = o.v ?? R(); });
    geo.setAttribute('aVar', new THREE.InstancedBufferAttribute(v, 1));
    for (const [k, size, fn] of opt.attrs || []) { const a = new Float32Array(n * size); list.forEach((o, i) => fn(o, a, i * size)); geo.setAttribute(k, new THREE.InstancedBufferAttribute(a, size)); }
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
    m.userData.full = n;
    add(m, opt);
    if (opt.count) env.counted.push(m);
    return m;
  };
  // density of planting (for damp soil and shade at the roots)
  const DN = 256, DS = 200, DX = -100, DZ = -100, dens = new Float32Array(DN * DN);
  const splat = (x, z, r, w = 1) => {
    const cx = (x - DX) / DS * DN, cz = (z - DZ) / DS * DN, rr = r / DS * DN + 1;
    for (let j = Math.max(0, Math.floor(cz - rr * 2)); j <= Math.min(DN - 1, Math.ceil(cz + rr * 2)); j++)
      for (let i = Math.max(0, Math.floor(cx - rr * 2)); i <= Math.min(DN - 1, Math.ceil(cx + rr * 2)); i++) {
        const d2 = ((i - cx) ** 2 + (j - cz) ** 2) / (rr * rr); dens[j * DN + i] += w * Math.exp(-d2);
      }
  };

  // ── the ground ──
  {
    const g = new THREE.CircleGeometry(680, 72); g.rotateX(-Math.PI / 2);
    const m = add(new THREE.Mesh(g, vegMaterial({ kind: 5 })), { outline: true });
    m.renderOrder = -2; env.ground = m;
  }
  ENVU.uPath.value.forEach((v, i) => v.set(PATH[i][0], PATH[i][1]));

  // ── canopy: eight trees framing the house, two of them near the eye so their leaves cross the lens ──
  const toward = (x, z, a, b) => { const [tx, tz] = fromEye(a, b); return Math.atan2(tz - z, tx - x); };
  const near1 = fromEye(7.6, -6.1), near2 = fromEye(8.9, 6.6);
  const HERO = [
    [...near1, 10.6, .4, toward(...near1, 11, -1.8)], [...near2, 9.8, 2.6, toward(...near2, 12.5, 2.2)],
    [-11.5, 28.5, 13.2, 1.2], [27, 16.5, 11.6, 3.4], [...fromEye(31 * KM, 16), 12.4, 4],
    [-34, -18, 14.2, .2], [33, -24, 13.6, 2], [5, -33, 14.8, 1], [-31, 15, 10.4, 5],
  ];
  const heroes = HERO.map(([x, z, H, l, b]) => heroTree(R, x, z, H, l, b ?? null));
  {
    const gb = new GB(), lob = new GB(), leaves = [], barkT = [], lobT = [];
    heroes.forEach((t, ti) => {
      const b0 = gb.p.length / 3, l0 = lob.p.length / 3;
      for (const [pts, rr, sw] of t.tubes) tube(gb, pts, rr, rr[0] > .2 ? 9 : 6, sw, R() * 6);
      t.clusters.forEach((c) => {
        const ph = R(), piv = [c.c.x, c.c.y, c.c.z, ph];
        lobe(lob, c.c, c.r * .8, 2, .25, piv, 0, R, .12, .82);
        const n = Math.max(50, Math.min(230, Math.round(150 * (c.r / 1.3) ** 2)));
        for (let k = 0; k < n; k++) {
          const dir = V3(R() - .5, R() - .5 + .18, R() - .5).normalize();
          const pos = c.c.clone().addScaledVector(dir, c.r * (.7 + .3 * Math.sqrt(R())));
          const up = V3(R() - .5, R() - .5, R() - .5).cross(dir).normalize();
          const xx = V3(0, 0, 0).crossVectors(up, dir).normalize();
          const tilt = dir.clone().lerp(V3(R() - .5, R() - .5, R() - .5), .35).normalize();
          const up2 = V3(0, 0, 0).crossVectors(tilt, xx).normalize(); const x2 = V3(0, 0, 0).crossVectors(up2, tilt).normalize();
          const s = .34 + R() * .14;
          const m = new THREE.Matrix4().makeBasis(x2, up2, tilt).scale(V3(s, s, s)).setPosition(pos);
          leaves.push({ m, piv: [c.c.x, c.c.y, c.c.z, ph], tree: ti + 1 });
        }
      });
      splat(t.x, t.z, t.crownR * .7, .55);
      for (let k = b0; k < gb.p.length / 3; k++) barkT[k] = ti + 1;
      for (let k = l0; k < lob.p.length / 3; k++) lobT[k] = ti + 1;
      // where to test whether it stands in the way: the crown and the trunk
      const cy = t.H * .62 + t.crownR * .45;
      t.probes = [[V3(t.x, cy, t.z), t.crownR * 1.45], [V3(t.x, cy * .45, t.z), 1.4]];
    });
    const LEAF = ['#2c3a20', '#41592c', '#55753a', '#86a35c'];
    const barkM = vegMaterial({ kind: 3, tones: ['#1e1914', '#2b241d', '#3b3328', '#4f4535'], sway: 1 });
    const bg = gb.geo(); bg.setAttribute('aTree', new THREE.Float32BufferAttribute(barkT, 1));
    env.bark = add(new THREE.Mesh(bg, barkM), { outline: true, cast: true });
    const lobeM = vegMaterial({ kind: 2, tones: LEAF, trans: .7, sphere: 1 });
    const lg = lob.geo(); lg.setAttribute('aTree', new THREE.Float32BufferAttribute(lobT, 1));
    env.lobes = add(new THREE.Mesh(lg, lobeM), { outline: true, cast: true });
    const leafM = vegMaterial({ kind: 2, tones: LEAF, trans: 1, sphere: .74, ao: .18, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const lgeo = leafGeo(.32);
    env.leaves = heroes.map((t, ti) => layer(lgeo, leafM, leaves.filter((o) => o.tree === ti + 1), { outline: true, cast: true, attrs: [['aPivot', 4, (o, a, i) => { a[i] = o.piv[0]; a[i + 1] = o.piv[1]; a[i + 2] = o.piv[2]; a[i + 3] = o.piv[3]; }], ['aTree', 1, (o, a, i) => { a[i] = o.tree; }]] }));
  }
  const nearTree = (x, z, m) => heroes.some((t) => Math.hypot(t.x - x, t.z - z) < m) || HOUSE_TREES.some(([a, b]) => Math.hypot(a - x, b - z) < m * .8);

  // ── the forest ring (simplified trees) and the tree line on the horizon (one drawn band) ──
  {
    const list = [];
    for (let k = 0; k < 4000 && list.length < 520; k++) {
      const a = R() * Math.PI * 2, r = 122 + Math.pow(R(), .8) * 200, x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
      // the clearing: the house, its own trees, and the open meadow between the eye and the house
      const along = Math.max(0, Math.min(1, ((x - EC[0]) * -EC[0] + (z - EC[1]) * -EC[1]) / (EC[0] ** 2 + EC[1] ** 2)));
      const cd = Math.hypot(x - (EC[0] - EC[0] * along), z - (EC[1] - EC[1] * along));
      if (inDeck(x, z, 22) || cd < 26 + 30 * along || nearTree(x, z, 9)) continue;
      const s = .85 + R() * .65;
      list.push({ m: mat4(x, 0, z, R() * 6.28, s, (R() - .5) * .06, (R() - .5) * .06) });
    }
    const m = vegMaterial({ kind: 1, tones: ['#25321c', '#374c27', '#4a6534', '#7e9b58'], tones2: ['#1b1712', '#28221b', '#352e24', '#463d30'], trans: .5, sway: .5 });
    // in eight sectors round the clearing, so the ones behind the eye are not drawn
    const geoF = farTreeGeo(R);
    env.forest = [];
    for (let k = 0; k < 8; k++) {
      const sub = list.filter((o) => { const e = o.m.elements; return Math.floor((Math.atan2(e[14] + 6, e[12]) + Math.PI) / (2 * Math.PI) * 8) % 8 === k; });
      if (sub.length) env.forest.push(layer(geoF, m, sub, { outline: true }));
    }
    const line = new THREE.Mesh(new THREE.CylinderGeometry(600, 600, 80, 160, 1, true), new THREE.ShaderMaterial({
      uniforms: { ...E, uHaze: { value: HAZE }, uInkC: { value: new THREE.Color('#2a3326') }, uColor: G.uColor },
      vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, side: THREE.BackSide, fog: false,
    }));
    line.material.uniforms.uNPass = G.uNPass;
    line.position.y = 38; line.frustumCulled = false; line.layers.enable(1); scene.add(line); env.line = line;
  }

  // ── the sky ──
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 40, 20), new THREE.ShaderMaterial({
      uniforms: { ...E, uHor: { value: new THREE.Color('#d2dbd8') }, uSky: { value: new THREE.Color('#b9c9cf') }, uZen: { value: new THREE.Color('#a3b8c2') },
        uCl0: { value: new THREE.Color('#a0a19e') }, uCl1: { value: new THREE.Color('#e8e8e4') }, uInkC: { value: new THREE.Color('#6c7376') }, uColor: G.uColor },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); env.sky = sky;
  }

  // ── middle layer: along the path and at the foundation ──
  const fern = fernGeo(R), hosta = hostaGeo(R), shrub = shrubGeo(R), tall = tallGrassGeo(R);
  const P = { fern: [], hosta: [], shrub: [], tall: [], lowfern: [] };
  const ok = (x, z, m = .3) => !inDeck(x, z, m) && pathD(x, z) > .9 && !nearTree(x, z, .9);
  const put = (kind, x, z, s) => {
    if (!ok(x, z)) return;
    const yaw = R() * 6.28;
    if (kind === 'fern') { P.fern.push({ m: mat4(x, 0, z, yaw, s * (.9 + R() * .5)) }); splat(x, z, .8, .5); }
    if (kind === 'hosta') { P.hosta.push({ m: mat4(x, 0, z, yaw, s * (1.1 + R() * .5)) }); splat(x, z, .6, .45); }
    if (kind === 'shrub') { P.shrub.push({ m: mat4(x, 0, z, yaw, s * (.9 + R() * .45)) }); splat(x, z, 1.1, .7); }
    if (kind === 'tall') { P.tall.push({ m: mat4(x, 0, z, yaw, s * (.85 + R() * .35)) }); splat(x, z, .7, .45); }
    if (kind === 'lowfern') P.lowfern.push({ m: mat4(x, 0, z, yaw, s * (.32 + R() * .2)) });
  };
  const pick = (w) => { let r = R() * w.reduce((a, b) => a + b[1], 0); for (const [k, p] of w) { if ((r -= p) <= 0) return k; } return w[0][0]; };
  // the path's edges
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let s = 0; s < L; s += 1.05) for (const sd of [-1, 1]) {
      if (R() < .12) continue;
      const off = 1.15 + R() * 1.9, x = ax + (bx - ax) * s / L + nx * off * sd, z = az + (bz - az) * s / L + nz * off * sd;
      const near = i === 0 && s < L * .6;
      put(pick(near ? [['fern', .36], ['hosta', .32], ['shrub', .08], ['lowfern', .24]] : [['hosta', .34], ['lowfern', .4], ['fern', .14], ['tall', .12]]), x, z, near ? 1 : .8);
    }
  }
  // the foundation: a deep border round the deck, thickest at the front
  for (const [ax, az, bx, bz, nx, nz] of [[DECK.x0, DECK.z1, DECK.x1, DECK.z1, 0, 1], [DECK.x1, DECK.z0, DECK.x1, DECK.z1, 1, 0], [DECK.x0, DECK.z0, DECK.x0, DECK.z1, -1, 0], [DECK.x0, DECK.z0, DECK.x1, DECK.z0, 0, -1]]) {
    const L = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < L; s += .95) {
      const x0 = ax + (bx - ax) * s / L, z0 = az + (bz - az) * s / L;
      if (nz === 1 && META.steps && x0 > META.steps[0] && x0 < META.steps[1]) continue;                       // the steps
      for (let row = 0; row < (nz === 1 ? 3 : 2); row++) {
        if (R() < .15) continue;
        const off = .5 + row * 1.15 + R() * .6, x = x0 + nx * off + (R() - .5) * .5, z = z0 + nz * off + (R() - .5) * .5;
        const front = nz === 1;     // the side the eye looks at: lower, so the ground floor stays in view
        put(pick(row === 0 ? (front ? [['hosta', .4], ['fern', .3], ['shrub', .12], ['tall', .18]] : [['shrub', .36], ['hosta', .3], ['fern', .22], ['tall', .12]])
          : [['fern', .3], ['hosta', .25], ['tall', .15], ['lowfern', .3]]), x, z, front ? .85 : 1);
      }
    }
  }
  // under the trees, and close to the eye (out of focus, at the bottom corners)
  for (const t of heroes) for (let k = 0; k < 11; k++) { const a = R() * 6.28, r = 1.4 + R() * 3.4; put(pick([['fern', .55], ['lowfern', .3], ['hosta', .15]]), t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, 1); }
  for (const [a, b, k, s] of [[5.4, -5.2, 'shrub', .85], [7.2, 5.8, 'shrub', .8], [5.2, 3.4, 'fern', 1.1], [8.6, -6.6, 'fern', 1.2], [4.6, -3.2, 'hosta', 1.1], [3.8, 2.6, 'hosta', 1]]) { const [x, z] = fromEye(a, b); put(k, x, z, s); }
  for (let k = 0; k < 160; k++) { const a = R() * 6.28, r = 26 + R() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r - 10; if (z < 20 || R() < .3) put(pick([['fern', .5], ['lowfern', .5]]), x, z, 1); }
  const FERN = ['#22301a', '#3a5428', '#557738', '#8fb05c'];
  env.fern = layer(fern, vegMaterial({ kind: 1, tones: FERN, trans: .8, ao: .45, side: THREE.DoubleSide, minPx: 2.5, refH: .7 }), [...P.fern, ...P.lowfern], { outline: false, count: true });
  env.hosta = layer(hosta, vegMaterial({ kind: 1, tones: ['#233021', '#3b5434', '#57774a', '#8dad70'], tones2: ['#4e5838', '#7f8a5a', '#b8bd8c', '#dfe0b6'], trans: .55, ao: .4, side: THREE.DoubleSide, minPx: 2.5, refH: .5 }), P.hosta, { outline: false });
  env.shrub = layer(shrub, vegMaterial({ kind: 2, pivLocal: true, tones: ['#25331d', '#3c5530', '#56763f', '#88a964'], tones2: ['#7a4c76', '#ad77a3', '#d39dc4', '#f0c9e1'], trans: .6, sphere: .55, ao: .3, side: THREE.DoubleSide, minPx: 2.5, refH: 1.2 }), P.shrub, { outline: true, cast: true });
  env.tall = layer(tall, vegMaterial({ kind: 0, tones: ['#343b20', '#566332', '#7a8a47', '#b5c47c'], tones2: ['#6c5f43', '#a39271', '#cdbd93', '#efe4bf'], trans: .9, ao: .35, side: THREE.DoubleSide, minPx: 2.5, refH: 1.3, sway: 1.6 }), P.tall, { outline: false });

  // ── ivy on the house: on the deck's skirt and up the lower walls ──
  {
    const walls = [   // x0, z0, x1, z1, y0, y1, nx, nz
      ...(DECK.h > .05 ? [[DECK.x0, DECK.z1 + .02, DECK.x1, DECK.z1 + .02, 0, DECK.h, 0, 1], [DECK.x1 + .02, DECK.z0, DECK.x1 + .02, DECK.z1, 0, DECK.h, 1, 0],
        [DECK.x0 - .02, DECK.z0, DECK.x0 - .02, DECK.z1, 0, DECK.h, -1, 0], [DECK.x0, DECK.z0 - .02, DECK.x1, DECK.z0 - .02, 0, DECK.h, 0, -1]] : []),
      ...(META.ivy || []),
    ];
    const list = [];
    for (const [x0, z0, x1, z1, y0, y1, nx, nz] of walls) {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L * (y1 - y0 > 1 ? 30 : 16));
      for (let k = 0; k < n; k++) {
        const s = R(), x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s;
        const patch = vn(x * .35 + z * .35, 3.1); if (patch < .42) continue;
        const reach = y0 + (y1 - y0) * Math.min(1, patch * 1.3);
        const y = Math.min(reach, y0 + (y1 - y0) * Math.pow(R(), 1.9)) + (y1 - y0 < 1 ? R() * .5 : 0);
        const out = V3(nx, 0, nz), up = V3(0, 1, 0).lerp(V3(R() - .5, 0, R() - .5), .5).normalize();
        const side = V3(0, 0, 0).crossVectors(up, out).normalize(); const up2 = V3(0, 0, 0).crossVectors(out.clone().lerp(V3(0, 1, 0), .3).normalize(), side).normalize();
        const sc = .09 + R() * .06;
        list.push({ m: new THREE.Matrix4().makeBasis(side, up2, out.clone().lerp(V3(0, 1, 0), .3).normalize()).scale(V3(sc, sc, sc)).setPosition(V3(x + nx * .04, y, z + nz * .04)) });
      }
    }
    env.ivy = layer(ivyGeo(), vegMaterial({ kind: 1, tones: ['#1c2817', '#2f4424', '#486634', '#7a9a54'], trans: .5, side: THREE.DoubleSide, minPx: 1.2, refH: .12, scaleIn: 0 }), list, { outline: false });
  }

  // ── ground layer: grass tufts, clover, low ferns (above), litter, twigs, stones and moss ──
  {
    const list = [];
    const N = 30000;
    for (let k = 0; list.length < N && k < N * 4; k++) {
      let x, z; const r = R();
      if (r < .55) { const a = R() * 6.28, d = Math.pow(R(), .75) * 24, c = fromEye(11, 0); x = c[0] + Math.cos(a) * d; z = c[1] + Math.sin(a) * d; }
      else if (r < .82) { const s = R() * 4, t = R(); const LW = DECK.x1 - DECK.x0, LD = DECK.z1 - DECK.z0; x = s < 2 ? DECK.x0 + t * LW : s < 3 ? DECK.x0 - R() * 12 : DECK.x1 + R() * 12; z = s < 1 ? DECK.z1 + R() * 14 : s < 2 ? DECK.z0 - R() * 12 : DECK.z0 + t * LD; }
      else { const a = R() * 6.28, d = Math.sqrt(R()) * 80; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      if (inDeck(x, z, .25) || pathD(x, z) < .8 || nearTree(x, z, .5)) continue;
      list.push({ m: mat4(x, 0, z, R() * 6.28, .8 + R() * .55) });
    }
    const grassM = vegMaterial({ kind: 0, tones: ['#25321b', '#41592d', '#68873f', '#a4bf6c'], trans: .55, ao: .55, side: THREE.DoubleSide, minPx: 1.6, refH: .35 });
    const full = tuftGeo(R), lite = tuftGeo(R, 3, 2), CELL = 20, cells = new Map();
    for (const o of list) { const e = o.m.elements, k = Math.floor(e[12] / CELL) + ',' + Math.floor(e[14] / CELL); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(o); }
    env.grass = [];
    for (const arr of cells.values()) {
      const n = arr.length, gF = full.clone(), gL = lite.clone(), m = new THREE.InstancedMesh(gF, grassM, n);
      const v = new Float32Array(n), c = V3(0, .2, 0);
      arr.forEach((o, i) => { m.setMatrixAt(i, o.m); v[i] = R(); c.x += o.m.elements[12] / n; c.z += o.m.elements[14] / n; });
      const av = new THREE.InstancedBufferAttribute(v, 1); gF.setAttribute('aVar', av); gL.setAttribute('aVar', av);
      m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
      m.userData = { full: n, gF, gL, c };
      add(m); env.grass.push(m);
    }
    const clover = [];
    for (let k = 0; clover.length < 3600 && k < 40000; k++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * 60, x = Math.cos(a) * d + 4, z = Math.sin(a) * d + 18;
      if (vn(x * .22, z * .22) < .58 || inDeck(x, z, .3) || pathD(x, z) < .8) continue;
      clover.push({ m: mat4(x, 0, z, R() * 6.28, .9 + R() * .6) });
    }
    env.clover = layer(cloverGeo(), vegMaterial({ kind: 1, tones: ['#203218', '#3a5a27', '#5c8a3b', '#93be67'], trans: .4, ao: .2, side: THREE.DoubleSide, minPx: 1.4, refH: .1 }), clover, { count: true });
    const litter = [], twigs = [], stones = [], moss = [];
    const under = () => { const t = R() < .7 ? heroes[Math.floor(R() * heroes.length)] : null; if (t) { const a = R() * 6.28, d = Math.sqrt(R()) * t.crownR * 1.3; return [t.x + Math.cos(a) * d, t.z + Math.sin(a) * d]; } const h = HOUSE_TREES[Math.floor(R() * HOUSE_TREES.length)], a = R() * 6.28, d = Math.sqrt(R()) * 4; return [h[0] + Math.cos(a) * d, h[1] + Math.sin(a) * d]; };
    for (let k = 0; k < 3800; k++) {
      const [x, z] = k % 3 === 0 ? (() => { const i = Math.floor(R() * (PATH.length - 1)), s = R(); return [PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * s + (R() - .5) * 2.4, PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * s + (R() - .5) * 2.4]; })() : under();
      if (inDeck(x, z, .1)) continue;
      const s = .11 + R() * .08;
      litter.push({ m: new THREE.Matrix4().makeRotationY(R() * 6.28).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + (R() - .5) * .5)).scale(V3(s, s, s)).setPosition(V3(x, .012 + R() * .01, z)), mt: R() < .35 ? 1 : 0 });
    }
    for (let k = 0; k < 700; k++) { const [x, z] = under(); if (!inDeck(x, z, .1)) twigs.push({ m: mat4(x, 0, z, R() * 6.28, .4 + R() * .7) }); }
    // stepping stones along the path, and a few loose stones by the planting
    for (let i = 0; i < PATH.length - 1; i++) {
      const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let s = .3; s < L; s += .82) {
        const x = ax + (bx - ax) * s / L + (R() - .5) * .25, z = az + (bz - az) * s / L + (R() - .5) * .25;
        const M = mat4(x, .01, z, R() * 6.28, 1); M.scale(V3(.34 + R() * .1, .55, .26 + R() * .08)); stones.push({ m: M });
      }
    }
    for (let k = 0; k < 90; k++) { const [x, z] = under(); if (ok(x, z, .2)) { const M = mat4(x, 0, z, R() * 6.28, .12 + R() * .25); stones.push({ m: M }); } }
    for (let k = 0; k < 520; k++) { const [x, z] = under(); if (ok(x, z, .2)) { const M = mat4(x, 0, z, R() * 6.28, 1); M.scale(V3(.25 + R() * .45, .5 + R() * .4, .25 + R() * .45)); moss.push({ m: M }); } }
    env.litter = layer(leafGeo(.34), vegMaterial({ kind: 4, tones: ['#3a2a18', '#5a4024', '#7a5a32', '#a17a40'], tones2: ['#444021', '#68622f', '#958b44', '#bdb362'], side: THREE.DoubleSide, minPx: 1.2, refH: .15 }), litter,
      { count: true, attrs: [['aMat', 1, (o, a, i) => { a[i] = o.mt; }]] });
    env.twigs = layer(twigGeo(), vegMaterial({ kind: 4, tones: ['#1e1914', '#2e2720', '#463c2f', '#5a4e3d'], minPx: 1.2, refH: .2 }), twigs);
    env.stones = layer(stoneGeo(R), vegMaterial({ kind: 4, tones: ['#4b4944', '#6f6c64', '#97938a', '#b4b0a6'], tones2: ['#36421c', '#56652c', '#77873c', '#9cae58'] }), stones, { outline: true });
    env.moss = layer(mossGeo(R), vegMaterial({ kind: 4, tones: ['#2d3818', '#4a5a26', '#6c7d34', '#93a457'], minPx: 1.2, refH: .2 }), moss);
  }

  // ── light through the canopy ──
  {
    env.shafts = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .5, 1, 0, -.5, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const spots = [[...fromEye(19 * KM, 4.5), 2.4], [...fromEye(27 * KM, -6), 3.2], [...fromEye(33 * KM, 9), 2.6], [...fromEye(22 * KM, -13), 2.2], [...fromEye(40 * KM, -2), 3.4], [...fromEye(14 * KM, 2), 1.6]];
    spots.forEach(([x, z, w], i) => {
      const B = V3(x, 0, z), A = B.clone().addScaledVector(SUN_DIR, 22);
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { ...E, uA: { value: A }, uB: { value: B }, uW: { value: w }, uSeed: { value: i * 1.7 }, uColor: G.uColor, uStr: { value: 1 } },
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }));
      m.frustumCulled = false; m.renderOrder = 4; scene.add(m); env.shafts.push(m);
    });
  }

  // ── the density map, softened ──
  {
    const tmp = new Float32Array(dens.length), K = [1, 4, 6, 4, 1];
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < DN; j++) for (let i = 0; i < DN; i++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * dens[j * DN + Math.max(0, Math.min(DN - 1, i + k))]; tmp[j * DN + i] = s / 16; }
      for (let j = 0; j < DN; j++) for (let i = 0; i < DN; i++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * tmp[Math.max(0, Math.min(DN - 1, j + k)) * DN + i]; dens[j * DN + i] = s / 16; }
    }
    const data = new Uint8Array(DN * DN * 4);
    for (let k = 0; k < DN * DN; k++) { const v = Math.min(255, Math.round(dens[k] * 230)); data[k * 4] = v; data[k * 4 + 3] = 255; }
    const tex = new THREE.DataTexture(data, DN, DN); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    ENVU.uDens.value = tex; ENVU.uDensR.value.set(DX, DZ, DS, 0);
  }

  // quality: share of the small things drawn (the instances are in random order, so a shorter count thins evenly)
  env.qf = 1;
  env.setQuality = (q) => { const f = env.qf = [.3, .5, .75, 1][q]; for (const m of env.counted) m.count = Math.max(1, Math.round(m.userData.full * f)); env.lodAt = -1; };
  // the grass's steps: full tufts while a tuft is over 13 px tall on screen, then the light tuft, thinning to a third
  env.lodAt = -1;
  env.lod = (camera, focal) => {
    for (const m of env.grass) {
      const px = .35 * focal / Math.max(1, camera.position.distanceTo(m.userData.c));
      const g = px > 13 ? m.userData.gF : m.userData.gL;
      if (m.geometry !== g) m.geometry = g;
      const f = px > 13 ? 1 : Math.min(1, Math.max(.32, (px - 2) / 11)) * .9;
      m.count = Math.max(1, Math.round(m.userData.full * f * env.qf));
    }
  };
  env.setIvy = (k) => { env.ivy.material.userData.u.uScaleIn.value = k; };
  env.update = (camera, focal, frameNo) => {
    env.sky.position.copy(camera.position);
    if (env.lodAt < 0 || frameNo - env.lodAt >= 8) { env.lod(camera, focal); env.lodAt = frameNo; }
  };
  env.heroes = heroes;
  return env;
}
