// boomtown model kit: everything is built from code as boxes, quads, segments and spheres.
// A Part collects fills (paper with a wash tint), glass, ink lines, fine hatch lines and round
// foliage. Each part becomes one group with a handful of draw calls.
import * as THREE from 'three';

// wash tints (multiplied into paper when "paint" is on). Kept pale: the ink carries the colour.
export const TINT = {
  paper:   [1.000, 0.996, 0.992],
  timber:  [0.985, 0.925, 0.890],
  deck:    [0.975, 0.905, 0.865],
  steel:   [0.930, 0.915, 0.945],
  clad:    [0.950, 0.905, 0.950],   // corrugated sheet, a pale mauve
  concrete:[0.955, 0.945, 0.940],
  soil:    [0.925, 0.860, 0.880],
  leaf:    [0.975, 0.880, 0.925],   // canopies: a blush
  leaf2:   [0.955, 0.865, 0.945],
  solar:   [0.860, 0.820, 0.945],
  fabric:  [0.965, 0.900, 0.930],
  dark:    [0.900, 0.870, 0.900],
  bark:    [0.975, 0.915, 0.885],
  blue:    [0.880, 0.880, 0.975],
  brick:   [0.985, 0.900, 0.880],
  yellow:  [0.990, 0.955, 0.870],
};
// the painted model: material ids and their true colours (sRGB)
export const MATS = ['paper', 'timber', 'deck', 'steel', 'clad', 'concrete', 'soil', 'leaf', 'leaf2', 'solar', 'fabric', 'dark', 'bark', 'blue', 'brick', 'yellow'];
export const COLOR = {   // the lit tone of each material; mid and shade are x .84 and x .58 (see paint.js)
  paper: '#f4dfb4', timber: '#e48a3a', deck: '#c96c2c', steel: '#3a363d', clad: '#2f9a58', concrete: '#efe2c8',
  soil: '#7a4f2c', leaf: '#56a03c', leaf2: '#8cc244', solar: '#2b55d0', fabric: '#f2553a', dark: '#36313a', bark: '#8a5a33',
  blue: '#2c63d6', brick: '#c2502f', yellow: '#f3b62c',
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Part {
  constructor(def) {
    Object.assign(this, def);
    this.fp = []; this.fn = []; this.fc = [];   // fill positions, normals, colours
    this.fm = [];                               // material id per fill vertex (painted model)
    this.gp = []; this.gn = [];                 // glass
    this.ink = []; this.fine = [];              // segments: flat [ax,ay,az,bx,by,bz]
    this.spheres = [];                          // {c, r, tint}
    this.m = new THREE.Matrix4();               // current placement
    this.stack = [];
    this.nm = new THREE.Matrix3();
    this.anchors = {};                          // named points for callouts
  }
  push(m) { this.stack.push(this.m.clone()); this.m.multiply(m); return this; }
  pop() { this.m = this.stack.pop(); return this; }
  at(x, y, z, rotY = 0) {
    const m = new THREE.Matrix4().makeTranslation(x, y, z);
    if (rotY) m.multiply(new THREE.Matrix4().makeRotationY(rotY));
    return this.push(m);
  }
  tf(p) { return p.clone().applyMatrix4(this.m); }

  // ── primitives ──────────────────────────────────────────────────────────
  tri(a, b, c, tint) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const t = TINT[tint] || tint, id = typeof tint === 'string' ? Math.max(0, MATS.indexOf(tint)) : 0;
    for (const p of [a, b, c]) { this.fp.push(p.x, p.y, p.z); this.fn.push(n.x, n.y, n.z); this.fc.push(t[0], t[1], t[2]); this.fm.push(id); }
  }
  // quad in world (already transformed) coordinates, counter-clockwise seen from the front
  quadW(a, b, c, d, tint) { this.tri(a, b, c, tint); this.tri(a, c, d, tint); }
  quad(a, b, c, d, tint = 'paper', edges = false) {
    const A = this.tf(a), B = this.tf(b), C = this.tf(c), D = this.tf(d);
    this.quadW(A, B, C, D, tint);
    if (edges) { const L = edges === 'fine' ? this.fine : this.ink; this._segW(L, A, B); this._segW(L, B, C); this._segW(L, C, D); this._segW(L, D, A); }
  }
  glassQuad(a, b, c, d, strokes = true) {
    const A = this.tf(a), B = this.tf(b), C = this.tf(c), D = this.tf(d);
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
    for (const p of [A, B, C, A, C, D]) { this.gp.push(p.x, p.y, p.z); this.gn.push(n.x, n.y, n.z); }
    if (strokes) this._glassStrokes(A, B, C, D, n);
  }
  // reflection strokes: two or three short parallel diagonals, the drafting sign for glass
  _glassStrokes(A, B, C, D, n) {
    const u = new THREE.Vector3().subVectors(B, A), v = new THREE.Vector3().subVectors(D, A);
    const lu = u.length(), lv = v.length();
    if (lu < .35 || lv < .35) return;
    const off = n.clone().multiplyScalar(.012);
    const h = hash(A.x * 3.1 + A.y * 7.7 + A.z * 1.3);
    const k = lu * lv > 2.2 ? 3 : 2;
    const s0 = .22 + .25 * h;
    for (let i = 0; i < k; i++) {
      const c0 = s0 + i * .085 + (i === 2 ? .07 : 0);
      const len = (i === 1 ? .34 : .22) * Math.min(1, 1.6 / Math.max(lu, lv) + .35);
      // a diagonal from (c0 - len, c0 + len) mapped onto the pane
      const p0 = A.clone().addScaledVector(u, Math.max(.06, c0 - len * .5)).addScaledVector(v, Math.min(.94, c0 + len * .9));
      const p1 = A.clone().addScaledVector(u, Math.min(.94, c0 + len * .5)).addScaledVector(v, Math.max(.06, c0 - len * .2));
      this._segW(this.fine, p0.add(off), p1.add(off));
    }
  }
  _segW(L, a, b) { L.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  seg(a, b, fine = false) { this._segW(fine ? this.fine : this.ink, this.tf(a), this.tf(b)); }
  line(ax, ay, az, bx, by, bz, fine = false) { this.seg(V(ax, ay, az), V(bx, by, bz), fine); }
  poly(pts, closed = false, fine = false) {
    for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i], pts[i + 1], fine);
    if (closed) this.seg(pts[pts.length - 1], pts[0], fine);
  }

  // axis-aligned box in the current frame; o.edges: true | 'fine' | false ; o.skip: faces to leave out
  box(x0, y0, z0, x1, y1, z1, tint = 'paper', o = {}) {
    const P = [
      V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0),
      V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1),
    ].map((p) => this.tf(p));
    const skip = o.skip || '';
    const F = (k, a, b, c, d) => { if (!skip.includes(k)) this.quadW(P[a], P[b], P[c], P[d], tint); };
    F('z', 1, 0, 3, 2);  // -z
    F('Z', 4, 5, 6, 7);  // +z
    F('x', 0, 4, 7, 3);  // -x
    F('X', 5, 1, 2, 6);  // +x
    F('y', 0, 1, 5, 4);  // -y
    F('Y', 3, 7, 6, 2);  // +y
    const e = o.edges === undefined ? true : o.edges;
    if (e) {
      const L = e === 'fine' ? this.fine : this.ink;
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const no = o.noEdge || [];
      E.forEach(([a, b], i) => { if (!no.includes(i)) this._segW(L, P[a], P[b]); });
    }
    return this;
  }
  // a box between two points with a square section (posts, beams, rails, stringers)
  member(a, b, w, h, tint = 'steel', o = {}) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const m = new THREE.Matrix4();
    const x = d.clone().normalize();
    let up = Math.abs(x.y) > .95 ? V(1, 0, 0) : V(0, 1, 0);
    const z = new THREE.Vector3().crossVectors(x, up).normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    m.makeBasis(x, y, z).setPosition(a);
    this.push(m); this.box(0, -h / 2, -w / 2, len, h / 2, w / 2, tint, o); this.pop();
    return this;
  }
  sphere(cx, cy, cz, r, tint = 'leaf') {
    const c = this.tf(V(cx, cy, cz));
    this.spheres.push({ c, r, tint: TINT[tint] || tint, mat: typeof tint === 'string' ? tint : 'leaf' });
  }

  // ── surfaces with drafting hatches ──────────────────────────────────────
  // wall frame: origin o, along u (unit), up = +y, outward n; returns a mapper (s, t, d) -> point
  static frame(o, u, n) {
    const up = V(0, 1, 0);
    return (s, t, d = 0) => o.clone().addScaledVector(u, s).addScaledVector(up, t).addScaledVector(n, d);
  }
  // corrugated sheet: ribs every `pitch` metres on the outer face, lines alternate in a pair
  ribs(F, s0, s1, t0, t1, pitch = .14, d = .004) {
    let i = 0;
    for (let s = s0 + pitch * .5; s < s1 - pitch * .25; s += pitch, i++) {
      this.seg(F(s, t0, d), F(s, t1, d), true);
      if (i % 2 === 0) this.seg(F(s + pitch * .28, t0, d), F(s + pitch * .28, t1, d), true);
    }
  }
  // steel mesh: a square grid of fine lines
  mesh(F, s0, s1, t0, t1, pitch = .1, d = 0) {
    for (let s = s0 + pitch; s < s1 - pitch * .3; s += pitch) this.seg(F(s, t0, d), F(s, t1, d), true);
    for (let t = t0 + pitch; t < t1 - pitch * .3; t += pitch) this.seg(F(s0, t, d), F(s1, t, d), true);
  }
}

export function hash(x) { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
}
export { V };
