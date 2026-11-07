// Stilt cabin: a charred-timber cabin with a mono-pitch roof on a larch platform 2.6 m up on twenty piles, a stair
// down to the meadow, a barrel sauna on the deck, a rain tank fed from the roof, a hammock and a log store under it.
import * as THREE from 'three';
import { Part, V, rng } from 'boomtown/kit.js';

// ── makers shared with the other models (inlined so this file stands alone) ──

const up = V(0, 1, 0);
// a wall frame on one side of a footprint: s runs left to right seen from outside, t up, d outward
function side(r, which, y) {
  const [x0, z0, x1, z1] = r;
  switch (which) {
    case 'front': return { o: V(x0, y, z1), n: V(0, 0, 1), len: x1 - x0 };
    case 'back': return { o: V(x1, y, z0), n: V(0, 0, -1), len: x1 - x0 };
    case 'right': return { o: V(x1, y, z1), n: V(1, 0, 0), len: z1 - z0 };
    case 'left': return { o: V(x0, y, z0), n: V(-1, 0, 0), len: z1 - z0 };
  }
}
function wallM(f) {
  const u = new THREE.Vector3().crossVectors(up, f.n);
  return new THREE.Matrix4().makeBasis(u, up, f.n).setPosition(f.o);
}
const F0 = (s, t, d = 0) => V(s, t, d);   // inside a pushed wall frame the mapper is the identity

// ── wall makers (call inside p.push(wallM(f))) ────────────────────────────
function clad(p, s0, s1, t0, t1, th = .1, pitch = .15) {
  p.box(s0, t0, -th, s1, t1, 0, 'clad');
  p.ribs(F0, s0, s1, t0 + .02, t1 - .02, pitch, .004);
}
// glazing: mullions at the given s stations, transoms at the given t stations, panes between
function glaze(p, ss, ts, o = {}) {
  const fw = o.fw || .07, dep = o.dep || .1, tint = o.tint || 'steel';
  const s0 = ss[0], s1 = ss[ss.length - 1], t0 = ts[0], t1 = ts[ts.length - 1];
  for (const s of ss) p.box(s - fw / 2, t0, -dep / 2, s + fw / 2, t1, dep / 2, tint, { edges: true });
  for (const t of ts) p.box(s0, t - fw / 2, -dep / 2, s1, t + fw / 2, dep / 2, tint, { edges: true });
  for (let i = 0; i < ss.length - 1; i++) for (let j = 0; j < ts.length - 1; j++) {
    const a = ss[i] + fw / 2, b = ss[i + 1] - fw / 2, c = ts[j] + fw / 2, d = ts[j + 1] - fw / 2;
    p.glassQuad(V(a, c, 0), V(b, c, 0), V(b, d, 0), V(a, d, 0), o.strokes !== false);
  }
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

// sliding door: two leaves, the outer one slid over the fixed one
function slider(p, s0, s1, t0, t1, open = .45) {
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
function railing(p, pts, y, h = 1.1, o = {}) {
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
function stair(p, x0, z0, z1, yTop, yBot, going = .28) {
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

function picnic(p, x, z, rot = 0, y = 0) {
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

function planter(p, x0, z0, x1, z1, y = 0, h = .55, rand) {
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

function tree(p, x, y0, z, h, r, rand, opening = true) {
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

function shrubs(p, x0, z0, x1, z1, y, n, rand, rmin = .22, rmax = .45) {
  for (let i = 0; i < n; i++) {
    const rr = rmin + rand() * (rmax - rmin);
    p.sphere(x0 + rr + rand() * Math.max(0, x1 - x0 - 2 * rr), y + rr * .6, z0 + rr + rand() * Math.max(0, z1 - z0 - 2 * rr), rr, rand() > .5 ? 'leaf' : 'leaf2');
  }
}
function grass(p, x0, z0, x1, z1, y, n, rand) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0), h = .12 + rand() * .14;
    p.line(x, y, z, x - .05, y + h, z + .02, true); p.line(x, y, z, x + .04, y + h * .9, z - .02, true);
    p.line(x, y, z, x + .005, y + h * 1.1, z, true);
  }
}

function subtract(iv, a, b) {
  const out = [];
  for (const [x0, x1] of iv) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out;
}


// ── makers for the newer houses ─────────────────────────────────────────
// a wall of length len and height h in the current wall frame (s along, t up, d out), solid corrugated sheet
// round a set of openings [{s0, s1, t0, t1, kind: 'glass' | 'slider' | 'door' | 'void', ss, ts}]
function openWall(p, len, h, ops, tint, o = {}) {
  const th = o.th ?? .06, pitch = o.pitch ?? .14, ribbed = o.ribs !== false;
  // vertical strips between the openings' edges
  const cuts = [0, len]; for (const q of ops) cuts.push(q.s0, q.s1);
  const xs = [...new Set(cuts.map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2; if (b - a < 1e-3) continue;
    const q = ops.find((q) => m > q.s0 && m < q.s1);
    const spans = q ? [[0, q.t0], [q.t1, h]] : [[0, h]];
    for (const [t0, t1] of spans) if (t1 - t0 > .01) {
      p.box(a, t0, -th, b, t1, 0, tint, { edges: 'fine' });
      if (ribbed) p.ribs(F0, a, b, t0 + .02, t1 - .02, pitch, .004);
    }
  }
  // outline of the whole wall in the main ink
  p.poly([V(0, 0, .003), V(len, 0, .003), V(len, h, .003), V(0, h, .003)], true);
  for (const q of ops) {
    const fr = o.frame || 'steel';
    p.poly([V(q.s0, q.t0, .005), V(q.s1, q.t0, .005), V(q.s1, q.t1, .005), V(q.s0, q.t1, .005)], true);
    if (q.kind === 'glass') glaze(p, q.ss || range(q.s0, q.s1, Math.max(1, Math.round((q.s1 - q.s0) / 1.2))), q.ts || [q.t0, q.t1], { tint: fr, fw: .06, dep: .08 });
    if (q.kind === 'slider') slider(p, q.s0, q.s1, q.t0, q.t1, .5);
    if (q.kind === 'door') {
      p.box(q.s0, q.t0, -.04, q.s1, q.t1, -.01, q.tint || 'dark', { edges: true });
      p.box(q.s1 - .14, q.t0 + 1.0, -.01, q.s1 - .1, q.t0 + 1.1, .03, 'steel', { edges: 'fine' });
    }
  }
}

// a shipping container laid along local +x from (0,0,0): L long, W deep (z), H high. sides: front (+z), back,
// left (-x end), right (+x end), each a list of openings. Corner castings, rails and the end doors' bars.
function container(p, L, W, H, tint, sides = {}, o = {}) {
  const c = .16, fr = o.frame || 'steel';
  // corner posts and the four top and bottom rails
  for (const [x, z] of [[0, 0], [L, 0], [0, W], [L, W]]) p.box(x - (x ? c : 0), 0, z - (z ? c : 0), x + (x ? 0 : c), H, z + (z ? 0 : c), fr);
  for (const y of [0, H - .16]) {
    p.box(c, y, 0, L - c, y + .16, c, fr); p.box(c, y, W - c, L - c, y + .16, W, fr);
    p.box(0, y, c, c, y + .16, W - c, fr); p.box(L - c, y, c, L, y + .16, W - c, fr);
  }
  // castings: small dark blocks at the eight corners
  for (const [x, z] of [[0, 0], [L, 0], [0, W], [L, W]]) for (const y of [0, H - .12]) {
    const x0 = x ? L - .18 : 0, z0 = z ? W - .18 : 0;
    p.box(x0 - (x ? .005 : .005), y, z0 - .005, x0 + .185, y + .125, z0 + .185, 'dark', { edges: 'fine' });
  }
  // the walls between the rails
  const r = [0, 0, L, W], hh = H - .32;
  for (const which of ['front', 'back', 'left', 'right']) {
    const f = side(r, which, .16);
    // wall frame inset so the sheet sits inside the posts
    p.push(wallM(f));
    p.push(new THREE.Matrix4().makeTranslation(c, 0, -.03));
    openWall(p, f.len - 2 * c, hh, sides[which] || [], tint, { pitch: o.pitch ?? .14, frame: fr });
    p.pop(); p.pop();
  }
  // roof: a sheet with a few dents, floor
  p.box(c, H - .05, c, L - c, H - .02, W - c, tint, { edges: 'fine' });
  for (let x = .9; x < L - .5; x += 1.2) p.line(x, H - .015, c + .05, x, H - .015, W - c - .05, true);
  p.box(c, .1, c, L - c, .16, W - c, 'timber', { edges: false });
}

// a cylinder along local +y: centre (cx, cz), from y0 up h; n facets; the outline drawn as rings and a few lines
function cylinder(p, cx, y0, cz, r, h, tint, o = {}) {
  const n = o.n || 20, lines = o.lines ?? 4;
  const P = (i, y) => { const a = i / n * Math.PI * 2; return V(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r); };
  for (let i = 0; i < n; i++) {
    p.quad(P(i, y0), P(i, y0 + h), P(i + 1, y0 + h), P(i + 1, y0), tint);
    if (o.top !== false) p.quad(V(cx, y0 + h, cz), P(i + 1, y0 + h), P(i, y0 + h), V(cx, y0 + h, cz), tint);
    p.seg(P(i, y0), P(i + 1, y0)); p.seg(P(i, y0 + h), P(i + 1, y0 + h));
    if (lines && i % Math.round(n / lines) === 0) p.seg(P(i, y0), P(i, y0 + h), true);
    if (o.bands) for (const b of o.bands) p.seg(P(i, y0 + b), P(i + 1, y0 + b), true);
  }
}

// a horizontal barrel (sauna): axis along local +z, centre (cx, cy), from z0 to z1, staves as fine lines
function barrel(p, cx, cy, z0, z1, r, tint, o = {}) {
  const n = o.n || 22;
  const P = (i, z) => { const a = i / n * Math.PI * 2; return V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z); };
  for (let i = 0; i < n; i++) {
    p.quad(P(i, z0), P(i + 1, z0), P(i + 1, z1), P(i, z1), tint);
    p.seg(P(i, z0), P(i + 1, z0)); p.seg(P(i, z1), P(i + 1, z1));
    p.seg(P(i, z0), P(i, z1), true);
  }
  // end walls
  for (const [z, s] of [[z0, -1], [z1, 1]]) for (let i = 0; i < n; i++) {
    const a = P(i, z), b = P(i + 1, z), c = V(cx, cy, z);
    if (s > 0) p.quad(c, a, b, c, o.end || tint); else p.quad(c, b, a, c, o.end || tint);
  }
  // steel hoops
  for (const zz of o.hoops || []) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, rr = r + .02;
    p.seg(V(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, zz), V(cx + Math.cos(b) * rr, cy + Math.sin(b) * rr, zz));
  }
}

// spiral stair round a column at (cx, cz): from y0 up to y1, turning `turns` from angle a0, steps of width w
function spiral(p, cx, cz, y0, y1, a0, turns, r, tint = 'steel') {
  const n = Math.round((y1 - y0) / .19), rise = (y1 - y0) / n, da = turns * Math.PI * 2 / n;
  p.member(V(cx, y0, cz), V(cx, y1 + 1.0, cz), .16, .16, tint);
  const rail = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + da * i, y = y0 + rise * (i + 1);
    const u = V(Math.cos(a), 0, Math.sin(a)), v = V(Math.cos(a + da * 1.15), 0, Math.sin(a + da * 1.15));
    const A = V(cx, y, cz).addScaledVector(u, .1), B = V(cx, y, cz).addScaledVector(u, r), C = V(cx, y, cz).addScaledVector(v, r), D = V(cx, y, cz).addScaledVector(v, .1);
    // tread as a thin wedge: top and outer edge
    p.quadW(A, D, C, B, tint); p.quadW(A.clone().setY(y - .04), B.clone().setY(y - .04), C.clone().setY(y - .04), D.clone().setY(y - .04), tint);
    p.quadW(B.clone().setY(y - .04), B, C, C.clone().setY(y - .04), tint);
    p._segW(p.ink, B, C); p._segW(p.ink, A, B); p._segW(p.fine, D, C);
    const top = V(cx, y + .95, cz).addScaledVector(u, r - .04);
    p.member(V(cx, y, cz).addScaledVector(u, r - .04), top, .025, .025, tint, { edges: 'fine' });
    rail.push(top);
  }
  for (let i = 0; i < rail.length - 1; i++) p.member(rail[i], rail[i + 1], .05, .05, tint);
}

// a plane roof sheet over a rectangle, from height ya at z0 to yb at z1 (a mono pitch), with standing seams
function monoRoof(p, x0, x1, z0, z1, ya, yb, th, tint, seam = .5) {
  const A = V(x0, ya, z0), B = V(x1, ya, z0), C = V(x1, yb, z1), D = V(x0, yb, z1);
  const up = (v) => v.clone().setY(v.y + th);
  p.quadW(up(D), up(C), up(B), up(A), tint); p.quadW(A, B, C, D, tint);
  p.quadW(D, C, up(C), up(D), tint); p.quadW(B, A, up(A), up(B), tint);
  p.quadW(A, D, up(D), up(A), tint); p.quadW(C, B, up(B), up(C), tint);
  for (const [a, b] of [[up(A), up(B)], [up(B), up(C)], [up(C), up(D)], [up(D), up(A)], [D, C], [A, D], [B, C]]) p._segW(p.ink, a, b);
  for (let x = x0 + seam; x < x1 - seam * .4; x += seam) p._segW(p.fine, V(x, ya + th + .01, z0), V(x, yb + th + .01, z1));
}

// vertical boarding on a wall frame: fine lines every pitch
function boards(p, s0, s1, t0, t1, pitch = .14, d = .004) {
  for (let s = s0 + pitch; s < s1 - pitch * .4; s += pitch) p.seg(V(s, t0, d), V(s, t1, d), true);
}

// ── the model ──

const BEAM = 2.6, DK = 2.85;                 // beam top, deck top
const PX = [-6, -3, 0, 3, 6], PZ = [-4.5, -1.5, 1.5, 4.5];
const CAB = { x0: -5.6, x1: 1.6, z0: -3.8, z1: 1.2 };
const HB = 2.6, HF = 3.9;                    // cabin wall height at the back and the front
const TOP = DK + HF + .45;

export function build() {
  const parts = [];
  const P = (def) => { const p = new Part(def); parts.push(p); return p; };
  const R = rng(20261109);

  {
    const p = P({ id: 'site', start: .1, dur: 1.3, list: false, mono: true, site: true });
    const X = 15, Z = 12;
    for (let x = -15; x <= 15; x += 3) p.line(x, 0, -Z + .6, x, 0, Z - .6, true);
    for (let z = -12; z <= 12; z += 3) p.line(-X + .6, 0, z, X - .6, 0, z, true);
    const dash = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize(); for (let s = 0; s < L; s += 1.6) p.seg(a.clone().addScaledVector(d, s), a.clone().addScaledVector(d, Math.min(L, s + 1))); };
    dash(V(-X, 0, -Z), V(X, 0, -Z)); dash(V(X, 0, -Z), V(X, 0, Z)); dash(V(X, 0, Z), V(-X, 0, Z)); dash(V(-X, 0, Z), V(-X, 0, -Z));
    for (const x of PX) for (const z of PZ) { p.line(x - .5, 0, z, x + .5, 0, z); p.line(x, 0, z - .5, x, 0, z + .5); }
    p.anchors.main = V(0, 0, 6);
  }

  // 1 · piles: concrete pads, twenty larch posts, steel cross-bracing, beams
  {
    const p = P({ id: 'piles', start: .5, dur: 1.3, el: BEAM, explode: V(0, 0, 0), big: true, view: { az: .45, el: .12 } });
    for (const x of PX) for (const z of PZ) {
      p.box(x - .35, 0, z - .35, x + .35, .18, z + .35, 'concrete', { edges: true });
      p.box(x - .13, .18, z - .13, x + .13, BEAM - .22, z + .13, 'timber');
      p.line(x - .132, .5, z + .132, x + .132, .5, z + .132, true);
    }
    // X-bracing in the outer bays, steel rods
    for (const z of [PZ[0], PZ[3]]) for (let i = 0; i < PX.length - 1; i++) {
      p.member(V(PX[i], .4, z), V(PX[i + 1], BEAM - .45, z), .03, .03, 'steel', { edges: 'fine' });
      p.member(V(PX[i + 1], .4, z), V(PX[i], BEAM - .45, z), .03, .03, 'steel', { edges: 'fine' });
    }
    for (const x of [PX[0], PX[4]]) for (let j = 0; j < PZ.length - 1; j++) {
      p.member(V(x, .4, PZ[j]), V(x, BEAM - .45, PZ[j + 1]), .03, .03, 'steel', { edges: 'fine' });
      p.member(V(x, .4, PZ[j + 1]), V(x, BEAM - .45, PZ[j]), .03, .03, 'steel', { edges: 'fine' });
    }
    for (const z of PZ) p.box(-6.3, BEAM - .22, z - .1, 6.3, BEAM, z + .1, 'timber');
    p.anchors.main = V(6, 1.2, 4.5);
    p.anchors.brace = V(4.5, 1.4, 4.5);
  }

  // 2 · platform: joists and larch boards
  {
    const p = P({ id: 'platform', start: 1.2, dur: 1.0, el: DK, explode: V(0, 1.0, 0), big: true, view: { az: .3, el: .5 } });
    for (let x = -6.2; x <= 6.21; x += .6) p.box(x - .04, BEAM, -4.8, x + .04, DK - .04, 4.8, 'timber', { edges: 'fine' });
    p.box(-6.3, DK - .04, -4.8, 6.3, DK, 4.8, 'deck', { skip: 'y' });
    p.box(-6.35, BEAM - .05, 4.8, 6.35, DK, 4.86, 'deck');                         // fascia boards
    p.box(6.3, BEAM - .05, -4.8, 6.36, DK, 4.8, 'deck');
    for (let z = -4.8 + .14; z < 4.8; z += .14) p.line(-6.3, DK, z, 6.3, DK, z, true);
    p.anchors.main = V(4.6, DK, 3.4);
  }

  // 3 · cabin: charred timber boards, the front all glass, a stove and a bed inside
  {
    const p = P({ id: 'cabin', start: 1.9, dur: 1.3, el: DK + HF, explode: V(0, 2.4, -1.2), lift: 1.0, view: { az: .35, el: .2 } });
    const { x0, x1, z0, z1 } = CAB, y = DK, dz = z1 - z0;
    // floor
    p.box(x0, y, z0, x1, y + .08, z1, 'deck', { edges: 'fine' });
    // the front: full-height glazing with a slider in the middle
    let f = side([x0, z0, x1, z1], 'front', y + .08); p.push(wallM(f));
    glaze(p, [0, 1.6, 3.0], [0, 2.4, HF - .08], { tint: 'timber', fw: .08, dep: .12 });
    slider(p, 3.0, 5.0, 0, 2.4, .5); glaze(p, [3.0, 5.0], [2.4, HF - .08], { tint: 'timber', fw: .08, dep: .12 });
    glaze(p, [5.0, 6.1, f.len], [0, 2.4, HF - .08], { tint: 'timber', fw: .08, dep: .12 });
    p.pop();
    // the back: boards with a long slot window
    f = side([x0, z0, x1, z1], 'back', y + .08); p.push(wallM(f));
    p.box(0, 0, -.12, f.len, .9, 0, 'dark'); p.box(0, 1.5, -.12, f.len, HB - .08, 0, 'dark');
    p.box(0, .9, -.12, 1.0, 1.5, 0, 'dark'); p.box(f.len - 1.0, .9, -.12, f.len, 1.5, 0, 'dark');
    glaze(p, range(1.0, f.len - 1.0, 4), [.9, 1.5], { tint: 'timber', fw: .06, dep: .08 });
    boards(p, 0, f.len, 0, .9, .16); boards(p, 0, f.len, 1.5, HB - .08, .16);
    p.pop();
    // the two ends: a trapezoid each, boards running up to the roof's slope
    for (const [xx, sgn] of [[x0, -1], [x1, 1]]) {
      const a = (z) => y + .08 + HB - .08 + (HF - HB) * (z - z0) / dz;   // the top edge
      const xo = xx + sgn * .001, xi = xx - sgn * .12;
      const A = V(xo, y + .08, z0), B = V(xo, y + .08, z1), C = V(xo, a(z1), z1), D = V(xo, a(z0), z0);
      if (sgn > 0) { p.quadW(A, D, C, B, 'dark'); } else { p.quadW(A, B, C, D, 'dark'); }
      const Ai = V(xi, y + .08, z0), Bi = V(xi, y + .08, z1), Ci = V(xi, a(z1), z1), Di = V(xi, a(z0), z0);
      if (sgn > 0) p.quadW(Ai, Bi, Ci, Di, 'dark'); else p.quadW(Ai, Di, Ci, Bi, 'dark');
      p.quadW(D, Di, Ci, C, 'dark');
      p._segW(p.ink, A, B); p._segW(p.ink, B, C); p._segW(p.ink, C, D); p._segW(p.ink, D, A);
      for (let z = z0 + .16; z < z1 - .05; z += .16) p._segW(p.fine, V(xo + sgn * .003, y + .1, z), V(xo + sgn * .003, a(z) - .02, z));
      // a square window in the east end
      if (sgn > 0) {
        const M = new THREE.Matrix4().makeBasis(V(0, 0, -1), V(0, 1, 0), V(1, 0, 0)).setPosition(V(x1 + .01, y + .08, z1));
        p.push(M); glaze(p, [1.2, 2.6], [.9, 2.2], { tint: 'timber', fw: .07, dep: .08 }); p.pop();
      }
    }
    // inside: a stove with its flue, a bed, a rug
    cylinder(p, -4.6, y + .08, -2.9, .32, .8, 'steel', { n: 12, lines: 2 });
    p.member(V(-4.6, y + .88, -2.9), V(-4.6, TOP + .9, -2.9), .14, .14, 'steel');
    p.box(-1.2, y + .08, -3.6, 1.3, y + .55, -1.4, 'paper'); p.box(-1.2, y + .55, -3.6, 1.3, y + .62, -1.4, 'fabric', { edges: 'fine' });
    p.box(-4.0, y + .08, -1.2, -1.6, y + .1, .6, 'yellow', { edges: 'fine' });
    p.anchors.main = V(x1, y + 2.0, z1);
    p.anchors.glass = V(-2.0, y + 1.6, z1 + .05);
    p.anchors.flue = V(-4.6, TOP + .6, -2.9);
  }

  // 4 · roof: one mono pitch rising to the south over the glass, green standing-seam sheet, a gutter at the back
  {
    const p = P({ id: 'roof', start: 3.0, dur: 1.0, el: TOP, explode: V(0, 5.2, -1.0), lift: 1.0, view: { az: .25, el: .55 } });
    const { x0, x1, z0, z1 } = CAB, dz = z1 - z0, k = (HF - HB) / dz;
    const ya = DK + HB - k * .6, yb = DK + HF + k * 1.0;
    monoRoof(p, x0 - .5, x1 + .5, z0 - .6, z1 + 1.0, ya, yb, .22, 'clad', .45);
    // gutter and the rafter ends under the front eave
    p.box(x0 - .5, ya - .16, z0 - .78, x1 + .5, ya, z0 - .6, 'steel', { edges: true });
    for (let x = x0 - .3; x <= x1 + .31; x += .6) p.box(x - .04, yb - .16, z1 + .2, x + .04, yb, z1 + 1.0, 'timber', { edges: 'fine' });
    p.anchors.main = V(x1 + .5, yb + .2, z1 + .6);
    p.anchors.gutter = V(x0 - .5, ya - .1, z0 - .7);
  }

  // 5 · railing round the deck: larch posts and rails, steel cables between
  {
    const p = P({ id: 'railing', start: 3.6, dur: .9, el: DK + 1.0, explode: V(0, 1.6, 1.6), view: { az: .7, el: .3 } });
    const run = (a, b) => {
      const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
      const n = Math.max(1, Math.ceil(L / 1.4));
      for (let i = 0; i <= n; i++) { const q = a.clone().addScaledVector(d, L * i / n); p.box(q.x - .05, DK, q.z - .05, q.x + .05, DK + 1.05, q.z + .05, 'timber'); }
      p.member(V(a.x, DK + 1.05, a.z), V(b.x, DK + 1.05, b.z), .14, .05, 'timber');
      for (let h = .15; h < 1.0; h += .13) p.member(V(a.x, DK + h, a.z), V(b.x, DK + h, b.z), .012, .012, 'steel', { edges: 'fine' });
    };
    const e = .05;
    run(V(-6.3 + e, 0, 4.8 - e), V(3.1, 0, 4.8 - e));
    run(V(4.5, 0, 4.8 - e), V(6.3 - e, 0, 4.8 - e));
    run(V(6.3 - e, 0, 4.8 - e), V(6.3 - e, 0, -4.8 + e));
    run(V(6.3 - e, 0, -4.8 + e), V(-6.3 + e, 0, -4.8 + e));
    run(V(-6.3 + e, 0, -4.8 + e), V(-6.3 + e, 0, 4.8 - e));
    p.anchors.main = V(-1, DK + 1.05, 4.8);
  }

  // 6 · stair down to the meadow
  {
    const p = P({ id: 'stair', start: 4.1, dur: .9, el: DK, explode: V(0, 0, 3.0), view: { az: .9, el: .2 } });
    p.at(4.45, 0, 4.8, -Math.PI / 2);
    stair(p, 0, .05, 1.25, DK, 0);
    p.pop();
    p.box(3.0, 0, 9.3, 4.6, .06, 10.2, 'concrete', { edges: true });
    p.anchors.main = V(4.6, 1.4, 7.2);
  }

  // 7 · barrel sauna on the deck with a steel chimney
  {
    const p = P({ id: 'sauna', start: 4.6, dur: 1.0, el: DK + 2.2, explode: V(3.0, 2.6, -1.0), lift: 1.0, view: { az: 1.05, el: .3 } });
    const cx = 4.5, r = 1.05, cy = DK + .1 + r, z0 = -4.4, z1 = -1.4;
    for (const z of [z0 + .3, z1 - .3]) { p.box(cx - .9, DK, z - .08, cx + .9, DK + .1, z + .08, 'timber'); p.box(cx - .6, DK + .1, z - .07, cx + .6, DK + .4, z + .07, 'timber', { edges: 'fine' }); }
    barrel(p, cx, cy, z0, z1, r, 'timber', { end: 'deck', hoops: [z0 + .3, z1 - .3] });
    // the door with a round light in the south end, the chimney through the top
    p.box(cx - .38, DK + .25, z1 + .005, cx + .38, DK + 1.85, z1 + .03, 'deck', { edges: true });
    cylinder(p, cx + .3, cy + r * .8, z0 + .8, .1, 1.6, 'steel', { n: 8, lines: 2 });
    cylinder(p, cx + .3, cy + r * .8 + 1.6, z0 + .8, .17, .12, 'steel', { n: 10, lines: 0 });
    p.anchors.main = V(cx + r, cy, (z0 + z1) / 2);
    p.anchors.chimney = V(cx + .3, cy + r + 1.4, z0 + .8);
  }

  // 8 · water: downpipe from the gutter to a blue rain tank on the ground
  {
    const p = P({ id: 'water', start: 5.1, dur: .8, el: 1.8, explode: V(-2.5, 0, -2.0), view: { az: -2.2, el: .25 } });
    const gx = CAB.x0 - .3, gz = CAB.z0 - .7, gy = DK + HB - (HF - HB) / (CAB.z1 - CAB.z0) * .6 - .16;
    p.member(V(gx, gy, gz), V(gx, 2.1, gz), .1, .1, 'steel');
    p.member(V(gx, 2.1, gz), V(-7.6, 1.95, -6.0), .1, .1, 'steel');
    cylinder(p, -7.6, .3, -6.0, .9, 1.6, 'blue', { n: 20, lines: 4, bands: [.5, 1.1] });
    p.box(-8.6, 0, -7.0, -6.6, .3, -5.0, 'concrete', { edges: true });
    p.member(V(-7.0, .55, -5.25), V(-6.6, .55, -5.0), .06, .06, 'steel', { edges: 'fine' });   // tap
    p.anchors.main = V(-7.6, 1.6, -5.1);
  }

  // 9 · under the house: a hammock between two piles and a log store
  {
    const p = P({ id: 'under', start: 5.5, dur: .9, el: 1.2, explode: V(0, -0.0, 3.5), view: { az: .2, el: .12 } });
    // hammock: a sagging net of segments between piles (-3, 1.5) and (0, 1.5)
    const A = V(-2.85, 1.6, 1.5), B = V(-.15, 1.6, 1.5), n = 14;
    const pt = (u, off) => { const q = A.clone().lerp(B, u); q.y -= Math.sin(Math.PI * u) * .75; q.z += off * Math.sin(Math.PI * u); return q; };
    for (const off of [-.42, -.21, 0, .21, .42]) for (let i = 0; i < n; i++) p.seg(pt(i / n, off), pt((i + 1) / n, off), off !== -.42 && off !== .42);
    for (let i = 1; i < n; i++) p.seg(pt(i / n, -.42), pt(i / n, .42), true);
    for (let i = 0; i < n; i++) for (const [a, b] of [[-.42, 0], [0, .42]]) p.quadW(pt(i / n, a), pt(i / n, b), pt((i + 1) / n, b), pt((i + 1) / n, a), 'fabric');
    for (let i = 0; i < n; i++) for (const [a, b] of [[-.42, 0], [0, .42]]) p.quadW(pt(i / n, a), pt((i + 1) / n, a), pt((i + 1) / n, b), pt(i / n, b), 'fabric');
    // log store against the back piles
    p.box(1.4, 0, -4.9, 4.6, .12, -4.1, 'timber', { edges: true });
    for (let row = 0; row < 4; row++) for (let i = 0; i < 9 - row; i++) {
      const x = 1.6 + i * .34 + row * .17, y = .12 + .16 + row * .3;
      const P2 = (a, z) => V(x + Math.cos(a) * .16, y + Math.sin(a) * .16, z);
      for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2; p.quadW(P2(a0, -4.15), P2(a1, -4.15), P2(a1, -4.85), P2(a0, -4.85), 'bark'); p.quadW(V(x, y, -4.15), P2(a0, -4.15), P2(a1, -4.15), V(x, y, -4.15), 'timber'); p._segW(p.ink, P2(a0, -4.15), P2(a1, -4.15)); }
    }
    p.anchors.main = V(-1.5, 1.0, 1.9);
    p.anchors.logs = V(4.6, 1.0, -4.1);
  }

  // 10 · trees round the cabin, a fire pit by the stair's foot
  {
    const p = P({ id: 'landscape', start: 5.9, dur: 1.4, el: 0, explode: V(0, 0, 0), planting: true, view: { az: -.25, el: .3 } });
    tree(p, -9.6, 0, 2.5, 9.2, 3.0, R, false);
    tree(p, 9.6, 0, -3.0, 8.4, 2.8, R, false);
    tree(p, -4.0, 0, -9.2, 9.8, 3.1, R, false);
    tree(p, 8.6, 0, 8.8, 6.4, 2.2, R, false);
    shrubs(p, -9.0, -3.0, -7.0, 0, 0, 8, R, .3, .55);
    shrubs(p, 7.4, 1.4, 9.4, 4.0, 0, 7, R, .3, .5);
    grass(p, -6, 5.5, 2, 9, 0, 70, R);
    // fire pit: a ring of stones round a dark bowl, three log seats
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; p.box(.8 + Math.cos(a) * .75 - .14, 0, 8.6 + Math.sin(a) * .75 - .12, .8 + Math.cos(a) * .75 + .14, .2, 8.6 + Math.sin(a) * .75 + .12, 'concrete', { edges: 'fine' }); }
    cylinder(p, .8, 0, 8.6, .55, .06, 'dark', { n: 14, lines: 0 });
    for (const a of [.6, 2.2, 3.9]) cylinder(p, .8 + Math.cos(a) * 1.9, 0, 8.6 + Math.sin(a) * 1.9, .22, .42, 'bark', { n: 10, lines: 2 });
    p.anchors.main = V(-9.6, 7.0, 2.5);
    p.anchors.fire = V(.8, .3, 8.6);
  }
  return parts;
}

const el = (v) => '+' + v.toFixed(2);
export const CALLOUTS = [
  { part: 'roof', a: 'main', k: 'roof', el: el(TOP), o: true },
  { part: 'cabin', a: 'flue', k: 'flue', o: false },
  { part: 'sauna', a: 'chimney', k: 'sauna', o: true },
  { part: 'cabin', a: 'main', k: 'cabin', el: el(DK), o: true },
  { part: 'cabin', a: 'glass', k: 'glass', o: false },
  { part: 'railing', a: 'main', k: 'railing', el: 'H 1050', o: true },
  { part: 'platform', a: 'main', k: 'platform', el: el(DK), o: true },
  { part: 'stair', a: 'main', k: 'stair', o: true },
  { part: 'piles', a: 'main', k: 'piles', el: el(BEAM), o: true },
  { part: 'piles', a: 'brace', k: 'brace', o: false },
  { part: 'water', a: 'main', k: 'water', o: true },
  { part: 'under', a: 'main', k: 'hammock', o: true },
  { part: 'under', a: 'logs', k: 'logs', o: false },
  { part: 'roof', a: 'gutter', k: 'gutter', o: false },
  { part: 'landscape', a: 'fire', k: 'fire', o: false },
];

export const ORDER = ['piles', 'platform', 'cabin', 'roof', 'railing', 'stair', 'sauna', 'water', 'under', 'landscape'];
export const PART = {
  piles: { code: 'SC-01', el: el(BEAM), mass: 6.8, qty: 20 },
  platform: { code: 'SC-02', el: el(DK), mass: 5.2, qty: 690 },
  cabin: { code: 'SC-03', el: el(DK), mass: 9.5, qty: 1 },
  roof: { code: 'SC-04', el: el(TOP), mass: 1.4, qty: 1 },
  railing: { code: 'SC-05', el: el(DK + 1.05), mass: .6, qty: 34 },
  stair: { code: 'SC-06', el: el(DK), mass: .8, qty: 16 },
  sauna: { code: 'SC-07', el: el(DK + 2.2), mass: 1.1, qty: 1 },
  water: { code: 'SC-08', el: '+1.90', mass: .2, qty: 1 },
  under: { code: 'SC-09', el: '+1.60', mass: .4, qty: 2 },
  landscape: { code: 'SC-10', el: '+0.00', mass: 0, qty: 4 },
};
export const LEVELS = [{ v: 0, k: 'ground' }, { v: BEAM, k: 'beam' }, { v: DK, k: 'deck' }, { v: TOP, k: 'roof' }];

export const TEXT = {
  en: {
    ui: { title: 'stilt cabin', sub: 'A charred-timber cabin on a larch platform 2.6 m up on twenty piles, with a barrel sauna.', drawingV: 'stilt cabin · axonometric', sheet: 'sheet C-401' },
    stats: [['deck area', '121 m²'], ['mass', '26 t'], ['piles', '20 · 10 parts']],
    name: { piles: 'Piles and beams', platform: 'Larch platform', cabin: 'Cabin', roof: 'Mono-pitch roof', railing: 'Deck railing', stair: 'Stair to the meadow', sauna: 'Barrel sauna', water: 'Rain tank', under: 'Hammock and logs', landscape: 'Trees and fire pit', site: 'Site' },
    co: { roof: 'Standing-seam roof', flue: 'Stove flue', sauna: 'Barrel sauna', cabin: 'Charred-timber cabin', glass: 'Glazed south wall', railing: 'Cable railing', platform: 'Larch platform', stair: 'Timber stair', piles: 'Larch piles · 20', brace: 'Steel X-bracing', water: 'Rain tank · 4 m³', hammock: 'Hammock', logs: 'Log store', gutter: 'Gutter', fire: 'Fire pit' },
    lv: { ground: 'ground', beam: 'beams', deck: 'deck', roof: 'roof' },
    info: {
      piles: { size: '12.0 × 9.0 m grid', mat: 'larch posts 260 × 260 on concrete pads', trade: 'carpentry', qty: '20 piles · 16 rods', note: 'Steel rods brace the outer bays both ways.' },
      platform: { size: '12.6 × 9.6 m', mat: 'joists at 600, larch boards', trade: 'carpentry', qty: '690 boards', note: 'Wraps the cabin on all four sides; the stair lands on the south edge.' },
      cabin: { size: '7.2 × 5.0 m', mat: 'charred larch boards, triple glazing', trade: 'carpentry and glazing', qty: '1 room · 36 m²', note: 'The south wall is all glass with a sliding door; a stove and a bed inside.' },
      roof: { size: '8.2 × 6.6 m', mat: 'green standing-seam steel', trade: 'roofing', qty: '1 pitch · 8°', note: 'Rises to the south over the glass; the gutter runs along the north.' },
      railing: { size: '44 m run', mat: 'larch posts and rail, steel cables', trade: 'carpentry', qty: '34 posts · 7 cables', note: 'H 1050, open at the stair head.' },
      stair: { size: '4.5 × 1.2 m', mat: 'steel stringers, larch treads', trade: 'steel', qty: '16 risers × 178 mm', note: 'Lands on a concrete pad near the fire pit.' },
      sauna: { size: 'Ø 2.1 × 3.0 m', mat: 'thermo-pine staves, steel hoops', trade: 'carpentry', qty: '1 barrel', note: 'A wood stove inside; its chimney leaves through the top.' },
      water: { size: 'Ø 1.8 × 1.6 m', mat: 'polyethylene tank, steel pipe', trade: 'plumbing', qty: '4 000 l', note: 'Fed from the roof’s gutter; a tap for the garden.' },
      under: { size: '2.7 m hammock · 3.2 m store', mat: 'cotton net, birch logs', trade: 'outdoor', qty: '1 hammock · 30 logs', note: 'In the shade under the platform.' },
      landscape: { size: 'lot 30 × 24 m', mat: 'meadow, pines, shrubs', trade: 'landscape', qty: '4 trees · 3 log seats', note: 'A fire pit by the foot of the stair.' },
    },
  },
  ru: {
    ui: { title: 'дом на сваях', sub: 'Домик из обожжённой доски на платформе в 2,6 м над землёй, на двадцати сваях, с баней-бочкой.', drawingV: 'дом на сваях · аксонометрия', sheet: 'лист C-401' },
    stats: [['площадь настила', '121 м²'], ['масса', '26 т'], ['сваи', '20 · 10 частей']],
    name: { piles: 'Сваи и балки', platform: 'Платформа', cabin: 'Домик', roof: 'Односкатная крыша', railing: 'Ограждение', stair: 'Лестница на луг', sauna: 'Баня-бочка', water: 'Бак для воды', under: 'Гамак и дрова', landscape: 'Деревья и костровище', site: 'Участок' },
    co: { roof: 'Фальцевая кровля', flue: 'Труба печи', sauna: 'Баня-бочка', cabin: 'Домик · обожжённая доска', glass: 'Стеклянная южная стена', railing: 'Тросовое ограждение', platform: 'Платформа · лиственница', stair: 'Деревянная лестница', piles: 'Сваи · 20 шт', brace: 'Стальные связи', water: 'Бак · 4 м³', hammock: 'Гамак', logs: 'Дровник', gutter: 'Водосток', fire: 'Костровище' },
    lv: { ground: 'земля', beam: 'балки', deck: 'настил', roof: 'крыша' },
    info: {
      piles: { size: 'сетка 12,0 × 9,0 м', mat: 'столбы из лиственницы 260 × 260 на бетонных подушках', trade: 'плотницкие', qty: '20 свай · 16 тяжей', note: 'Стальные тяжи связывают крайние пролёты в обе стороны.' },
      platform: { size: '12,6 × 9,6 м', mat: 'лаги через 600, доска лиственницы', trade: 'плотницкие', qty: '690 досок', note: 'Обходит домик со всех сторон; лестница выходит на южный край.' },
      cabin: { size: '7,2 × 5,0 м', mat: 'обожжённая доска, тройное остекление', trade: 'плотницкие и остекление', qty: '1 комната · 36 м²', note: 'Южная стена целиком стеклянная с раздвижной дверью; внутри печь и кровать.' },
      roof: { size: '8,2 × 6,6 м', mat: 'зелёная фальцевая сталь', trade: 'кровля', qty: '1 скат · 8°', note: 'Поднимается к югу над стеклом; водосток идёт по северу.' },
      railing: { size: '44 м', mat: 'стойки и поручень из лиственницы, стальные тросы', trade: 'плотницкие', qty: '34 стойки · 7 тросов', note: 'H 1050, разрыв у лестницы.' },
      stair: { size: '4,5 × 1,2 м', mat: 'стальные косоуры, ступени из лиственницы', trade: 'металл', qty: '16 подъёмов × 178 мм', note: 'Опускается на бетонную площадку у костровища.' },
      sauna: { size: 'Ø 2,1 × 3,0 м', mat: 'клёпка из термососны, стальные обручи', trade: 'плотницкие', qty: '1 бочка', note: 'Внутри дровяная печь; труба выходит через верх.' },
      water: { size: 'Ø 1,8 × 1,6 м', mat: 'полиэтиленовый бак, стальная труба', trade: 'сантехника', qty: '4 000 л', note: 'Наполняется из водостока крыши; кран для сада.' },
      under: { size: 'гамак 2,7 м · дровник 3,2 м', mat: 'хлопковая сетка, берёзовые поленья', trade: 'отдых', qty: '1 гамак · 30 поленьев', note: 'В тени под платформой.' },
      landscape: { size: 'участок 30 × 24 м', mat: 'луг, сосны, кустарник', trade: 'озеленение', qty: '4 дерева · 3 пенька', note: 'Костровище у подножия лестницы.' },
    },
  },
};

export const META = {
  code: 'SC', top: TOP,
  lot: { x0: -6.5, x1: 6.5, z0: -5.0, z1: 5.0, h: 0 },
  entrance: [3.8, 10.4],
  trees: [[-9.6, 2.5], [9.6, -3.0], [-4.0, -9.2], [8.6, 8.8]],
  ivy: [],
  cut: { section: -1.3, plan: DK + 1.6 },
  eye: { dist: 30 },
  tour: ['f:axoR', 'cabin', 'sauna', 'f:top', 'roof', 'stair', 'under', 'f:front', 'piles', 'f:axoL', 'f:eye'],
  // the 10 s film: the camera starts low between the piles, rises as the platform and cabin build, the roof lifts
  // off under its own camera, the cabin comes apart round the sauna, snaps back and the camera settles on the meadow
  film: {
    len: 10, build: 2.0,
    keys: [
      { t: 0, v: { az: .9, el: .02, fill: .8 } }, { t: 2.2, v: 'f:axoR' }, { t: 3.6, v: 'l:roof' }, { t: 4.9, v: 'l:roof' },
      { t: 6.4, v: { az: -.5, el: .42, explode: 1 } }, { t: 7.6, v: { az: -1.15, el: .3, explode: 1 } }, { t: 8.7, v: 'f:axoL' }, { t: 10, v: { az: -.15, el: .06, fill: .82 } },
    ],
    acts: [
      { t: 2.6, focus: 'roof' }, { t: 3.0, lift: 'roof' }, { t: 4.8, lift: null }, { t: 5.3, focus: null },
      { t: 5.4, explode: 1 }, { t: 7.6, explode: 0 },
    ],
  },
};
