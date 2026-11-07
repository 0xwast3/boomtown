// boomtown example model: an A-frame cabin. A steep timber A on glulam ribs with a standing-seam roof, a fully
// glazed front gable, a sleeping loft, a box dormer, a stone chimney, a porch deck with a cedar hot tub, a lean-to
// woodshed and a fire pit in a clearing. Metres, y up, +z to the front (the glazed gable faces the eye).
import * as THREE from 'three';
import { Part, V, rng } from 'boomtown/kit.js';
import { up, wallM, glaze, range, slider, railing, planter, tree, shrubs, grass, picnic, cylinder, log, tri } from 'boomtown/shapes.js';

export const P0 = .6;           // platform top
export const B = 4.6;           // half width of the A at the platform
export const HA = 9.2;          // ridge above the platform
export const LOFT = P0 + 3.3;   // loft floor
export const Z0 = -6.5, Z1 = 3.5; // back and front gables
const RIDGE = P0 + HA;

// ── how the terminal treats this model ─────────────────────────────────────
export const META = {
  code: 'AF',
  lot: { x0: -9.5, x1: 9.5, z0: -8, z1: 7.4, h: P0 },
  entrance: [0, 8.6],
  trees: [[-13, 4], [12.5, -2], [-11, -10], [3, -12.5], [13, 8]],
  ivy: [[-9.5, -8.02, 9.5, -8.02, 0, P0, 0, -1]],
  steps: [-2.2, 2.2],
  top: RIDGE + .35,
  cut: { section: -1.5, plan: P0 + 1.8 },
  tour: ['f:axoR', 'gable', 'loft', 'dormer', 'f:top', 'chimney', 'hottub', 'f:front', 'woodshed', 'roof', 'f:axoL', 'f:eye'],
  eye: { theta: .26, dist: 34 },
};

// a point on a slope of the A: side -1 left / +1 right, u from the foot (0) to the ridge (1), at z, d out from the ribs
const LEN = Math.hypot(B, HA);
const slope = (s, u, z, d = 0) => V(s * B * (1 - u) + s * HA / LEN * d, P0 + HA * u + B / LEN * d, z);
const halfAt = (y) => B * (1 - (y - P0) / HA);       // half width of the A at height y

// ── the parts ──────────────────────────────────────────────────────────────
export function build() {
  const parts = [];
  const P = (def) => { const p = new Part(def); parts.push(p); return p; };
  const R = rng(20261107);

  // site: a set-out grid and the dashed boundary
  {
    const p = P({ id: 'site', site: true, start: .1, dur: 1.2, list: false, mono: true });
    for (let x = -15; x <= 15; x += 5) p.line(x, 0, -11.4, x, 0, 11.4, true);
    for (let z = -10; z <= 10; z += 5) p.line(-16.4, 0, z, 16.4, 0, z, true);
    const dash = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize(); for (let s = 0; s < L; s += 1.5) p.seg(a.clone().addScaledVector(d, s), a.clone().addScaledVector(d, Math.min(L, s + .9))); };
    dash(V(-17, 0, -12), V(17, 0, -12)); dash(V(17, 0, -12), V(17, 0, 12)); dash(V(17, 0, 12), V(-17, 0, 12)); dash(V(-17, 0, 12), V(-17, 0, -12));
  }

  // 1 · platform on screw piles, its boards, the steps down at the front
  {
    const p = P({ id: 'platform', big: true, faint: true, start: .5, dur: 1.3, el: P0, explode: V(0, 0, 0) });
    for (let x = -9; x <= 9.01; x += 2.25) for (const z of [-7.6, 7]) p.box(x - .16, -.05, z - .16, x + .16, .1, z + .16, 'concrete', { edges: 'fine' });
    p.box(-9.5, .1, -8, 9.5, P0, 7.4, 'deck', { skip: 'y' });
    p.line(-9.5, .3, 7.403, 9.5, .3, 7.403, true); p.line(9.503, .3, -8, 9.503, .3, 7.4, true);
    for (let x = -9.5 + .28; x < 9.5; x += .28) {   // boards run front to back, broken where the cabin stands
      const inside = Math.abs(x) < B - .1;
      if (inside) { p.line(x, P0, Z1 + .05, x, P0, 7.4, true); p.line(x, P0, -8, x, P0, Z0 - .05, true); }
      else p.line(x, P0, -8, x, P0, 7.4, true);
    }
    for (let z = -8 + 2.9 + R() * .4; z < 7.4; z += 3.6) p.line(-9.5, P0, z, 9.5, P0, z, true);
    p.box(-2.2, .1, 7.4, 2.2, .4, 7.8, 'deck'); p.box(-2.2, .1, 7.8, 2.2, .22, 8.2, 'deck');
    p.anchors.main = V(-6.5, P0, 5.5); p.anchors.steps = V(1.4, .4, 7.8);
  }

  // 2 · the A: glulam ribs, collar ties, the ground floor inside
  {
    const p = P({ id: 'frame', start: 1.2, dur: 1.5, el: RIDGE, explode: V(0, 1.2, 0), view: { az: .55, el: .3 } });
    const zs = range(Z0, Z1, 6);
    for (const z of zs) {
      for (const s of [-1, 1]) p.member(slope(s, 0, z, .12), slope(s, 1, z, .12), .2, .32, 'timber');
      p.member(V(-halfAt(LOFT + 1.9) + .1, LOFT + 1.9, z), V(halfAt(LOFT + 1.9) - .1, LOFT + 1.9, z), .14, .22, 'timber', { edges: true });
      p.box(-B - .2, P0, z - .2, -B + .3, P0 + .25, z + .2, 'steel', { edges: 'fine' });   // shoes
      p.box(B - .3, P0, z - .2, B + .2, P0 + .25, z + .2, 'steel', { edges: 'fine' });
    }
    p.member(V(0, RIDGE - .1, Z0 - .3), V(0, RIDGE - .1, Z1 + .3), .2, .3, 'timber');      // ridge beam
    for (const s of [-1, 1]) for (const u of [.33, .66]) p.member(slope(s, u, Z0, .1), slope(s, u, Z1, .1), .08, .12, 'timber', { edges: 'fine' });   // purlins
    // floor inside, a stove, a sofa, a kitchen run along the back
    p.box(-B + .3, P0, Z0, B - .3, P0 + .08, Z1, 'timber', { edges: 'fine' });
    for (let x = -B + .6; x < B - .3; x += .45) p.line(x, P0 + .081, Z0 + .05, x, P0 + .081, Z1 - .05, true);
    p.box(-2.2, P0 + .08, -6.2, 2.2, P0 + .95, -5.6, 'timber'); p.box(-2.25, P0 + .95, -6.25, 2.25, P0 + 1.0, -5.55, 'paper', { edges: 'fine' });
    p.box(-.8, P0 + .08, -1.5, 1.6, P0 + .5, -.6, 'fabric'); p.box(-.8, P0 + .5, -1.5, 1.6, P0 + .9, -1.25, 'fabric');
    p.box(-.5, P0 + .08, .5, .7, P0 + .42, 1.2, 'timber', { edges: 'fine' });
    p.anchors.main = slope(1, .45, Z1 - .2, .2); p.anchors.rib = slope(-1, .25, Z1, .2);
  }

  // 3 · roof: standing-seam sheet on both slopes, ridge cap, skylights on the left
  {
    const p = P({ id: 'roof', start: 2.4, dur: 1.4, el: RIDGE + .35, explode: V(0, 3.5, 0), view: { az: -.75, el: .38 } });
    const za = Z0 - .55, zb = Z1 + .95, u0 = -.04;
    for (const s of [-1, 1]) {
      const A = slope(s, u0, za, .3), Bq = slope(s, u0, zb, .3), C = slope(s, 1.015, zb, .3), D = slope(s, 1.015, za, .3);
      if (s > 0) p.quad(A, D, C, Bq, 'steel', true); else p.quad(A, Bq, C, D, 'steel', true);
      const Ai = slope(s, u0, za, .2), Bi = slope(s, u0, zb, .2), Ci = slope(s, 1, zb, .2), Di = slope(s, 1, za, .2);
      if (s > 0) p.quad(Ai, Bi, Ci, Di, 'timber'); else p.quad(Ai, Di, Ci, Bi, 'timber');   // soffit
      p.quad(slope(s, u0, za, .2), slope(s, u0, za, .3), slope(s, u0, zb, .3), slope(s, u0, zb, .2), 'timber');  // eave board
      for (let z = za + .45; z < zb - .1; z += .45) {    // standing seams, every second one doubled
        if (s < 0 && z > -3.6 && z < -1.2) { p.seg(slope(s, u0, z, .31), slope(s, .42, z, .31), true); p.seg(slope(s, .7, z, .31), slope(s, 1, z, .31), true); continue; }
        p.seg(slope(s, u0, z, .31), slope(s, 1, z, .31), true);
      }
      // the gable edges: verge boards front and back
      for (const z of [za, zb]) p.member(slope(s, u0, z, .25), slope(s, 1.015, z, .25), .06, .14, 'timber', { edges: true });
    }
    p.member(V(0, RIDGE + .32, za - .05), V(0, RIDGE + .32, zb + .05), .3, .1, 'dark');    // ridge cap
    // two skylights on the left slope
    for (const [z0, z1] of [[-3.6, -2.5], [-2.3, -1.2]]) {
      const a = slope(-1, .42, z0, .34), b = slope(-1, .42, z1, .34), c = slope(-1, .7, z1, .34), d = slope(-1, .7, z0, .34);
      p.glassQuad(a, b, c, d); p.seg(a, b); p.seg(b, c); p.seg(c, d); p.seg(d, a);
    }
    p.anchors.main = slope(-1, .6, Z0 + 1.2, .32); p.anchors.sky = slope(-1, .56, -2.4, .34); p.anchors.ridge = V(0, RIDGE + .38, Z0 + 2);
  }

  // 4 · the glazed front gable: mullions to the slope, a sliding door in the middle bay
  {
    const p = P({ id: 'gable', start: 3.4, dur: 1.4, el: RIDGE - .3, explode: V(0, .6, 3.2), view: { az: .2, el: .14 } });
    const z = Z1 + .05, xs = [-3.9, -2.6, -1.2, 1.2, 2.6, 3.9], tr = [P0 + .08, P0 + 2.45, P0 + 5.1];
    const m = new THREE.Matrix4().makeTranslation(0, 0, z); p.push(m);
    const top = (x) => P0 + HA * (1 - Math.abs(x) / B) - .45;
    for (const x of xs) p.box(x - .05, P0 + .08, -.06, x + .05, top(x), .06, 'steel');
    for (const y of tr) { const h = halfAt(y + .45) - .05; p.box(-h, y - .04, -.06, h, y + .04, .06, 'steel'); }
    // the sloped head on both sides
    for (const s of [-1, 1]) p.member(V(s * (halfAt(P0 + .45) - .1), P0 + .08, 0), V(0, RIDGE - .45, 0), .1, .12, 'steel');
    // panes: between mullions and transoms, the top row of each bay cut by the slope
    const cols = [-halfAt(P0 + .5), ...xs, halfAt(P0 + .5)];
    for (let i = 0; i < cols.length - 1; i++) {
      const a = cols[i] + .05, b = cols[i + 1] - .05;
      if (a < 0 && b > 0) continue;   // the door bay is handled below
      for (let j = 0; j < 3; j++) {
        const y0 = tr[j] + .04, y1 = j < 2 ? tr[j + 1] - .04 : 99;
        const ta = Math.min(y1, top(a) - .06), tb = Math.min(y1, top(b) - .06);
        if (ta <= y0 + .05 && tb <= y0 + .05) continue;
        p.glassQuad(V(a, y0, 0), V(b, y0, 0), V(b, Math.max(y0, tb), 0), V(a, Math.max(y0, ta), 0));
      }
    }
    // the middle bay: a slider below, glass up into the apex
    slider(p, -1.15, 1.15, P0 + .08, tr[1] - .04, .5);
    p.glassQuad(V(-1.15, tr[1] + .04, 0), V(1.15, tr[1] + .04, 0), V(1.15, tr[2] - .04, 0), V(-1.15, tr[2] - .04, 0));
    p.glassQuad(V(-1.15, tr[2] + .04, 0), V(1.15, tr[2] + .04, 0), V(1.15, top(1.15) - .06, 0), V(-1.15, top(1.15) - .06, 0));
    p.glassQuad(V(-.05, top(.6), 0), V(.05, top(.6), 0), V(0, RIDGE - .55, 0), V(0, RIDGE - .55, 0), false);
    p.pop();
    // the back gable: timber boards with one window
    const zb = Z0 - .05, hb = (y) => halfAt(y) - .15;
    for (let x = -B + .3; x < B - .3; x += .16) {
      const y1 = P0 + HA * (1 - Math.abs(x) / B) - .35;
      if (Math.abs(x) < .7 && true) { p.box(x, P0, zb - .05, x + .16, LOFT + 1.2, zb, 'timber', { edges: 'fine' }); p.box(x, LOFT + 2.6, zb - .05, x + .16, Math.max(LOFT + 2.6, y1), zb, 'timber', { edges: 'fine' }); }
      else p.box(x, P0, zb - .05, x + .16, Math.max(P0 + .1, y1), zb, 'timber', { edges: 'fine' });
    }
    p.glassQuad(V(.7, LOFT + 1.2, zb - .06), V(-.7, LOFT + 1.2, zb - .06), V(-.7, LOFT + 2.6, zb - .06), V(.7, LOFT + 2.6, zb - .06));
    p.anchors.main = V(-2.6, P0 + 3.6, z + .08); p.anchors.door = V(.6, P0 + 1.2, z + .1); p.anchors.apex = V(0, RIDGE - 1.6, z + .08);
    void hb;
  }

  // 5 · the sleeping loft: a deck on the collar beams, a mesh railing over the living room, beds
  {
    const p = P({ id: 'loft', start: 4.1, dur: 1.1, el: LOFT, explode: V(0, 2.4, 2.2), view: { az: .35, el: .42 } });
    const h = halfAt(LOFT) - .1, ze = Z1 - 2.4;
    p.box(-h, LOFT - .22, Z0 + .05, h, LOFT, ze, 'timber');
    for (let x = -h + .4; x < h; x += .4) p.line(x, LOFT + .001, Z0 + .1, x, LOFT + .001, ze - .05, true);
    railing(p, [V(-h + .2, 0, ze), V(h - .2, 0, ze)], LOFT, 1.0);
    p.box(-1.9, LOFT, -5.8, 1.9, LOFT + .45, -3.6, 'paper'); p.box(-1.9, LOFT + .45, -5.8, 1.9, LOFT + .6, -3.6, 'fabric', { edges: 'fine' });
    p.box(-1.7, LOFT + .45, -5.75, -.2, LOFT + .62, -5.25, 'paper', { edges: 'fine' }); p.box(.2, LOFT + .45, -5.75, 1.7, LOFT + .62, -5.25, 'paper', { edges: 'fine' });
    // a ladder down to the living room
    const lx = h - .8;
    for (const x of [lx - .25, lx + .25]) p.member(V(x, P0, ze + 1.3), V(x, LOFT + .9, ze), .06, .08, 'timber');
    for (let k = 1; k < 12; k++) { const t = k / 12; p.member(V(lx - .25, P0 + (LOFT - P0) * t, ze + 1.3 * (1 - t)), V(lx + .25, P0 + (LOFT - P0) * t, ze + 1.3 * (1 - t)), .05, .04, 'timber', { edges: 'fine' }); }
    p.anchors.main = V(-h + .8, LOFT + .5, ze); p.anchors.rail = V(.5, LOFT + 1, ze); p.anchors.ladder = V(lx, LOFT - 1.2, ze + .7);
  }

  // 6 · the dormer on the right slope: a box with a long window, its own flat roof
  {
    const p = P({ id: 'dormer', start: 4.7, dur: 1.0, el: P0 + 5.7, explode: V(3, 2.4, 0), view: { az: 1.05, el: .3 } });
    const za = -3.4, zb = -.4, xo = 3.55, yb = P0 + HA * (1 - xo / B), yt = P0 + 5.6, xi = halfAt(yt);
    // cheeks (triangles) and the face
    for (const z of [za, zb]) tri(p, V(xo, yb, z), V(xo, yt, z), V(xi, yt, z), 'clad');
    for (const z of [za, zb]) for (let k = 1; k < 6; k++) { const y = yb + (yt - yb) * k / 6; p.line(xo, y, z + (z < 0 ? -.004 : .004), xi + (xo - xi) * (y - yb) / (yt - yb) * 0 + (xo - (xo - xi) * (y - yb) / (yt - yb)), y, z + (z < 0 ? -.004 : .004), true); }
    p.box(xo - .1, yb, za, xo, yt, za + .25, 'clad'); p.box(xo - .1, yb, zb - .25, xo, yt, zb, 'clad');
    p.box(xo - .1, yb, za + .25, xo, yb + .35, zb - .25, 'clad');
    const m = new THREE.Matrix4().makeBasis(V(0, 0, -1), up, V(1, 0, 0)).setPosition(V(xo, yb + .35, zb - .25));
    p.push(m); glaze(p, range(0, (zb - za) - .5, 3), [0, yt - yb - .55], { fw: .06 }); p.pop();
    p.box(xi - .05, yt, za - .25, xo + .3, yt + .16, zb + .25, 'steel');
    p.anchors.main = V(xo + .05, yt - .8, zb - .4); p.anchors.window = V(xo + .05, yb + 1.1, (za + zb) / 2);
  }

  // 7 · chimney: a stone stack through the left slope, a steel cap
  {
    const p = P({ id: 'chimney', start: 5.1, dur: 1.0, el: P0 + 7.2, explode: V(-3.2, 2.2, 0), view: { az: -1.1, el: .32 } });
    const x0 = -3.3, x1 = -2.1, z0 = -5.3, z1 = -4.1, top = P0 + 7.0;
    p.box(x0, 0, z0, x1, top, z1, 'concrete');
    let row = 0;
    for (let y = .32; y < top - .05; y += .32, row++) {   // stone courses and joints on the two faces that show
      p.line(x0 - .003, y, z0, x0 - .003, y, z1, true); p.line(x0, y, z1 + .003, x1, y, z1 + .003, true);
      for (let s = (row % 2) * .3 + .2; s < 1.2; s += .6) { p.line(x0 - .003, y - .32, z0 + s, x0 - .003, y, z0 + s, true); p.line(x0 + s, y - .32, z1 + .003, x0 + s, y, z1 + .003, true); }
    }
    p.box(x0 - .12, top, z0 - .12, x1 + .12, top + .12, z1 + .12, 'concrete');
    cylinder(p, (x0 + x1) / 2, top + .12, (z0 + z1) / 2, .16, .55, 'steel', { n: 12 });
    p.box((x0 + x1) / 2 - .32, top + .67, (z0 + z1) / 2 - .32, (x0 + x1) / 2 + .32, top + .74, (z0 + z1) / 2 + .32, 'dark');
    // the stove inside it
    p.box(x1, P0, -5.1, x1 + .8, P0 + .9, -4.3, 'dark'); p.box(x1 + .79, P0 + .25, -4.95, x1 + .81, P0 + .7, -4.45, 'fabric', { edges: 'fine' });
    p.anchors.main = V(x0 - .02, top - .6, (z0 + z1) / 2); p.anchors.cap = V((x0 + x1) / 2, top + .74, (z0 + z1) / 2);
  }

  // 8 · the porch: railings, a bench, planters, string lights on posts
  {
    const p = P({ id: 'porch', start: 5.5, dur: 1.0, el: P0, explode: V(0, .8, 2.6), view: { az: .4, el: .3 } });
    railing(p, [V(-9.3, 0, 2.6), V(-9.3, 0, 7.2), V(-2.4, 0, 7.2)], P0, 1.0);
    railing(p, [V(2.4, 0, 7.2), V(9.3, 0, 7.2), V(9.3, 0, -1)], P0, 1.0);
    p.box(-8.6, P0, 4.2, -7.9, P0 + .45, 6.8, 'timber'); p.box(-8.7, P0 + .45, 4.1, -7.8, P0 + .5, 6.9, 'timber', { edges: 'fine' });
    planter(p, -6.6, 6.5, -4.4, 7.0, P0, .5, R); planter(p, 4.4, 6.5, 6.6, 7.0, P0, .5, R);
    picnic(p, -5.6, 4.6, Math.PI / 2, P0);
    const posts = [[-9.3, 7.2], [-2.4, 7.2], [2.4, 7.2], [9.3, 7.2]];
    for (const [x, z] of posts) p.box(x - .05, P0 + 1, z - .05, x + .05, P0 + 2.6, z + .05, 'timber', { edges: 'fine' });
    for (let i = 0; i < posts.length - 1; i++) {   // the string of lights sags between the posts
      const [ax, az] = posts[i], [bx, bz] = posts[i + 1];
      let prev = V(ax, P0 + 2.6, az);
      for (let k = 1; k <= 10; k++) { const t = k / 10, q = V(ax + (bx - ax) * t, P0 + 2.6 - Math.sin(Math.PI * t) * .45, az + (bz - az) * t); p.seg(prev, q, true); if (k < 10) p.sphere(q.x, q.y - .06, q.z, .045, 'fabric'); prev = q; }
    }
    p.anchors.main = V(-6, P0 + 1, 7.2); p.anchors.lights = V(5.8, P0 + 2.2, 7.2); p.anchors.bench = V(-8.25, P0 + .5, 5.5);
  }

  // 9 · the hot tub: a cedar barrel with hoops, a lid folded back, steps
  {
    const p = P({ id: 'hottub', start: 5.9, dur: .9, el: P0 + 1.05, explode: V(2.4, 1.6, 1.2), view: { az: .9, el: .5 } });
    const cx = 6.3, cz = 3.8;
    cylinder(p, cx, P0, cz, 1.15, 1.0, 'timber', { n: 28, staves: true, bands: [.2, .78], open: true });
    cylinder(p, cx, P0, cz, 1.06, .78, 'timber', { n: 28, base: false, open: true });
    for (let i = 0; i < 28; i++) {   // the water: a clear disc a little under the rim
      const a0 = i / 28 * Math.PI * 2, a1 = (i + 1) / 28 * Math.PI * 2, y = P0 + .8;
      p.glassQuad(V(cx, y, cz), V(cx + Math.cos(a1) * 1.06, y, cz + Math.sin(a1) * 1.06), V(cx + Math.cos(a0) * 1.06, y, cz + Math.sin(a0) * 1.06), V(cx + Math.cos(a0) * 1.06, y, cz + Math.sin(a0) * 1.06), false);
    }
    cylinder(p, cx, P0 + 1.0, cz, 1.15, .05, 'timber', { n: 28, open: true });
    p.box(cx - 1.25, P0 + 1.0, cz - 1.25, cx + 1.25, P0 + 1.08, cz - 1.15, 'dark');
    for (const k of [0, 1]) p.box(cx - .45, P0 + k * .32, cz + 1.15 + (1 - k) * .3, cx + .45, P0 + .32 + k * .32, cz + 1.75 - k * .3, 'timber');
    p.anchors.main = V(cx + 1.15, P0 + .7, cz); p.anchors.water = V(cx - .3, P0 + .86, cz);
  }

  // 10 · woodshed: a lean-to on posts with a stack of split logs
  {
    const p = P({ id: 'woodshed', start: 6.3, dur: 1.0, el: P0 + 2.4, explode: V(-2.6, 1.6, -1.2), view: { az: -.9, el: .3 } });
    const x0 = -9.2, x1 = -6.6, z0 = -7.6, z1 = -3.2;
    for (const [x, z, h] of [[x0, z0, 2.4], [x0, z1, 2.4], [x1, z0, 1.9], [x1, z1, 1.9]]) p.box(x - .07, P0, z - .07, x + .07, P0 + h, z + .07, 'timber');
    p.quad(V(x1 + .35, P0 + 1.86, z1 + .3), V(x1 + .35, P0 + 1.86, z0 - .3), V(x0 - .2, P0 + 2.48, z0 - .3), V(x0 - .2, P0 + 2.48, z1 + .3), 'steel', true);
    for (let z = z0 - .1; z < z1 + .3; z += .4) p.line(x1 + .35, P0 + 1.87, z, x0 - .2, P0 + 2.49, z, true);
    for (let y = P0 + .1; y < P0 + 2.2; y += .2) p.box(x0 - .03, y, z0, x0, y + .17, z1, 'timber', { edges: 'fine' });   // back boards
    for (let row = 0; row < 7; row++) for (let k = 0; k < 10; k++) {
      const z = z0 + .35 + k * .4 + (row % 2) * .2, y = P0 + .16 + row * .26;
      if (z > z1 - .2) continue;
      log(p, V(x0 + .15, y, z), V(x1 - .15, y, z), .12, 'bark', { n: 6 });
    }
    p.anchors.main = V(x1 - .1, P0 + 1.2, (z0 + z1) / 2); p.anchors.logs = V(x1 - .15, P0 + .8, z0 + 1.4);
  }

  // 11 · the clearing: trees, a fire pit with log benches, shrubs and grass
  {
    const p = P({ id: 'clearing', big: true, planting: true, start: 6.8, dur: 1.4, el: 0, explode: V(0, 0, 0), view: { az: .25, el: .32 } });
    tree(p, -13, 0, 4, 9.5, 3.2, R, false); tree(p, 12.5, 0, -2, 10.5, 3.6, R, false); tree(p, -11, 0, -10, 9, 3.1, R, false);
    tree(p, 3, 0, -12.5, 11, 3.6, R, false); tree(p, 13, 0, 8, 7.4, 2.6, R, false);
    const fx = -6, fz = 11;
    cylinder(p, fx, 0, fz, .85, .32, 'concrete', { n: 14, open: true, bands: [.16] });
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; log(p, V(fx + Math.cos(a) * .15, .1, fz + Math.sin(a) * .15), V(fx + Math.cos(a) * .55, .32, fz + Math.sin(a) * .55), .06, 'bark', { n: 5 }); }
    p.sphere(fx, .42, fz, .22, 'fabric');
    for (const a of [.4, 2.3, 4.2]) { const cx = fx + Math.cos(a) * 2.2, cz = fz + Math.sin(a) * 2.2, t = a + Math.PI / 2; log(p, V(cx + Math.cos(t) * .9, .22, cz + Math.sin(t) * .9), V(cx - Math.cos(t) * .9, .22, cz - Math.sin(t) * .9), .22, 'bark', { n: 9 }); }
    shrubs(p, 9.8, 2, 12, 6, 0, 7, R); shrubs(p, -12.4, -6, -10.2, -1, 0, 7, R); shrubs(p, -3, -10.4, 6, -8.6, 0, 9, R, .25, .55);
    grass(p, -15, 8.5, 15, 13, 0, 120, R);
    p.anchors.main = V(-6, .5, 11); p.anchors.tree = V(12.5, 5, -2);
  }
  return parts;
}

export const CALLOUTS = [
  { part: 'roof', a: 'ridge', k: 'roof', el: '+' + (RIDGE + .35).toFixed(2), o: true },
  { part: 'chimney', a: 'cap', k: 'chimney', o: true },
  { part: 'dormer', a: 'main', k: 'dormer', o: true },
  { part: 'gable', a: 'apex', k: 'gable', o: true },
  { part: 'loft', a: 'main', k: 'loft', el: '+' + LOFT.toFixed(2), o: false },
  { part: 'gable', a: 'door', k: 'slider', o: false },
  { part: 'hottub', a: 'main', k: 'hottub', o: true },
  { part: 'porch', a: 'lights', k: 'lights', o: true },
  { part: 'woodshed', a: 'main', k: 'woodshed', o: true },
  { part: 'platform', a: 'main', k: 'platform', el: '+' + P0.toFixed(2), o: true },
  { part: 'clearing', a: 'main', k: 'firepit', o: true },
  { part: 'frame', a: 'rib', k: 'rib', o: false },
  { part: 'roof', a: 'sky', k: 'sky', o: false },
  { part: 'loft', a: 'rail', k: 'rail', el: 'H 1000', o: false },
  { part: 'loft', a: 'ladder', k: 'ladder', o: false },
  { part: 'dormer', a: 'window', k: 'window', o: false },
  { part: 'woodshed', a: 'logs', k: 'logs', o: false },
  { part: 'hottub', a: 'water', k: 'water', o: false },
  { part: 'platform', a: 'steps', k: 'steps', o: false },
];

export const ORDER = ['platform', 'frame', 'roof', 'gable', 'loft', 'dormer', 'chimney', 'porch', 'hottub', 'woodshed', 'clearing'];
export const PART = {
  platform: { code: 'AF-01', el: '+0.60', mass: 9.6, qty: 64 },
  frame:    { code: 'AF-02', el: '+9.80', mass: 7.8, qty: 7 },
  roof:     { code: 'AF-03', el: '+10.15', mass: 3.1, qty: 48 },
  gable:    { code: 'AF-04', el: '+9.50', mass: 2.2, qty: 21 },
  loft:     { code: 'AF-05', el: '+3.90', mass: 1.4, qty: 1 },
  dormer:   { code: 'AF-06', el: '+6.20', mass: .9, qty: 1 },
  chimney:  { code: 'AF-07', el: '+7.80', mass: 6.4, qty: 22 },
  porch:    { code: 'AF-08', el: '+0.60', mass: .8, qty: 4 },
  hottub:   { code: 'AF-09', el: '+1.65', mass: .45, qty: 1 },
  woodshed: { code: 'AF-10', el: '+3.00', mass: .7, qty: 60 },
  clearing: { code: 'AF-11', el: '+0.00', mass: 0, qty: 5 },
};
export const LEVELS = [
  { v: 0, k: 'ground' }, { v: P0, k: 'platform' }, { v: LOFT, k: 'loft' }, { v: P0 + 5.6, k: 'dormer' }, { v: RIDGE, k: 'ridge' },
];

export const TEXT = {
  en: {
    ui: { title: 'a-frame cabin', sub: 'Glulam ribs, a standing-seam roof and a glass gable, raised part by part.', drawingV: 'a-frame cabin · axonometric' },
    stats: [['floor area', '86 m²'], ['mass', '34 t'], ['frames', '7 · 11 parts']],
    name: {
      platform: 'Timber platform', frame: 'Glulam A-frame', roof: 'Standing-seam roof', gable: 'Glazed gable', loft: 'Sleeping loft', dormer: 'Box dormer',
      chimney: 'Stone chimney', porch: 'Porch and lights', hottub: 'Cedar hot tub', woodshed: 'Woodshed', clearing: 'Clearing and fire pit', site: 'Site',
    },
    co: {
      roof: 'Standing-seam roof', chimney: 'Stone chimney · steel cap', dormer: 'Box dormer', gable: 'Glazed gable · 21 panes', loft: 'Sleeping loft',
      slider: 'Sliding glass door', hottub: 'Cedar hot tub', lights: 'String lights', woodshed: 'Lean-to woodshed', platform: 'Timber platform',
      firepit: 'Fire pit · log benches', rib: 'Glulam rib 200 × 320', sky: 'Roof windows', rail: 'Mesh railing', ladder: 'Loft ladder',
      window: 'Dormer window', logs: 'Split logs · 3 m³', water: 'Water · 1 400 l', steps: 'Timber steps',
    },
    lv: { ground: 'ground', platform: 'platform', loft: 'loft', dormer: 'dormer roof', ridge: 'ridge' },
    info: {
      platform: { size: '19.0 × 15.4 m', mat: 'larch boards on steel joists', trade: 'carpentry', qty: '64 screw piles', note: 'Raised 600 mm so snow and water pass under; the cabin stands on its back two thirds.' },
      frame: { size: '9.2 × 10.0 × 9.2 m', mat: 'glulam ribs 200 × 320, collar beams', trade: 'carpentry', qty: '7 frames at 1.67 m', note: 'The ribs land on steel shoes; collar beams carry the loft.' },
      roof: { size: '2 × 10.4 × 10.6 m', mat: 'standing-seam steel, timber soffit', trade: 'roofing', qty: '48 sheets · 2 roof windows', note: 'One sheet runs from eave to ridge; the seams sit every 450 mm.' },
      gable: { size: '9.0 × 8.8 m', mat: 'steel mullions, triple glazing', trade: 'glazing', qty: '21 panes', note: 'The whole front is glass up to the apex; the middle bay slides open onto the porch.' },
      loft: { size: '5.6 × 7.6 m', mat: 'CLT deck on collar beams', trade: 'carpentry', qty: '1 double bed', note: 'Open over the living room behind a mesh railing; a ladder climbs from the stove side.' },
      dormer: { size: '3.0 × 1.1 × 2.5 m', mat: 'green profiled sheet, flat steel roof', trade: 'carpentry and glazing', qty: '1 window band', note: 'Gives the loft standing height and a view east.' },
      chimney: { size: '1.2 × 1.2 × 7.6 m', mat: 'fieldstone, steel flue and cap', trade: 'masonry', qty: '22 stone courses', note: 'Rises from the ground beside the platform and through the west slope; the stove sits against it.' },
      porch: { size: '19.0 × 4.0 m', mat: 'larch deck, mesh railing, timber posts', trade: 'carpentry', qty: '4 light posts', note: 'A bench, planters and a table; the string lights sag between the posts.' },
      hottub: { size: 'Ø 2.3 × 1.0 m', mat: 'cedar staves, steel hoops', trade: 'carpentry', qty: '1 400 litres', note: 'Wood-fired; the lid folds back over the rail.' },
      woodshed: { size: '2.6 × 4.4 × 2.4 m', mat: 'timber posts, steel sheet roof', trade: 'carpentry', qty: '3 m³ of split logs', note: 'Open to the east so the wind dries the stack.' },
      clearing: { size: 'site 34 × 24 m', mat: 'meadow, stone ring, log benches', trade: 'landscape', qty: '5 trees · 1 fire pit', note: 'The cabin keeps its trees; the fire pit sits in front, off the path.' },
    },
  },
  ru: {
    ui: { title: 'дом-шалаш', sub: 'Клеёные рёбра, фальцевая кровля и стеклянный фронтон, по частям.', drawingV: 'дом-шалаш · аксонометрия' },
    stats: [['площадь', '86 м²'], ['масса', '34 т'], ['рамы', '7 · 11 частей']],
    name: {
      platform: 'Деревянная платформа', frame: 'А-рамы из клеёного бруса', roof: 'Фальцевая кровля', gable: 'Стеклянный фронтон', loft: 'Спальная антресоль', dormer: 'Мансардное окно',
      chimney: 'Каменная труба', porch: 'Веранда и гирлянды', hottub: 'Купель из кедра', woodshed: 'Дровник', clearing: 'Поляна и костровище', site: 'Участок',
    },
    co: {
      roof: 'Фальцевая кровля', chimney: 'Каменная труба · стальной колпак', dormer: 'Мансардное окно', gable: 'Стеклянный фронтон · 21 стекло', loft: 'Спальная антресоль',
      slider: 'Раздвижная стеклянная дверь', hottub: 'Купель из кедра', lights: 'Гирлянды', woodshed: 'Дровник', platform: 'Деревянная платформа',
      firepit: 'Костровище · скамьи из брёвен', rib: 'Клеёное ребро 200 × 320', sky: 'Кровельные окна', rail: 'Сетчатое ограждение', ladder: 'Лестница на антресоль',
      window: 'Окно мансарды', logs: 'Колотые дрова · 3 м³', water: 'Вода · 1 400 л', steps: 'Деревянные ступени',
    },
    lv: { ground: 'земля', platform: 'платформа', loft: 'антресоль', dormer: 'крыша мансарды', ridge: 'конёк' },
    info: {
      platform: { size: '19,0 × 15,4 м', mat: 'лиственница на стальных балках', trade: 'плотницкие', qty: '64 винтовые сваи', note: 'Поднята на 600 мм, снег и вода уходят под неё; дом стоит на задних двух третях.' },
      frame: { size: '9,2 × 10,0 × 9,2 м', mat: 'клеёные рёбра 200 × 320, ригели', trade: 'плотницкие', qty: '7 рам с шагом 1,67 м', note: 'Рёбра опираются на стальные башмаки; ригели несут антресоль.' },
      roof: { size: '2 × 10,4 × 10,6 м', mat: 'фальцевая сталь, деревянный софит', trade: 'кровельные', qty: '48 листов · 2 окна', note: 'Лист идёт целиком от свеса до конька; фальцы через 450 мм.' },
      gable: { size: '9,0 × 8,8 м', mat: 'стальные импосты, тройное остекление', trade: 'остекление', qty: '21 стекло', note: 'Весь фасад стеклянный до вершины; средний пролёт открывается на веранду.' },
      loft: { size: '5,6 × 7,6 м', mat: 'CLT-настил на ригелях', trade: 'плотницкие', qty: '1 двуспальная кровать', note: 'Открыта над гостиной за сетчатым ограждением; к ней ведёт лестница от печи.' },
      dormer: { size: '3,0 × 1,1 × 2,5 м', mat: 'зелёный профлист, плоская стальная крыша', trade: 'плотницкие и остекление', qty: '1 ленточное окно', note: 'Даёт антресоли полный рост и вид на восток.' },
      chimney: { size: '1,2 × 1,2 × 7,6 м', mat: 'бутовый камень, стальной дымоход и колпак', trade: 'кладка', qty: '22 ряда камня', note: 'Поднимается от земли у платформы и проходит сквозь западный скат; к ней приставлена печь.' },
      porch: { size: '19,0 × 4,0 м', mat: 'лиственница, сетчатое ограждение, стойки', trade: 'плотницкие', qty: '4 стойки с гирляндами', note: 'Скамья, кашпо и стол; гирлянды провисают между стойками.' },
      hottub: { size: 'Ø 2,3 × 1,0 м', mat: 'кедровая клёпка, стальные обручи', trade: 'плотницкие', qty: '1 400 литров', note: 'Дровяной подогрев; крышка откидывается на перила.' },
      woodshed: { size: '2,6 × 4,4 × 2,4 м', mat: 'деревянные стойки, стальная кровля', trade: 'плотницкие', qty: '3 м³ колотых дров', note: 'Открыт на восток, чтобы ветер сушил поленницу.' },
      clearing: { size: 'участок 34 × 24 м', mat: 'луг, каменное кольцо, скамьи из брёвен', trade: 'озеленение', qty: '5 деревьев · 1 костровище', note: 'Деревья сохранены; костровище стоит перед домом, в стороне от дорожки.' },
    },
  },
};
