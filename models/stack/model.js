// Stack house: five shipping containers on three levels. Two side by side on a concrete plinth, a blue one turned
// across them that cantilevers six metres over the terrace, an orange one that reaches out to the west, and a short
// green one on top with the solar array. Steel stair to the roof deck, timber terrace, trees. Metres, y up, +z front.
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

const Y0 = .3, H = 2.9, W = 2.44, L40 = 12.19, L20 = 6.06;
const Y1 = Y0 + H, Y2 = Y1 + H, TOP = Y2 + H;
const ROT = -Math.PI / 2;     // a container turned to run along +z: its local front then faces -x

export function build() {
  const parts = [];
  const P = (def) => { const p = new Part(def); parts.push(p); return p; };
  const R = rng(20261107);

  // 0 · site: set-out grid, boundary, dimensions
  {
    const p = P({ id: 'site', start: .1, dur: 1.3, list: false, mono: true, site: true });
    const X = 19, Z = 13;
    for (let x = -15; x <= 15; x += 5) p.line(x, 0, -Z + .6, x, 0, Z - .6, true);
    for (let z = -10; z <= 10; z += 5) p.line(-X + .6, 0, z, X - .6, 0, z, true);
    const dash = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize(); for (let s = 0; s < L; s += 1.6) p.seg(a.clone().addScaledVector(d, s), a.clone().addScaledVector(d, Math.min(L, s + 1))); };
    dash(V(-X, 0, -Z), V(X, 0, -Z)); dash(V(X, 0, -Z), V(X, 0, Z)); dash(V(X, 0, Z), V(-X, 0, Z)); dash(V(-X, 0, Z), V(-X, 0, -Z));
    p.line(-12.5, 0, 10.5, 8, 0, 10.5); for (const x of [-12.5, 8]) { p.line(x, 0, 9.9, x, 0, 11); p.line(x - .3, 0, 10.8, x + .3, 0, 10.2); }
    p.anchors.main = V(0, 0, 10.5);
  }

  // 1 · concrete plinth and pad footings
  {
    const p = P({ id: 'plinth', start: .5, dur: 1.2, el: Y0, explode: V(0, 0, 0), big: true, view: { az: .3, el: .5 } });
    p.box(-12.6, 0, -4.9, 6.2, Y0, 1.55, 'concrete');
    for (let x = -12; x <= 6; x += 3) p.line(x, Y0 + .002, -4.9, x, Y0 + .002, 1.55, true);   // saw cuts
    for (const [x, z] of [[2.7, 4.2], [2.7, 7.3], [-10, -2.3]]) p.box(x - .5, 0, z - .5, x + .5, Y0, z + .5, 'concrete', { edges: true });
    p.anchors.main = V(-11, Y0, 1.55);
  }

  // 2 · container A: graphite, the back one on the ground
  {
    const p = P({ id: 'contA', start: 1.2, dur: 1.0, el: Y1, explode: V(0, 0, -3.5), view: { az: Math.PI - .55, el: .3 } });
    p.at(-7, Y0, -3.5);
    container(p, L40, W, H, 'steel', {
      back: [{ s0: 1.4, s1: 3.8, t0: .9, t1: 2.1, kind: 'glass' }, { s0: 6.0, s1: 8.4, t0: .9, t1: 2.1, kind: 'glass' }],
      left: [{ s0: .2, s1: 1.8, t0: .2, t1: 2.3, kind: 'glass' }],
      right: [{ s0: .15, s1: 1.95, t0: .05, t1: 2.45, kind: 'door', tint: 'dark' }],
    }, { frame: 'dark' });
    // end-door locking bars on the east end
    for (const z of [.5, .9, 1.5, 1.9]) p.box(L40 + .01, .3, z - .02, L40 + .05, H - .3, z + .02, 'steel', { edges: 'fine' });
    p.pop();
    p.anchors.main = V(-1, Y0 + 1.6, -3.55);
  }

  // 3 · container B: red, glazed to the terrace
  {
    const p = P({ id: 'contB', start: 1.7, dur: 1.0, el: Y1, explode: V(0, 0, 3.0), view: { az: .3, el: .22 } });
    p.at(-7, Y0, -1.06);
    container(p, L40, W, H, 'fabric', {
      front: [{ s0: .5, s1: 4.6, t0: .1, t1: 2.45, kind: 'glass', ss: range(.5, 4.6, 3), ts: [.1, 2.45] }, { s0: 4.6, s1: 7.0, t0: .1, t1: 2.45, kind: 'slider' }, { s0: 7.6, s1: 11.6, t0: .1, t1: 2.45, kind: 'glass', ss: range(7.6, 11.6, 3), ts: [.1, 2.45] }],
      left: [{ s0: .4, s1: 1.5, t0: .1, t1: 2.2, kind: 'door', tint: 'timber' }],
      right: [{ s0: .1, s1: 2.0, t0: .9, t1: 2.2, kind: 'glass' }],
    });
    // inside: a sofa and a kitchen run, seen through the glass
    p.box(1.0, .16, .3, 3.6, .6, 1.1, 'clad'); p.box(1.0, .6, .3, 3.6, 1.0, .5, 'clad');
    p.box(8.0, .16, .25, 11.8, 1.0, .85, 'timber'); p.box(8.0, 1.0, .25, 11.8, 1.05, .9, 'concrete', { edges: 'fine' });
    p.pop();
    p.anchors.main = V(-4.8, Y0 + 1.6, 1.4);
    p.anchors.slider = V(-1.2, Y0 + 1.3, 1.42);
  }

  // 4 · steel frame: the V-columns that carry the blue cantilever's front and the orange one's tip
  {
    const p = P({ id: 'frame', start: 2.3, dur: .9, el: Y1, explode: V(0, -1.0, 4.0), view: { az: .95, el: .14 } });
    for (const x of [1.75, 3.69]) {
      p.member(V(2.7, Y0, 7.3), V(x, Y1, 6.6), .16, .16, 'steel');
      p.member(V(2.7, Y0, 7.3), V(x, Y1, 7.69 - .1), .12, .12, 'steel');
    }
    p.box(2.4, Y0, 7.0, 3.0, Y0 + .08, 7.6, 'steel', { edges: true });
    p.member(V(1.6, Y1 - .12, 6.6), V(3.84, Y1 - .12, 6.6), .12, .2, 'steel');
    // the orange cantilever's raking strut down to its pad
    p.member(V(-10, Y0, -2.3), V(-10.5, Y1, -2.3), .14, .14, 'steel');
    p.member(V(-10, Y0, -2.3), V(-7.2, Y1, -2.3), .12, .12, 'steel');
    p.anchors.main = V(2.7, Y0 + 1.6, 7.0);
  }

  // 5 · container C: blue, turned across, cantilevered 6.3 m over the terrace, its end all glass
  {
    const p = P({ id: 'contC', start: 2.6, dur: 1.1, el: Y2, explode: V(2.5, 4.5, 2.0), lift: 1.1, view: { az: .85, el: .26 } });
    p.at(3.94, Y1, -4.5, ROT);
    container(p, L40, W, H, 'blue', {
      front: [{ s0: 5.0, s1: 7.4, t0: .8, t1: 2.2, kind: 'glass' }, { s0: 9.0, s1: 11.8, t0: .8, t1: 2.2, kind: 'glass' }],
      back: [{ s0: .4, s1: 4.4, t0: .8, t1: 2.2, kind: 'glass', ss: range(.4, 4.4, 3) }, { s0: 6.0, s1: 8.4, t0: .8, t1: 2.2, kind: 'glass' }],
      right: [{ s0: .1, s1: W - .42, t0: .05, t1: 2.5, kind: 'glass', ss: range(.1, W - .42, 2), ts: [.05, 1.0, 2.5] }],
    });
    // a balcony rail across the glazed end and a bed inside
    p.box(9.8, .16, .3, 11.8, .55, 2.1, 'paper'); p.box(9.8, .55, .3, 10.0, 1.1, 2.1, 'timber');
    p.pop();
    p.anchors.main = V(3.94, Y1 + 2.0, 6.0);
    p.anchors.glass = V(2.7, Y1 + 1.4, 7.7);
  }

  // 6 · container D: orange, reaching 3.7 m out to the west, glazed onto the roof deck
  {
    const p = P({ id: 'contD', start: 3.2, dur: 1.1, el: Y2, explode: V(-3.5, 4.0, -1.0), lift: 1.1, view: { az: -.75, el: .3 } });
    p.at(-10.69, Y1, -3.5);
    container(p, L40, W, H, 'timber', {
      front: [{ s0: 3.6, s1: 6.0, t0: .1, t1: 2.45, kind: 'slider' }, { s0: 6.4, s1: 11.6, t0: .9, t1: 2.2, kind: 'glass', ss: range(6.4, 11.6, 4) }],
      left: [{ s0: .1, s1: W - .42, t0: .1, t1: 2.45, kind: 'glass', ss: range(.1, W - .42, 2) }],
      back: [{ s0: 2.0, s1: 5.0, t0: .9, t1: 2.2, kind: 'glass' }],
    }, { frame: 'steel' });
    p.box(.4, .16, .4, 2.0, .9, 2.0, 'clad');                                  // a desk in the glazed end
    p.pop();
    p.anchors.main = V(-10.69, Y1 + 1.5, -2.3);
  }

  // 7 · container E: a short green one on top, spanning C and D
  {
    const p = P({ id: 'contE', start: 3.9, dur: 1.0, el: TOP, explode: V(0, 8.0, -1.0), lift: 1.2, view: { az: .45, el: .4 } });
    p.at(-1.2, Y2, -3.6);
    container(p, L20, W, H, 'clad', {
      front: [{ s0: .6, s1: 2.8, t0: .1, t1: 2.45, kind: 'slider' }, { s0: 3.2, s1: 5.4, t0: .9, t1: 2.2, kind: 'glass' }],
      left: [{ s0: .2, s1: 1.8, t0: .9, t1: 2.2, kind: 'glass' }],
      right: [{ s0: .1, s1: W - .42, t0: .1, t1: 2.45, kind: 'glass', ss: range(.1, W - .42, 2) }],
    });
    p.pop();
    p.anchors.main = V(4.86, Y2 + 1.6, -2.4);
  }

  // 8 · roof decks: on B (first floor) and on D (second floor), larch boards, mesh railing
  {
    const p = P({ id: 'roofdeck', start: 4.6, dur: 1.0, el: Y1, explode: V(0, 2.5, 2.0), view: { az: -.35, el: .55 } });
    const deck = (x0, x1, z0, z1, y) => {
      p.box(x0, y, z0, x1, y + .08, z1, 'deck');
      for (let z = z0 + .16; z < z1 - .05; z += .16) p.line(x0, y + .08, z, x1, y + .08, z, true);
    };
    deck(-7, 1.5, -1.06, 1.38, Y1);
    railing(p, [V(-7, 0, 1.36), V(1.5, 0, 1.36)], Y1 + .08);
    railing(p, [V(-6.98, 0, -1.0), V(-6.98, 0, .02)], Y1 + .08);
    deck(-10.69, -1.2, -3.5, -1.06, Y2);
    railing(p, [V(-10.67, 0, -1.08), V(-10.67, 0, -3.48), V(-1.2, 0, -3.48)], Y2 + .08);
    railing(p, [V(-10.67, 0, -1.08), V(-1.2, 0, -1.08)], Y2 + .08);
    // planters and chairs on the lower deck
    planter(p, -6.6, .6, -4.8, 1.2, Y1 + .08, .45, R);
    planter(p, -.6, .6, 1.2, 1.2, Y1 + .08, .45, R);
    for (const x of [-3.4, -2.2]) { p.box(x, Y1 + .08, -.4, x + .7, Y1 + .45, .3, 'fabric'); p.box(x, Y1 + .45, -.4, x + .7, Y1 + .95, -.25, 'fabric'); }
    p.anchors.main = V(-3, Y1 + .1, 1.38);
    p.anchors.top = V(-8, Y2 + .1, -1.06);
  }

  // 9 · steel stair from the ground to the first-floor deck, at the west end
  {
    const p = P({ id: 'stair', start: 5.1, dur: .9, el: Y1, explode: V(-3.5, .5, 2.0), view: { az: -1.05, el: .24 } });
    p.at(-7, 0, 0, Math.PI);                          // turned round: it runs down to the west
    stair(p, 0, -1.3, -.1, Y1 + .08, Y0 - .3 + .3);
    p.pop();
    p.anchors.main = V(-9.6, (Y1 + Y0) / 2 + .4, .9);
  }

  // 10 · timber terrace under the cantilever, planters, table
  {
    const p = P({ id: 'terrace', start: 5.6, dur: 1.1, el: Y0, explode: V(0, 0, 3.0), view: { az: .15, el: .42 } });
    const x0 = -4.5, x1 = 8.2, z0 = 1.55, z1 = 8.4, y = Y0;
    p.box(x0, .06, z0, x1, y, z1, 'deck');
    for (let z = z0 + .3; z < z1 - .05; z += .3) p.line(x0, y, z, x1, y, z, true);
    for (const z of [z1]) p.line(x0, .18, z + .003, x1, .18, z + .003, true);
    p.box(-4.5, .06, z1, 2, .18, z1 + .38, 'deck');                              // a step along the front
    planter(p, 5.0, 2.0, 7.8, 2.6, y, .55, R);
    planter(p, -4.2, 7.4, -1.4, 8.0, y, .55, R);
    picnic(p, 0, 4.6, 0, y);
    // an outdoor fireplace: a steel bowl on a short stem
    cylinder(p, 6.4, y, 6.4, .12, .35, 'steel', { n: 10, lines: 2 });
    cylinder(p, 6.4, y + .35, 6.4, .55, .14, 'dark', { n: 18, lines: 0 });
    p.anchors.main = V(7.0, y, 8.0);
    p.anchors.table = V(0, y + .75, 4.6);
  }

  // 11 · solar array on top of E
  {
    const p = P({ id: 'solar', start: 6.3, dur: .8, el: TOP + .3, explode: V(0, 10.5, 0), view: { az: .3, el: .8 } });
    const y = TOP;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x0 = -1.0 + i * 1.95, z0 = -3.45 + j * 1.15;
      p.push(new THREE.Matrix4().makeTranslation(x0, y + .1, z0).multiply(new THREE.Matrix4().makeRotationX(-.16)));
      p.box(0, 0, 0, 1.85, .04, 1.05, 'solar', { edges: true });
      for (let k = 1; k < 6; k++) p.line(k * 1.85 / 6, .045, 0, k * 1.85 / 6, .045, 1.05, true);
      for (let k = 1; k < 3; k++) p.line(0, .045, k * 1.05 / 3, 1.85, .045, k * 1.05 / 3, true);
      p.pop();
      p.member(V(x0 + .2, y, z0 + .9), V(x0 + .2, y + .27, z0 + .9), .04, .04, 'steel', { edges: 'fine' });
      p.member(V(x0 + 1.65, y, z0 + .9), V(x0 + 1.65, y + .27, z0 + .9), .04, .04, 'steel', { edges: 'fine' });
    }
    p.anchors.main = V(3.6, y + .3, -2.4);
  }

  // 12 · trees, shrubs and the meadow edge
  {
    const p = P({ id: 'landscape', start: 6.8, dur: 1.4, el: Y0, explode: V(0, 0, 0), planting: true, view: { az: -.25, el: .3 } });
    tree(p, -15.2, 0, 4.2, 8.2, 2.8, R, false);
    tree(p, 10.5, 0, -3.5, 7.4, 2.5, R, false);
    tree(p, 11.4, 0, 6.8, 6.6, 2.3, R, false);
    tree(p, -8.5, 0, -8.0, 7.8, 2.7, R, false);
    shrubs(p, -12.4, 1.8, -8, 3.2, 0, 9, R, .3, .55);
    shrubs(p, 6.4, -5.6, 9.0, -4.8, 0, 6, R, .3, .5);
    grass(p, -12, 2, -5, 5, 0, 60, R);
    p.anchors.main = V(-15.2, 6.4, 4.2);
  }
  return parts;
}

export const CALLOUTS = [
  { part: 'contE', a: 'main', k: 'contE', el: '+' + TOP.toFixed(2), o: true },
  { part: 'solar', a: 'main', k: 'solar', o: true },
  { part: 'contD', a: 'main', k: 'contD', el: '+' + Y2.toFixed(2), o: true },
  { part: 'contC', a: 'main', k: 'contC', el: '+' + Y2.toFixed(2), o: true },
  { part: 'contC', a: 'glass', k: 'glassEnd', o: false },
  { part: 'roofdeck', a: 'main', k: 'roofdeck', el: '+' + Y1.toFixed(2), o: true },
  { part: 'roofdeck', a: 'top', k: 'topdeck', el: '+' + Y2.toFixed(2), o: false },
  { part: 'stair', a: 'main', k: 'stair', o: true },
  { part: 'contB', a: 'main', k: 'contB', el: '+' + Y1.toFixed(2), o: true },
  { part: 'contB', a: 'slider', k: 'slider', o: false },
  { part: 'contA', a: 'main', k: 'contA', o: false },
  { part: 'frame', a: 'main', k: 'frame', o: true },
  { part: 'terrace', a: 'main', k: 'terrace', el: '+' + Y0.toFixed(2), o: true },
  { part: 'terrace', a: 'table', k: 'table', o: false },
  { part: 'plinth', a: 'main', k: 'plinth', o: false },
];

export const ORDER = ['plinth', 'contA', 'contB', 'frame', 'contC', 'contD', 'contE', 'roofdeck', 'stair', 'terrace', 'solar', 'landscape'];
export const PART = {
  plinth: { code: 'SH-01', el: '+0.30', mass: 58, qty: 4 },
  contA: { code: 'SH-02', el: '+3.20', mass: 3.9, qty: 1 },
  contB: { code: 'SH-03', el: '+3.20', mass: 3.9, qty: 1 },
  frame: { code: 'SH-04', el: '+3.20', mass: 1.2, qty: 6 },
  contC: { code: 'SH-05', el: '+6.10', mass: 3.9, qty: 1 },
  contD: { code: 'SH-06', el: '+6.10', mass: 3.9, qty: 1 },
  contE: { code: 'SH-07', el: '+9.00', mass: 2.3, qty: 1 },
  roofdeck: { code: 'SH-08', el: '+3.20', mass: 2.6, qty: 2 },
  stair: { code: 'SH-09', el: '+3.28', mass: 1.1, qty: 17 },
  terrace: { code: 'SH-10', el: '+0.30', mass: 6.4, qty: 1 },
  solar: { code: 'SH-11', el: '+9.30', mass: .13, qty: 6 },
  landscape: { code: 'SH-12', el: '+0.00', mass: 0, qty: 4 },
};
export const LEVELS = [{ v: 0, k: 'ground' }, { v: Y0, k: 'plinth' }, { v: Y1, k: 'l1' }, { v: Y2, k: 'l2' }, { v: TOP, k: 'top' }];

export const TEXT = {
  en: {
    ui: { title: 'stack house', sub: 'Five shipping containers on three levels, one cantilevered six metres over the terrace.', drawingV: 'stack house · axonometric', sheet: 'sheet S-201' },
    stats: [['floor area', '148 m²'], ['mass', '87 t'], ['containers', '5 · 12 parts']],
    name: { plinth: 'Concrete plinth', contA: 'Container A · graphite', contB: 'Container B · red', frame: 'Steel V-columns', contC: 'Container C · cantilever', contD: 'Container D · west arm', contE: 'Container E · top', roofdeck: 'Roof decks', stair: 'Steel stair', terrace: 'Timber terrace', solar: 'Solar array', landscape: 'Trees and planting', site: 'Site' },
    co: { contE: '20 ft container · top', solar: 'Solar array · 6 panels', contD: 'West arm · 3.7 m out', contC: 'Cantilever · 6.3 m', glassEnd: 'Glazed end wall', roofdeck: 'Roof deck · larch', topdeck: 'Upper deck', stair: 'Steel stair', contB: '40 ft container · living', slider: 'Sliding glass door', contA: 'Graphite container', frame: 'Steel V-columns', terrace: 'Timber terrace', table: 'Outdoor table', plinth: 'Concrete plinth' },
    lv: { ground: 'ground', plinth: 'plinth', l1: 'first floor', l2: 'second floor', top: 'top' },
    info: {
      plinth: { size: '18.8 × 6.5 m', mat: 'reinforced concrete, saw-cut joints', trade: 'concrete', qty: '1 slab · 3 pads', note: 'Carries the two ground containers; three pads take the steel columns.' },
      contA: { size: '12.19 × 2.44 × 2.90 m', mat: 'corten sheet, graphite paint', trade: 'modular', qty: '1 × 40 ft HC', note: 'Bedrooms and bath; windows to the north, end doors kept as a store.' },
      contB: { size: '12.19 × 2.44 × 2.90 m', mat: 'corten sheet, signal red', trade: 'modular', qty: '1 × 40 ft HC', note: 'Living room and kitchen; the whole south side opens to the terrace.' },
      frame: { size: 'columns 160 × 160', mat: 'steel hollow sections', trade: 'steel', qty: '6 members · 3 pads', note: 'Two V-columns hold the cantilever’s tip; a raking strut holds the west arm.' },
      contC: { size: '12.19 × 2.44 × 2.90 m', mat: 'corten sheet, cobalt blue', trade: 'modular · crane', qty: '1 × 40 ft HC', note: 'Turned across the stack and cantilevered 6.3 m; the bedroom looks out of a glass end.' },
      contD: { size: '12.19 × 2.44 × 2.90 m', mat: 'corten sheet, signal orange', trade: 'modular · crane', qty: '1 × 40 ft HC', note: 'Study and guest room; reaches 3.7 m west and opens onto the roof deck.' },
      contE: { size: '6.06 × 2.44 × 2.90 m', mat: 'corten sheet, moss green', trade: 'modular · crane', qty: '1 × 20 ft HC', note: 'A studio on top that spans the blue and the orange container.' },
      roofdeck: { size: '8.5 × 2.4 m + 9.5 × 2.4 m', mat: 'larch boards on bearers', trade: 'carpentry', qty: '2 decks', note: 'Mesh railing H 1100; planters and two chairs on the lower deck.' },
      stair: { size: '4.8 × 1.2 m', mat: 'steel stringers, chequer-plate treads', trade: 'steel', qty: '17 risers × 170 mm', note: 'From the garden straight up to the first-floor deck at the west end.' },
      terrace: { size: '12.7 × 6.9 m', mat: 'thermo-ash boards', trade: 'carpentry', qty: '88 m²', note: 'Under the cantilever: a table, two planters and a fire bowl.' },
      solar: { size: '6 × 1.05 × 1.85 m', mat: 'monocrystalline panels, 9° tilt', trade: 'electrical', qty: '6 × 430 W = 2.6 kWp', note: 'On short legs over the top container’s roof.' },
      landscape: { size: 'lot 38 × 26 m', mat: 'meadow, birches, shrubs', trade: 'landscape', qty: '4 trees', note: 'The meadow runs right up to the plinth.' },
    },
  },
  ru: {
    ui: { title: 'дом из контейнеров', sub: 'Пять морских контейнеров на трёх уровнях, один вынесен на шесть метров над террасой.', drawingV: 'дом из контейнеров · аксонометрия', sheet: 'лист S-201' },
    stats: [['площадь', '148 м²'], ['масса', '87 т'], ['контейнеры', '5 · 12 частей']],
    name: { plinth: 'Бетонный цоколь', contA: 'Контейнер A · графит', contB: 'Контейнер B · красный', frame: 'Стальные V-опоры', contC: 'Контейнер C · консоль', contD: 'Контейнер D · западный', contE: 'Контейнер E · верхний', roofdeck: 'Террасы на крыше', stair: 'Стальная лестница', terrace: 'Деревянная терраса', solar: 'Солнечные панели', landscape: 'Деревья и зелень', site: 'Участок' },
    co: { contE: 'Контейнер 20 футов · верх', solar: 'Солнечные панели · 6 шт', contD: 'Западная консоль · 3,7 м', contC: 'Консоль · 6,3 м', glassEnd: 'Стеклянный торец', roofdeck: 'Терраса · лиственница', topdeck: 'Верхняя терраса', stair: 'Стальная лестница', contB: 'Контейнер 40 футов · гостиная', slider: 'Раздвижная дверь', contA: 'Графитовый контейнер', frame: 'Стальные V-опоры', terrace: 'Деревянная терраса', table: 'Стол на улице', plinth: 'Бетонный цоколь' },
    lv: { ground: 'земля', plinth: 'цоколь', l1: '2 этаж', l2: '3 этаж', top: 'верх' },
    info: {
      plinth: { size: '18,8 × 6,5 м', mat: 'железобетон, нарезанные швы', trade: 'бетон', qty: '1 плита · 3 опоры', note: 'Несёт два нижних контейнера; на три опоры встают стальные стойки.' },
      contA: { size: '12,19 × 2,44 × 2,90 м', mat: 'кортен, графитовая краска', trade: 'модульные', qty: '1 × 40 футов', note: 'Спальни и ванная; окна на север, торцевые двери оставлены под кладовую.' },
      contB: { size: '12,19 × 2,44 × 2,90 м', mat: 'кортен, сигнальный красный', trade: 'модульные', qty: '1 × 40 футов', note: 'Гостиная и кухня; вся южная сторона открывается на террасу.' },
      frame: { size: 'стойки 160 × 160', mat: 'стальные трубы', trade: 'металл', qty: '6 элементов · 3 опоры', note: 'Две V-опоры держат конец консоли, наклонная стойка держит западный контейнер.' },
      contC: { size: '12,19 × 2,44 × 2,90 м', mat: 'кортен, кобальтовый синий', trade: 'модульные · кран', qty: '1 × 40 футов', note: 'Повёрнут поперёк и вынесен на 6,3 м; спальня смотрит в стеклянный торец.' },
      contD: { size: '12,19 × 2,44 × 2,90 м', mat: 'кортен, сигнальный оранжевый', trade: 'модульные · кран', qty: '1 × 40 футов', note: 'Кабинет и гостевая; вынесен на 3,7 м на запад и выходит на террасу.' },
      contE: { size: '6,06 × 2,44 × 2,90 м', mat: 'кортен, зелёный мох', trade: 'модульные · кран', qty: '1 × 20 футов', note: 'Студия наверху, лежит на синем и оранжевом контейнерах.' },
      roofdeck: { size: '8,5 × 2,4 м + 9,5 × 2,4 м', mat: 'доска лиственницы на лагах', trade: 'плотницкие', qty: '2 террасы', note: 'Сетчатое ограждение H 1100; кашпо и два кресла на нижней террасе.' },
      stair: { size: '4,8 × 1,2 м', mat: 'стальные косоуры, рифлёные ступени', trade: 'металл', qty: '17 подъёмов × 170 мм', note: 'Из сада прямо на террасу второго этажа у западного торца.' },
      terrace: { size: '12,7 × 6,9 м', mat: 'термоясень', trade: 'плотницкие', qty: '88 м²', note: 'Под консолью: стол, два кашпо и чаша для огня.' },
      solar: { size: '6 × 1,05 × 1,85 м', mat: 'монокристаллические панели, наклон 9°', trade: 'электрика', qty: '6 × 430 Вт = 2,6 кВт', note: 'На коротких ножках над крышей верхнего контейнера.' },
      landscape: { size: 'участок 38 × 26 м', mat: 'луг, берёзы, кустарник', trade: 'озеленение', qty: '4 дерева', note: 'Луг подходит вплотную к цоколю.' },
    },
  },
};

export const META = {
  code: 'SH', top: TOP,
  lot: { x0: -12.8, x1: 8.4, z0: -5.0, z1: 8.8, h: Y0 },
  entrance: [-1, 9.2],
  trees: [[-15.2, 4.2], [10.5, -3.5], [11.4, 6.8], [-8.5, -8.0]],
  ivy: [[-12.6, 1.57, 6.2, 1.57, 0, .3, 0, 1], [-12.62, -4.9, -12.62, 1.55, 0, .3, -1, 0], [-7.02, -3.5, -7.02, 1.38, .3, 1.6, -1, 0], [-4.5, 8.42, 8.2, 8.42, 0, .3, 0, 1]],
  cut: { section: -2.3, plan: 1.8 },
  eye: { dist: 34 },
  tour: ['f:axoR', 'contC', 'contE', 'f:top', 'contD', 'stair', 'terrace', 'f:front', 'contB', 'f:axoL', 'f:eye'],
  // the 10 s film: rises off the meadow as the stack builds, the blue cantilever slides out under its own camera,
  // the whole stack comes apart on a turn, snaps back, and the camera drops back to the grass
  film: {
    len: 10, build: 1.8,
    keys: [
      { t: 0, v: { az: .45, el: .04, fill: .7 } }, { t: 2.0, v: 'f:axoR' }, { t: 3.6, v: 'l:contC' }, { t: 4.9, v: 'l:contC' },
      { t: 6.4, v: { az: -.35, el: .5, explode: 1 } }, { t: 7.6, v: { az: -1.0, el: .42, explode: 1 } }, { t: 8.7, v: 'f:axoL' }, { t: 10, v: { az: -.15, el: .06, fill: .82 } },
    ],
    acts: [
      { t: 2.6, focus: 'contC' }, { t: 3.0, lift: 'contC' }, { t: 4.8, lift: null }, { t: 5.3, focus: null },
      { t: 5.4, explode: 1 }, { t: 7.6, explode: 0 },
    ],
  },
};
