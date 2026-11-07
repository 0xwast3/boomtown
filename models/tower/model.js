// Twist tower: four square floors stacked round a concrete core, each turned 14 degrees further than the one below,
// on a concrete podium. Floors alternate larch fins, brick spandrels and yellow fins; each has a corner balcony.
// A spiral stair climbs from the podium to the first floor's balcony; a roof terrace with a pergola on top.
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

const POD = .6, FH = 3.3, HALF = 4.2, TW = 14 * Math.PI / 180;
const FY = (k) => POD + FH * k;               // floor k's slab bottom
const ROOF = FY(4);                           // 13.80
const TOP = ROOF + .3 + 2.55;
const rot = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// one floor in its own turned frame: slab, glazing, fins or spandrels, a corner balcony, a little furniture
function floor(p, k, finTint, R) {
  const y = FY(k), a = TW * k, h = FH - .3;
  p.at(0, y, 0, a);
  p.box(-HALF, 0, -HALF, HALF, .3, HALF, 'concrete');
  p.line(-HALF, .15, HALF + .003, HALF, .15, HALF + .003, true);
  // the balcony: the slab runs on past one front corner
  const bx = k % 2 ? -1 : 1;
  const b0 = bx > 0 ? HALF : -HALF - 2.0, b1 = bx > 0 ? HALF + 2.0 : -HALF;
  p.box(b0, 0, .6, b1, .3, HALF + 1.4, 'concrete');
  p.box(bx > 0 ? -HALF + 1.2 : -HALF, 0, HALF, bx > 0 ? HALF + 2.0 : HALF - 1.2, .3, HALF + 1.4, 'concrete');
  const rp = bx > 0
    ? [V(HALF + 1.98, 0, .62), V(HALF + 1.98, 0, HALF + 1.38), V(-HALF + 1.22, 0, HALF + 1.38)]
    : [V(-HALF - 1.98, 0, .62), V(-HALF - 1.98, 0, HALF + 1.38), V(HALF - 1.22, 0, HALF + 1.38)];
  railing(p, k === 1 ? rp.slice(1) : rp, .3, 1.05, { pitch: .16 });
  // the walls, inside the slab edge
  const r = [-HALF + .15, -HALF + .15, HALF - .15, HALF - .15];
  const fins = (f, n0 = 0) => { for (let s = .35 + n0; s < f.len - .2; s += .62) p.box(s - .04, .3, 0, s + .04, FH, .38, finTint, { edges: true }); };
  let f = side(r, 'front', 0); p.push(wallM(f));
  glaze(p, range(.0, f.len, 5), [.3, 2.85, h + .3], { tint: 'dark', fw: .06, dep: .08 });
  if (finTint !== 'brick') fins(f);
  else { p.box(0, h - .25, 0, f.len, h + .3, .12, 'brick'); for (let t = h - .2; t < h + .3; t += .09) p.line(0, t, .123, f.len, t, .123, true); }
  p.pop();
  f = side(r, bx > 0 ? 'right' : 'left', 0); p.push(wallM(f));
  glaze(p, range(.0, f.len, 4), [.3, 2.85, h + .3], { tint: 'dark', fw: .06, dep: .08 });
  if (finTint === 'brick') { p.box(0, h - .25, 0, f.len, h + .3, .12, 'brick'); for (let t = h - .2; t < h + .3; t += .09) p.line(0, t, .123, f.len, t, .123, true); }
  p.pop();
  // the other two sides: brick (or the fins' colour) with a slot window
  for (const w of ['back', bx > 0 ? 'left' : 'right']) {
    f = side(r, w, 0); p.push(wallM(f));
    const tint = finTint === 'yellow' ? 'yellow' : 'brick';
    p.box(0, .3, -.2, f.len * .55, h + .3, 0, tint);
    p.box(f.len * .55 + 1.0, .3, -.2, f.len, h + .3, 0, tint);
    p.box(f.len * .55, .3, -.2, f.len * .55 + 1.0, .5, 0, tint); p.box(f.len * .55, 2.7, -.2, f.len * .55 + 1.0, h + .3, 0, tint);
    glaze(p, [f.len * .55, f.len * .55 + 1.0], [.5, 2.7], { tint: 'dark', fw: .05, dep: .06 });
    if (tint === 'brick') for (let t = .42; t < h + .3; t += .3) p.line(0, t, .003, f.len * .55, t, .003, true);
    p.pop();
  }
  // inside: a table, a sofa, a lamp, seen through the glass
  p.box(1.4, .3, 1.6, 3.0, 1.05, 2.6, 'timber'); p.box(-3.4, .3, 2.0, -1.8, .75, 3.6, finTint === 'yellow' ? 'blue' : 'fabric');
  cylinder(p, 2.2, 1.05, 2.1, .05, .5, 'dark', { n: 6, lines: 0 });
  p.pop();
}

export function build() {
  const parts = [];
  const P = (def) => { const p = new Part(def); parts.push(p); return p; };
  const R = rng(20261108);

  {
    const p = P({ id: 'site', start: .1, dur: 1.3, list: false, mono: true, site: true });
    const X = 15, Z = 13;
    for (let x = -15; x <= 15; x += 5) p.line(x, 0, -Z + .6, x, 0, Z - .6, true);
    for (let z = -10; z <= 10; z += 5) p.line(-X + .6, 0, z, X - .6, 0, z, true);
    const dash = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize(); for (let s = 0; s < L; s += 1.6) p.seg(a.clone().addScaledVector(d, s), a.clone().addScaledVector(d, Math.min(L, s + 1))); };
    dash(V(-X, 0, -Z), V(X, 0, -Z)); dash(V(X, 0, -Z), V(X, 0, Z)); dash(V(X, 0, Z), V(-X, 0, Z)); dash(V(-X, 0, Z), V(-X, 0, -Z));
    // the twist: four rays from the axis, one per floor
    for (let k = 0; k < 4; k++) { const [x, z] = rot(0, 9.5, TW * k); p.line(0, 0, 0, x, 0, z, true); }
    p.anchors.main = V(0, 0, 9.5);
  }

  // 1 · podium with steps and planters
  {
    const p = P({ id: 'podium', start: .5, dur: 1.1, el: POD, explode: V(0, 0, 0), big: true, view: { az: .3, el: .45 } });
    p.box(-6.5, 0, -5.5, 6.5, POD, 5.5, 'concrete');
    for (let x = -6.5 + 1.3; x < 6.5; x += 1.3) p.line(x, POD + .002, -5.5, x, POD + .002, 5.5, true);
    for (let i = 0; i < 3; i++) p.box(-2.4, 0, 5.5, 2.4, POD - .2 * (i + 1) + .2, 5.5 + .36 * (i + 1), 'concrete', { edges: true });
    planter(p, -6.2, 4.1, -3.4, 5.2, POD, .5, R);
    planter(p, 3.4, -5.2, 6.2, -4.1, POD, .5, R);
    p.anchors.main = V(0, POD - .2, 6.3);
  }

  // 2 · core: the concrete shaft with the stair and the lift, board-marked
  {
    const p = P({ id: 'core', start: 1.1, dur: 1.4, el: ROOF + 1.2, explode: V(0, 0, 0), view: { az: -.5, el: .3 } });
    const c = 1.6, top = ROOF + 1.5;
    p.box(-c, POD, -c, c, top, c, 'concrete');
    for (let y = POD + .6; y < top; y += .6) { p.line(-c, y, c + .003, c, y, c + .003, true); p.line(c + .003, y, -c, c + .003, y, c, true); p.line(-c - .003, y, -c, -c - .003, y, c, true); p.line(-c, y, -c - .003, c, y, -c - .003, true); }
    p.box(-.6, POD, c, .6, POD + 2.3, c + .02, 'dark');                 // the ground-floor door
    p.box(-c - .1, top, -c - .1, c + .1, top + .15, c + .1, 'concrete');
    p.anchors.main = V(c, ROOF + 1.0, c);
  }

  const tints = ['timber', 'brick', 'yellow', 'timber'];
  for (let k = 0; k < 4; k++) {
    const id = 'floor' + (k + 1);
    const ex = rot(k % 2 ? -1.6 : 1.6, 1.2, TW * k);
    const p = P({ id, start: 1.8 + k * .75, dur: 1.0, el: FY(k + 1), explode: V(ex[0], 2.6 * (k + 1), ex[1]), lift: 1.0,
      view: { az: TW * k + (k % 2 ? -.55 : .55), el: .2 + k * .04 } });
    floor(p, k, tints[k], R);
    const bx = k % 2 ? -1 : 1;
    const [ax, az] = rot(bx * (HALF + 2.0), HALF + 1.4, TW * k);
    p.anchors.main = V(ax, FY(k) + 1.6, az);
    const [gx, gz] = rot(0, HALF, TW * k);
    p.anchors.glass = V(gx, FY(k) + 1.8, gz);
  }

  // 7 · spiral stair from the podium up to the first floor's balcony
  {
    const p = P({ id: 'spiral', start: 4.9, dur: 1.0, el: FY(1) + .3, explode: V(3.5, 0, 3.0), view: { az: .9, el: .22 } });
    const [cx, cz] = rot(HALF + 1.0, 2.0, TW);
    spiral(p, cx, cz, POD, FY(1) + .3, Math.PI * .5, 1.0, 1.0, 'steel');
    p.anchors.main = V(cx + 1.0, (POD + FY(1)) / 2, cz);
  }

  // 8 · roof terrace on the top floor: deck, glass balustrade, pergola, planters, water tank
  {
    const p = P({ id: 'roof', start: 5.5, dur: 1.2, el: ROOF + .3, explode: V(0, 13.5, 0), lift: 1.0, view: { az: .25, el: .6 } });
    const a = TW * 4;
    p.at(0, ROOF, 0, a);
    p.box(-HALF, 0, -HALF, HALF, .3, HALF, 'concrete');
    p.box(-HALF, .3, -HALF, HALF, .38, HALF, 'deck', { skip: 'y' });
    for (let x = -HALF + .18; x < HALF; x += .18) p.line(x, .38, -HALF, x, .38, HALF, true);
    // parapet with glass on the front and the right, brick on the back
    p.box(-HALF, .38, -HALF, HALF, 1.4, -HALF + .2, 'brick');
    p.box(-HALF, .38, -HALF + .2, -HALF + .2, 1.4, HALF, 'brick');
    for (const [a0, b0] of [[V(-HALF + .2, 0, HALF - .05), V(HALF - .05, 0, HALF - .05)], [V(HALF - .05, 0, HALF - .05), V(HALF - .05, 0, -HALF + .2)]]) {
      p.member(V(a0.x, 1.4, a0.z), V(b0.x, 1.4, b0.z), .08, .06, 'steel');
      const d = new THREE.Vector3().subVectors(b0, a0), L = d.length(); d.normalize();
      const n = new THREE.Vector3(-d.z, 0, d.x);
      const M = new THREE.Matrix4().makeBasis(d, new THREE.Vector3(0, 1, 0), n).setPosition(V(a0.x, .38, a0.z));
      p.push(M); glaze(p, range(0, L, 4), [0, 1.0], { tint: 'steel', fw: .04, dep: .04 }); p.pop();
    }
    // timber pergola over the back half
    for (const x of [-HALF + .4, 0, HALF - .4]) for (const z of [-HALF + .4, -.4]) p.box(x - .1, .38, z - .1, x + .1, 2.7, z + .1, 'timber');
    for (const z of [-HALF + .4, -.4]) p.box(-HALF + .2, 2.7, z - .1, HALF - .2, 2.9, z + .1, 'timber');
    for (let x = -HALF + .3; x < HALF - .2; x += .32) p.box(x - .03, 2.9, -HALF + .1, x + .03, 3.02, .1, 'timber', { edges: 'fine' });
    planter(p, -3.6, 1.2, -1.0, 2.0, .38, .5, R);
    planter(p, 1.6, 3.1, 3.7, 3.8, .38, .5, R);
    cylinder(p, 2.9, .38, -2.6, .7, 1.6, 'blue', { n: 18, lines: 4, bands: [.5, 1.05] });       // rainwater tank
    // a table and four chairs under the pergola
    p.box(-1.6, .38, -2.9, -.2, 1.13, -1.9, 'timber');
    for (const [x, z] of [[-2.1, -2.4], [.3, -2.4]]) p.box(x - .25, .38, z - .25, x + .25, .82, z + .25, 'fabric');
    p.pop();
    const [mx, mz] = rot(HALF, HALF, a);
    p.anchors.main = V(mx, ROOF + 1.4, mz);
    const [px, pz] = rot(0, -2, a);
    p.anchors.pergola = V(px, ROOF + 3.0, pz);
  }

  // 9 · trees and planting round the podium
  {
    const p = P({ id: 'landscape', start: 6.2, dur: 1.4, el: POD, explode: V(0, 0, 0), planting: true, view: { az: -.25, el: .3 } });
    tree(p, -9.8, 0, 3.5, 8.8, 3.0, R, false);
    tree(p, 9.6, 0, -2.5, 8.0, 2.7, R, false);
    tree(p, -8.2, 0, -7.6, 7.2, 2.5, R, false);
    tree(p, 8.4, 0, 7.4, 6.4, 2.2, R, false);
    shrubs(p, -9.5, -1.0, -7.0, 1.5, 0, 8, R, .3, .55);
    shrubs(p, 7.2, 2.0, 9.0, 4.5, 0, 6, R, .3, .5);
    grass(p, -9, 5, -3, 8, 0, 60, R);
    p.anchors.main = V(-9.8, 7.0, 3.5);
  }
  return parts;
}

export const CALLOUTS = [
  { part: 'roof', a: 'pergola', k: 'pergola', el: '+' + (ROOF + 3).toFixed(2), o: true },
  { part: 'roof', a: 'main', k: 'roof', el: '+' + (ROOF + .38).toFixed(2), o: true },
  { part: 'floor4', a: 'main', k: 'floor4', el: '+' + FY(3).toFixed(2), o: true },
  { part: 'floor3', a: 'main', k: 'floor3', el: '+' + FY(2).toFixed(2), o: true },
  { part: 'floor2', a: 'main', k: 'floor2', el: '+' + FY(1).toFixed(2), o: true },
  { part: 'floor1', a: 'main', k: 'floor1', el: '+' + FY(0).toFixed(2), o: true },
  { part: 'spiral', a: 'main', k: 'spiral', o: true },
  { part: 'core', a: 'main', k: 'core', o: true },
  { part: 'podium', a: 'main', k: 'podium', el: '+' + POD.toFixed(2), o: true },
  { part: 'floor1', a: 'glass', k: 'fins', o: false },
  { part: 'floor2', a: 'glass', k: 'brick', o: false },
  { part: 'floor3', a: 'glass', k: 'fins', o: false },
  { part: 'floor4', a: 'glass', k: 'fins', o: false },
];

export const ORDER = ['podium', 'core', 'floor1', 'floor2', 'floor3', 'floor4', 'spiral', 'roof', 'landscape'];
const el = (v) => '+' + v.toFixed(2);
export const PART = {
  podium: { code: 'TT-01', el: el(POD), mass: 190, qty: 1 },
  core: { code: 'TT-02', el: el(ROOF + 1.5), mass: 160, qty: 1 },
  floor1: { code: 'TT-03', el: el(FY(0)), mass: 48, qty: 1 },
  floor2: { code: 'TT-04', el: el(FY(1)), mass: 48, qty: 1 },
  floor3: { code: 'TT-05', el: el(FY(2)), mass: 48, qty: 1 },
  floor4: { code: 'TT-06', el: el(FY(3)), mass: 48, qty: 1 },
  spiral: { code: 'TT-07', el: el(FY(1) + .3), mass: 1.4, qty: 17 },
  roof: { code: 'TT-08', el: el(ROOF + .38), mass: 40, qty: 1 },
  landscape: { code: 'TT-09', el: '+0.00', mass: 0, qty: 4 },
};
export const LEVELS = [{ v: 0, k: 'ground' }, { v: POD, k: 'podium' }, { v: FY(1), k: 'f2' }, { v: FY(2), k: 'f3' }, { v: FY(3), k: 'f4' }, { v: ROOF + .38, k: 'roof' }];

const infoFloor = (n, en) => en
  ? { size: '8.4 × 8.4 × 3.3 m', mat: n === 2 ? 'concrete slab, glazing, brick spandrels' : n === 3 ? 'concrete slab, glazing, yellow aluminium fins' : 'concrete slab, glazing, larch fins at 620 mm', trade: 'concrete and glazing', qty: '1 floor · 70 m²', note: `Turned ${14 * (n - 1)}° against the podium; a ${n % 2 ? 'south-east' : 'south-west'} corner balcony.` }
  : { size: '8,4 × 8,4 × 3,3 м', mat: n === 2 ? 'бетонная плита, остекление, кирпичный пояс' : n === 3 ? 'бетонная плита, остекление, жёлтые алюминиевые ламели' : 'бетонная плита, остекление, ламели из лиственницы через 620 мм', trade: 'бетон и остекление', qty: '1 этаж · 70 м²', note: `Повёрнут на ${14 * (n - 1)}° к подиуму; угловой балкон на ${n % 2 ? 'юго-восток' : 'юго-запад'}.` };

export const TEXT = {
  en: {
    ui: { title: 'twist tower', sub: 'Four floors round a concrete core, each turned 14° on the one below, on a podium.', drawingV: 'twist tower · axonometric', sheet: 'sheet T-301' },
    stats: [['floor area', '280 m²'], ['height', el(TOP).slice(1) + ' m'], ['floors', '4 · 9 parts']],
    name: { podium: 'Podium', core: 'Concrete core', floor1: 'Floor 1 · larch fins', floor2: 'Floor 2 · brick', floor3: 'Floor 3 · yellow fins', floor4: 'Floor 4 · larch fins', spiral: 'Spiral stair', roof: 'Roof terrace', landscape: 'Trees and planting', site: 'Site' },
    co: { pergola: 'Pergola · larch', roof: 'Roof terrace', floor4: 'Floor 4 · turned 42°', floor3: 'Floor 3 · turned 28°', floor2: 'Floor 2 · turned 14°', floor1: 'Floor 1', spiral: 'Spiral stair', core: 'Concrete core', podium: 'Concrete podium', fins: 'Vertical fins', brick: 'Brick spandrel' },
    lv: { ground: 'ground', podium: 'podium', f2: 'floor 2', f3: 'floor 3', f4: 'floor 4', roof: 'roof' },
    info: {
      podium: { size: '13.0 × 11.0 m', mat: 'board-marked concrete', trade: 'concrete', qty: '1 slab · 3 steps', note: 'Lifts the tower 600 mm off the meadow; two planters at opposite corners.' },
      core: { size: '3.2 × 3.2 × 15.3 m', mat: 'in-situ concrete, 600 mm lifts', trade: 'concrete', qty: '1 shaft', note: 'Stair and lift; every floor hangs its slab off it.' },
      floor1: infoFloor(1, true), floor2: infoFloor(2, true), floor3: infoFloor(3, true), floor4: infoFloor(4, true),
      spiral: { size: 'Ø 2.0 m · 1 turn', mat: 'steel column, plate treads', trade: 'steel', qty: '17 treads', note: 'From the podium to the first floor’s balcony.' },
      roof: { size: '8.4 × 8.4 m', mat: 'larch deck, glass balustrade, timber pergola', trade: 'carpentry', qty: '1 terrace', note: 'A rainwater tank, two planters and a table under the pergola.' },
      landscape: { size: 'lot 30 × 26 m', mat: 'meadow, trees, shrubs', trade: 'landscape', qty: '4 trees', note: 'The meadow runs up to the podium.' },
    },
  },
  ru: {
    ui: { title: 'башня-твист', sub: 'Четыре этажа вокруг бетонного ядра, каждый повёрнут на 14° к нижнему, на подиуме.', drawingV: 'башня-твист · аксонометрия', sheet: 'лист T-301' },
    stats: [['площадь', '280 м²'], ['высота', el(TOP).slice(1).replace('.', ',') + ' м'], ['этажи', '4 · 9 частей']],
    name: { podium: 'Подиум', core: 'Бетонное ядро', floor1: 'Этаж 1 · ламели', floor2: 'Этаж 2 · кирпич', floor3: 'Этаж 3 · жёлтые ламели', floor4: 'Этаж 4 · ламели', spiral: 'Винтовая лестница', roof: 'Терраса на крыше', landscape: 'Деревья и зелень', site: 'Участок' },
    co: { pergola: 'Пергола · лиственница', roof: 'Терраса на крыше', floor4: 'Этаж 4 · поворот 42°', floor3: 'Этаж 3 · поворот 28°', floor2: 'Этаж 2 · поворот 14°', floor1: 'Этаж 1', spiral: 'Винтовая лестница', core: 'Бетонное ядро', podium: 'Бетонный подиум', fins: 'Вертикальные ламели', brick: 'Кирпичный пояс' },
    lv: { ground: 'земля', podium: 'подиум', f2: '2 этаж', f3: '3 этаж', f4: '4 этаж', roof: 'крыша' },
    info: {
      podium: { size: '13,0 × 11,0 м', mat: 'бетон с текстурой опалубки', trade: 'бетон', qty: '1 плита · 3 ступени', note: 'Поднимает башню на 600 мм над лугом; два кашпо по углам.' },
      core: { size: '3,2 × 3,2 × 15,3 м', mat: 'монолитный бетон, захватки 600 мм', trade: 'бетон', qty: '1 ствол', note: 'Лестница и лифт; к нему крепятся все плиты.' },
      floor1: infoFloor(1, false), floor2: infoFloor(2, false), floor3: infoFloor(3, false), floor4: infoFloor(4, false),
      spiral: { size: 'Ø 2,0 м · 1 виток', mat: 'стальная стойка, ступени из листа', trade: 'металл', qty: '17 ступеней', note: 'С подиума на балкон первого этажа.' },
      roof: { size: '8,4 × 8,4 м', mat: 'настил из лиственницы, стеклянное ограждение, пергола', trade: 'плотницкие', qty: '1 терраса', note: 'Бак для дождевой воды, два кашпо и стол под перголой.' },
      landscape: { size: 'участок 30 × 26 м', mat: 'луг, деревья, кустарник', trade: 'озеленение', qty: '4 дерева', note: 'Луг подходит к подиуму.' },
    },
  },
};

export const META = {
  code: 'TT', top: TOP,
  lot: { x0: -6.6, x1: 6.6, z0: -5.6, z1: 6.8, h: POD },
  entrance: [0, 7.2],
  trees: [[-9.8, 3.5], [9.6, -2.5], [-8.2, -7.6], [8.4, 7.4]],
  ivy: [[-6.5, 5.52, 6.5, 5.52, 0, .6, 0, 1], [6.52, -5.5, 6.52, 5.5, 0, .6, 1, 0], [-6.52, -5.5, -6.52, 5.5, 0, .6, -1, 0], [-1.6, 1.62, 1.6, 1.62, POD, 2.4, 0, 1]],
  cut: { section: 0, plan: FY(1) + 1.8 },
  eye: { dist: 34 },
  tour: ['f:axoR', 'floor4', 'roof', 'f:top', 'floor2', 'spiral', 'core', 'f:front', 'floor1', 'f:axoL', 'f:eye'],
  // the 10 s film: floor by floor the tower winds up as the camera climbs round it, the yellow floor lifts out
  // and turns, the whole stack spreads up the core, settles, and the camera comes down the twist to the grass
  film: {
    len: 10, build: 2.4,
    keys: [
      { t: 0, v: { az: -.6, el: .05, fill: .9 } }, { t: 2.4, v: 'f:axoL' }, { t: 3.8, v: 'l:floor3' }, { t: 5.0, v: 'l:floor3' },
      { t: 6.5, v: { az: .6, el: .3, explode: 1, fill: .92 } }, { t: 7.7, v: { az: 1.2, el: .22, explode: 1, fill: .92 } }, { t: 8.8, v: 'f:axoR' }, { t: 10, v: { az: -.15, el: .06, fill: .82 } },
    ],
    acts: [
      { t: 2.9, focus: 'floor3' }, { t: 3.2, lift: 'floor3' }, { t: 5.0, lift: null }, { t: 5.4, focus: null },
      { t: 5.5, explode: 1 }, { t: 7.7, explode: 0 },
    ],
  },
};
