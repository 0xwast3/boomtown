// boomtown shapes: the building pieces every model draws with. Walls are set out on a footprint side (side + wallM),
// then clad, glazed or fitted with sliders inside that wall frame; railings, stairs, planters, picnic tables and
// drawn trees work in the part's own frame. Import them in a model: import { glaze, tree } from 'boomtown/shapes.js';
//
//   side(r, 'front'|'back'|'left'|'right', y)  a wall frame on footprint r = [x0, z0, x1, z1]: {o, n, len}
//   p.push(wallM(f)) ... p.pop()               inside it s runs left to right seen from outside, t up, d outward
//   clad(p, s0, s1, t0, t1)                    corrugated cladding        glaze(p, [s...], [t...])  mullions, transoms, panes
//   slider(p, s0, s1, t0, t1, open)            a sliding glass door       railing(p, [V...], y, h)  steel mesh railing
//   stair(p, x0, z0, z1, yTop, yBot)           a straight steel stair     planter(p, x0, z0, x1, z1, y, h, rand)
//   tree(p, x, y0, z, h, r, rand, opening)     a drawn tree               shrubs / grass / picnic / subtract
import * as THREE from 'three';
import { V } from './kit.js';

export const up = V(0, 1, 0);
// a wall frame on one side of a footprint: s runs left to right seen from outside, t up, d outward
export function side(r, which, y) {
  const [x0, z0, x1, z1] = r;
  switch (which) {
    case 'front': return { o: V(x0, y, z1), n: V(0, 0, 1), len: x1 - x0 };
    case 'back': return { o: V(x1, y, z0), n: V(0, 0, -1), len: x1 - x0 };
    case 'right': return { o: V(x1, y, z1), n: V(1, 0, 0), len: z1 - z0 };
    case 'left': return { o: V(x0, y, z0), n: V(-1, 0, 0), len: z1 - z0 };
  }
}
export function wallM(f) {
  const u = new THREE.Vector3().crossVectors(up, f.n);
  return new THREE.Matrix4().makeBasis(u, up, f.n).setPosition(f.o);
}
export const F0 = (s, t, d = 0) => V(s, t, d);   // inside a pushed wall frame the mapper is the identity

// ── wall makers (call inside p.push(wallM(f))) ────────────────────────────
export function clad(p, s0, s1, t0, t1, th = .1, pitch = .15) {
  p.box(s0, t0, -th, s1, t1, 0, 'clad');
  p.ribs(F0, s0, s1, t0 + .02, t1 - .02, pitch, .004);
}
// glazing: mullions at the given s stations, transoms at the given t stations, panes between
export function glaze(p, ss, ts, o = {}) {
  const fw = o.fw || .07, dep = o.dep || .1, tint = o.tint || 'steel';
  const s0 = ss[0], s1 = ss[ss.length - 1], t0 = ts[0], t1 = ts[ts.length - 1];
  for (const s of ss) p.box(s - fw / 2, t0, -dep / 2, s + fw / 2, t1, dep / 2, tint, { edges: true });
  for (const t of ts) p.box(s0, t - fw / 2, -dep / 2, s1, t + fw / 2, dep / 2, tint, { edges: true });
  for (let i = 0; i < ss.length - 1; i++) for (let j = 0; j < ts.length - 1; j++) {
    const a = ss[i] + fw / 2, b = ss[i + 1] - fw / 2, c = ts[j] + fw / 2, d = ts[j + 1] - fw / 2;
    p.glassQuad(V(a, c, 0), V(b, c, 0), V(b, d, 0), V(a, d, 0), o.strokes !== false);
  }
}
export const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

// sliding door: two leaves, the outer one slid over the fixed one
export function slider(p, s0, s1, t0, t1, open = .45) {
  const w = (s1 - s0) / 2, fw = .06;
  p.box(s0 - .05, t0, -.07, s1 + .05, t0 + .03, .07, 'steel');            // track
  p.box(s0 - .05, t1, -.08, s1 + .05, t1 + .1, .08, 'steel');             // head
  const leaf = (a, d) => {
    p.push(new THREE.Matrix4().makeTranslation(a, 0, d));
    p.box(0, t0 + .03, -.025, fw, t1, .025, 'steel'); p.box(w - fw, t0 + .03, -.025, w, t1, .025, 'steel');
    p.box(fw, t0 + .03, -.025, w - fw, t0 + .14, .025, 'steel'); p.box(fw, t1 - .07, -.025, w - fw, t1, .025, 'steel');
    p.glassQuad(V(fw, t0 + .14, 0), V(w - fw, t0 + .14, 0), V(w - fw, t1 - .07, 0), V(fw, t1 - .07, 0));
    p.box(w - fw - .05, t0 + 1.0, .025, w - fw - .03, t0 + 1.25, .05, 'dark', { edges: 'fine' });  // pull
    p.pop();
  };
  leaf(s0 + w, -.035);
  leaf(s0 + w * (1 - open) + .0, .035);
}

// mesh railing along a polyline (world coordinates in the part's frame)
export function railing(p, pts, y, h = 1.1, o = {}) {
  const post = o.post || .05;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); d.normalize();
    const n = Math.max(1, Math.ceil(len / 1.5));
    for (let k = 0; k <= n; k++) {
      if (k === 0 && i > 0) continue;
      const q = a.clone().addScaledVector(d, len * k / n);
      p.box(q.x - post / 2, y, q.z - post / 2, q.x + post / 2, y + h, q.z + post / 2, 'steel');
    }
    const A = V(a.x, y + h, a.z), B = V(b.x, y + h, b.z);
    p.member(A, B, .06, .04, 'steel');
    p.member(V(a.x, y + .1, a.z), V(b.x, y + .1, b.z), .03, .03, 'steel', { edges: 'fine' });
    // mesh panels between posts
    const nrm = V(-d.z, 0, d.x);
    const M = new THREE.Matrix4().makeBasis(d, up, nrm).setPosition(V(a.x, y, a.z));
    p.push(M); p.mesh(F0, 0, len, .12, h - .03, o.pitch || .12, 0); p.pop();
  }
}

// straight stair: from top (x, yTop) running down along +x to the deck
export function stair(p, x0, z0, z1, yTop, yBot, going = .28) {
  const rise = yTop - yBot, n = Math.round(rise / .175), r = rise / n, run = going * (n - 1);
  const x1 = x0 + run;
  const top = V(x0, yTop, 0), bot = V(x1 + going, yBot, 0);
  for (const z of [z0, z1]) {
    p.member(V(x0 - .05, yTop - .05, z), V(x1 + going, yBot + .02, z), .025, .28, 'steel');
  }
  for (let i = 1; i < n; i++) {
    const x = x0 + going * (i - 1), yy = yTop - r * i;
    p.box(x, yy - .035, z0 + .02, x + going + .03, yy, z1 - .02, 'steel', { edges: true });
    p.line(x + .06, yy, z0 + .03, x + .06, yy, z1 - .03, true);
    p.line(x + .14, yy, z0 + .03, x + .14, yy, z1 - .03, true);
  }
  // handrails with posts and two middle rails
  for (const z of [z0 - .03, z1 + .03]) {
    const n2 = 4;
    for (let k = 0; k <= n2; k++) {
      const x = x0 + (run + going) * k / n2, yy = yTop - (rise) * k / n2;
      p.box(x - .025, yy, z - .025, x + .025, yy + 1.0, z + .025, 'steel');
    }
    p.member(V(x0 - .2, yTop + 1.0, z), V(x1 + going + .25, yBot + 1.0, z), .05, .05, 'steel');
    p.member(V(x0, yTop + .62, z), V(x1 + going, yBot + .62, z), .02, .02, 'steel', { edges: 'fine' });
    p.member(V(x0, yTop + .28, z), V(x1 + going, yBot + .28, z), .02, .02, 'steel', { edges: 'fine' });
  }
  return { top, bot };
}

export function picnic(p, x, z, rot = 0, y = 0) {
  p.at(x, y, z, rot);
  const L = 1.9, T = .75;
  for (let i = 0; i < 3; i++) p.box(-L / 2, T - .05, -.36 + i * .245, L / 2, T, -.36 + i * .245 + .225, 'timber', { edges: true });
  for (const s of [-1, 1]) {
    p.box(-L / 2, .42, s * .62 - .14, L / 2, .46, s * .62 + .14, 'timber');
    p.member(V(-.62, 0, s * .78), V(-.62, T - .05, s * .1), .07, .045, 'timber', { edges: true });
    p.member(V(.62, 0, s * .78), V(.62, T - .05, s * .1), .07, .045, 'timber', { edges: true });
  }
  p.box(-.66, .38, -.75, -.58, .42, .75, 'timber', { edges: 'fine' });
  p.box(.58, .38, -.75, .66, .42, .75, 'timber', { edges: 'fine' });
  p.pop();
}

export function planter(p, x0, z0, x1, z1, y = 0, h = .55, rand) {
  p.box(x0, y, z0, x1, y + h, z1, 'timber');
  for (let t = y + .11; t < y + h - .04; t += .11) {   // board joints on the faces
    p.line(x0, t, z1 + .003, x1, t, z1 + .003, true); p.line(x1 + .003, t, z0, x1 + .003, t, z1, true);
    p.line(x0, t, z0 - .003, x1, t, z0 - .003, true); p.line(x0 - .003, t, z0, x0 - .003, t, z1, true);
  }
  p.box(x0 + .05, y + h - .06, z0 + .05, x1 - .05, y + h - .02, z1 - .05, 'soil', { edges: 'fine' });
  const n = Math.max(2, Math.round((x1 - x0 + z1 - z0) * 1.2));
  for (let i = 0; i < n; i++) {
    const sx = x0 + .25 + (x1 - x0 - .5) * (n === 1 ? .5 : i / (n - 1));
    const sz = (z0 + z1) / 2 + (rand() - .5) * Math.max(0, z1 - z0 - .5);
    const rr = .2 + rand() * .16;
    p.sphere(sx, y + h + rr * .55, sz, rr, rand() > .5 ? 'leaf' : 'leaf2');
  }
}

export function tree(p, x, y0, z, h, r, rand, opening = true) {
  if (opening) {   // deck opening with a timber kerb and soil
    const a = 1.0;
    p.box(x - a, y0, z - a, x + a, y0 + .14, z - a + .12, 'timber', { edges: true });
    p.box(x - a, y0, z + a - .12, x + a, y0 + .14, z + a, 'timber', { edges: true });
    p.box(x - a, y0, z - a + .12, x - a + .12, y0 + .14, z + a - .12, 'timber', { edges: true });
    p.box(x + a - .12, y0, z - a + .12, x + a, y0 + .14, z + a - .12, 'timber', { edges: true });
    p.quad(V(x - a + .12, y0 + .06, z + a - .12), V(x + a - .12, y0 + .06, z + a - .12), V(x + a - .12, y0 + .06, z - a + .12), V(x - a + .12, y0 + .06, z - a + .12), 'soil');
    for (let i = 0; i < 9; i++) {   // soil stipple
      const sx = x - .7 + rand() * 1.4, sz = z - .7 + rand() * 1.4;
      p.line(sx, y0 + .065, sz, sx + .05, y0 + .065, sz + .03, true);
    }
  }
  // trunk: three tapering pieces with a slight lean, then limbs into the crown
  const cy = y0 + h - r * .92;                 // crown centre
  const fork = y0 + (cy - y0) * .62;
  const lx = (rand() - .5) * .5, lz = (rand() - .5) * .5;
  const w0 = .17 + h * .014;
  let prev = V(x, y0, z);
  for (let i = 1; i <= 3; i++) {
    const q = V(x + lx * i / 3 + (rand() - .5) * .06, y0 + (fork - y0) * i / 3, z + lz * i / 3 + (rand() - .5) * .06);
    p.member(prev, q, w0 * (1.08 - .14 * i), w0 * (1.08 - .14 * i), 'bark');
    prev = q;
  }
  const top = prev;
  const nl = 4;
  for (let i = 0; i < nl; i++) {
    const ang = i / nl * Math.PI * 2 + rand() * 1.1;
    const mid = V(top.x + Math.cos(ang) * r * .3, fork + (cy - fork) * .55, top.z + Math.sin(ang) * r * .3);
    const tip = V(top.x + Math.cos(ang) * r * .62, cy + (rand() - .2) * r * .45, top.z + Math.sin(ang) * r * .62);
    p.member(top, mid, w0 * .5, w0 * .5, 'bark', { edges: true });
    p.member(mid, tip, w0 * .32, w0 * .32, 'bark', { edges: 'fine' });
    const t2 = V(mid.x + Math.cos(ang + 1.2) * r * .35, mid.y + r * .4, mid.z + Math.sin(ang + 1.2) * r * .35);
    p.member(mid, t2, w0 * .24, w0 * .24, 'bark', { edges: 'fine' });
  }
  // crown: an irregular cloud of lobes on a flattened ellipsoid, like a drawn canopy
  const cx = top.x, cz = top.z, ry = r * .82;
  p.sphere(cx, cy, cz, r * .64, 'leaf');
  const ring = (n, yy, rad, rmin, rmax, tint) => {
    const a0 = rand() * 6.3;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2 + (rand() - .5) * .5;
      const rr = r * (rmin + rand() * (rmax - rmin));
      p.sphere(cx + Math.cos(a) * r * rad, cy + yy * ry + (rand() - .5) * r * .12, cz + Math.sin(a) * r * rad, rr, tint(i));
    }
  };
  ring(4, -.5, .38, .3, .4, (i) => i % 2 ? 'leaf2' : 'leaf');
  ring(8, -.05, .62, .34, .46, (i) => i % 3 ? 'leaf' : 'leaf2');
  ring(5, .42, .42, .32, .42, (i) => i % 2 ? 'leaf' : 'leaf2');
  p.sphere(cx + (rand() - .5) * r * .25, cy + ry * .78, cz + (rand() - .5) * r * .25, r * .36, 'leaf');
}

export function shrubs(p, x0, z0, x1, z1, y, n, rand, rmin = .22, rmax = .45) {
  for (let i = 0; i < n; i++) {
    const rr = rmin + rand() * (rmax - rmin);
    p.sphere(x0 + rr + rand() * Math.max(0, x1 - x0 - 2 * rr), y + rr * .6, z0 + rr + rand() * Math.max(0, z1 - z0 - 2 * rr), rr, rand() > .5 ? 'leaf' : 'leaf2');
  }
}
export function grass(p, x0, z0, x1, z1, y, n, rand) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0), h = .12 + rand() * .14;
    p.line(x, y, z, x - .05, y + h, z + .02, true); p.line(x, y, z, x + .04, y + h * .9, z - .02, true);
    p.line(x, y, z, x + .005, y + h * 1.1, z, true);
  }
}

export function subtract(iv, a, b) {
  const out = [];
  for (const [x0, x1] of iv) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out;
}


// ── round things ──────────────────────────────────────────────────────────
// a vertical cylinder (tubs, tanks, silos, chimneys): n sides, a lid unless o.open, vertical staves if o.staves
export function cylinder(p, cx, y0, cz, r, h, tint = 'timber', o = {}) {
  const n = o.n || 20, P = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; P.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  for (let i = 0; i < n; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n];
    p.quad(V(bx, y0, bz), V(ax, y0, az), V(ax, y0 + h, az), V(bx, y0 + h, bz), tint);
    if (o.staves) p.line(ax, y0, az, ax, y0 + h, az, true);
  }
  for (let i = 0; i < n; i++) {   // rims
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n];
    p.line(ax, y0 + h, az, bx, y0 + h, bz); if (o.base !== false) p.line(ax, y0, az, bx, y0, bz);
    for (const t of o.bands || []) p.line(ax, y0 + t, az, bx, y0 + t, bz, true);
  }
  if (!o.open) {
    const c = V(cx, y0 + h, cz), lid = o.lid || tint;
    for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n]; p.tri(p.tf(c), p.tf(V(bx, y0 + h, bz)), p.tf(V(ax, y0 + h, az)), lid); }
  }
  // the two silhouette lines are drawn per view by the outline pass; add a seam so it reads as round in ink
  p.line(cx + r, y0, cz, cx + r, y0 + h, cz, true);
}
// a log or pipe lying between two points: n sides, round ends
export function log(p, a, b, r, tint = 'bark', o = {}) {
  const n = o.n || 8, d = new THREE.Vector3().subVectors(b, a), len = d.length(); d.normalize();
  const u = Math.abs(d.y) > .9 ? V(1, 0, 0) : V(0, 1, 0), s = new THREE.Vector3().crossVectors(d, u).normalize(), t = new THREE.Vector3().crossVectors(s, d);
  const ring = (c) => Array.from({ length: n }, (_, i) => { const k = i / n * Math.PI * 2; return c.clone().addScaledVector(s, Math.cos(k) * r).addScaledVector(t, Math.sin(k) * r); });
  const A = ring(a), B = ring(b);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; p.quad(A[i], A[j], B[j], B[i], tint); }
  for (const [R0, c] of [[A, a], [B, b]]) for (let i = 0; i < n; i++) { const j = (i + 1) % n; p.tri(p.tf(c), p.tf(R0[j]), p.tf(R0[i]), o.end || 'timber'); p.seg(R0[i], R0[j], i % 2 === 1); }
  p.seg(A[0], B[0], true);
  return len;
}
// a triangle in the part's frame, with its edges inked (true), fine ('fine') or bare (false)
export function tri(p, a, b, c, tint = 'paper', edges = true) {
  p.tri(p.tf(a), p.tf(b), p.tf(c), tint);
  if (edges) { const f = edges === 'fine'; p.seg(a, b, f); p.seg(b, c, f); p.seg(c, a, f); }
}
