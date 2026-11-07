// boomtown example model: a glass barn. A long gabled barn on timber bents with a black corrugated roof, its whole
// south side glazed behind a sliding barn door, board-clad gables with a hay door, a cream grain silo turned stair
// tower with a bridge, a lean-to greenhouse, a lap pool and a carport under a green roof.
// Metres, y up, +z to the front (the glazed side faces the eye). The ridge runs along x.
import * as THREE from 'three';
import { Part, V, rng } from 'boomtown/kit.js';
import { side, wallM, clad, glaze, range, railing, planter, tree, shrubs, grass, cylinder, log, tri } from 'boomtown/shapes.js';

export const P0 = .3;              // plinth top
export const X0 = -9, X1 = 9;      // barn ends
export const ZB = 4;               // half depth
export const EAVE = P0 + 4.2;
export const RIDGE = EAVE + 4.0;
export const MEZZ = P0 + 3.4;      // mezzanine floor, bridge to the silo
const BARN = [X0, -ZB, X1, ZB];

export const META = {
  code: 'GB',
  lot: { x0: -16, x1: 15, z0: -7.5, z1: 9.5, h: P0 },
  entrance: [0, 9.8],
  trees: [[-19, 2], [18.5, -4], [-12, -11.5], [6, -11], [19, 8]],
  ivy: [[X0 - .02, -ZB, X0 - .02, ZB, P0, 1.6, -1, 0]],
  steps: [-1.8, 1.8],
  top: 11.6,
  cut: { section: 0, plan: P0 + 1.8 },
  tour: ['f:axoR', 'facade', 'barndoor', 'silo', 'f:top', 'roof', 'greenhouse', 'f:front', 'pool', 'carport', 'f:axoL', 'f:eye'],
  eye: { theta: .22, dist: 42 },
};

// a point on a roof slope: s -1 back / +1 front, u eave (0) to ridge (1), at x, d out from the rafters
const RL = Math.hypot(ZB, RIDGE - EAVE);
const rs = (s, u, x, d = 0) => V(x, EAVE + (RIDGE - EAVE) * u + ZB / RL * d, s * ZB * (1 - u) + s * (RIDGE - EAVE) / RL * d);
const gableTop = (z) => EAVE + (RIDGE - EAVE) * (1 - Math.abs(z) / ZB);

export function build() {
  const parts = [];
  const P = (def) => { const p = new Part(def); parts.push(p); return p; };
  const R = rng(20261108);

  {
    const p = P({ id: 'site', site: true, start: .1, dur: 1.2, list: false, mono: true });
    for (let x = -20; x <= 20; x += 5) p.line(x, 0, -12.4, x, 0, 12.4, true);
    for (let z = -10; z <= 10; z += 5) p.line(-21.4, 0, z, 21.4, 0, z, true);
    const dash = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize(); for (let s = 0; s < L; s += 1.6) p.seg(a.clone().addScaledVector(d, s), a.clone().addScaledVector(d, Math.min(L, s + 1))); };
    dash(V(-22, 0, -13), V(22, 0, -13)); dash(V(22, 0, -13), V(22, 0, 13)); dash(V(22, 0, 13), V(-22, 0, 13)); dash(V(-22, 0, 13), V(-22, 0, -13));
  }

  // 1 · plinth and terrace: a concrete base, paving joints, steps
  {
    const p = P({ id: 'plinth', big: true, faint: true, start: .5, dur: 1.2, el: P0, explode: V(0, 0, 0) });
    p.box(-16, 0, -7.5, 15, P0, 9.5, 'concrete', { skip: 'yY' });
    // the top, with a hole where the pool is let into it
    const hx0 = -7, hx1 = 5, hz0 = 5.6, hz1 = 7.8, top = (x0, z0, x1, z1) => p.quad(V(x0, P0, z1), V(x1, P0, z1), V(x1, P0, z0), V(x0, P0, z0), 'concrete');
    top(-16, -7.5, 15, hz0); top(-16, hz1, 15, 9.5); top(-16, hz0, hx0, hz1); top(hx1, hz0, 15, hz1);
    const inPool = (x, z) => x > hx0 && x < hx1 && z > hz0 && z < hz1;
    for (let x = -16 + 1.2; x < 15; x += 1.2) { if (x > hx0 && x < hx1) { p.line(x, P0, -7.5, x, P0, hz0, true); p.line(x, P0, hz1, x, P0, 9.5, true); } else p.line(x, P0, -7.5, x, P0, 9.5, true); }
    for (let z = -7.5 + 2.4; z < 9.5; z += 2.4) { if (inPool(0, z)) { p.line(-16, P0, z, hx0, P0, z, true); p.line(hx1, P0, z, 15, P0, z, true); } else p.line(-16, P0, z, 15, P0, z, true); }
    p.box(-1.8, 0, 9.5, 1.8, .15, 10.0, 'concrete');
    p.anchors.main = V(-13, P0, 0); p.anchors.steps = V(1.2, .15, 9.8);
  }

  // 2 · bents: seven timber portal frames, a ridge beam, purlins, the mezzanine inside
  {
    const p = P({ id: 'frame', start: 1.1, dur: 1.5, el: RIDGE, explode: V(0, 1.4, 0), view: { az: .5, el: .28 } });
    for (const x of range(X0, X1, 6)) {
      for (const s of [-1, 1]) {
        p.box(x - .14, P0, s * ZB - .14, x + .14, EAVE, s * ZB + .14, 'timber');
        p.member(rs(s, 0, x, .12), rs(s, 1, x, .12), .2, .3, 'timber');
        p.member(V(x, EAVE - 1.1, s * (ZB - .1)), rs(s, .28, x, -.05), .1, .14, 'timber', { edges: 'fine' });   // knee braces
      }
      p.member(V(x, EAVE + 1.4, -ZB * .62), V(x, EAVE + 1.4, ZB * .62), .12, .2, 'timber', { edges: true });
    }
    p.member(V(X0 - .4, RIDGE - .1, 0), V(X1 + .4, RIDGE - .1, 0), .22, .32, 'timber');
    for (const s of [-1, 1]) for (const u of [.35, .7]) p.member(rs(s, u, X0 - .4, .1), rs(s, u, X1 + .4, .1), .08, .12, 'timber', { edges: 'fine' });
    // mezzanine at the west end, a long table, a kitchen block
    p.box(X0 + .2, MEZZ - .2, -ZB + .2, X0 + 5.8, MEZZ, ZB - .2, 'timber');
    railing(p, [V(X0 + 5.8, 0, -ZB + .3), V(X0 + 5.8, 0, ZB - .3)], MEZZ, 1.0);
    p.box(-.5, P0, -1.0, 5.5, P0 + .76, .2, 'timber'); p.box(-.6, P0 + .76, -1.1, 5.6, P0 + .82, .3, 'timber', { edges: 'fine' });
    p.box(6.4, P0, -3.6, 8.6, P0 + .92, -2.2, 'dark'); p.box(6.35, P0 + .92, -3.65, 8.65, P0 + .97, -2.15, 'paper', { edges: 'fine' });
    p.anchors.main = V(3, EAVE - .4, ZB + .2); p.anchors.mezz = V(X0 + 5.8, MEZZ + 1, 1.5); p.anchors.brace = V(-3, EAVE - .6, ZB);
  }

  // 3 · roof: black corrugated sheet on both slopes, a ridge vent, gutters
  {
    const p = P({ id: 'roof', start: 2.4, dur: 1.4, el: RIDGE + .3, explode: V(0, 3.8, 0), view: { az: -.5, el: .45 } });
    const xa = X0 - .7, xb = X1 + .7, u0 = -.1;
    for (const s of [-1, 1]) {
      const A = rs(s, u0, xa, .3), Bq = rs(s, u0, xb, .3), C = rs(s, 1.01, xb, .3), D = rs(s, 1.01, xa, .3);
      if (s > 0) p.quad(A, Bq, C, D, 'dark', true); else p.quad(A, D, C, Bq, 'dark', true);
      if (s > 0) p.quad(rs(s, u0, xa, .2), rs(s, 1, xa, .2), rs(s, 1, xb, .2), rs(s, u0, xb, .2), 'timber'); else p.quad(rs(s, u0, xa, .2), rs(s, u0, xb, .2), rs(s, 1, xb, .2), rs(s, 1, xa, .2), 'timber');
      p.quad(rs(s, u0, xa, .2), rs(s, u0, xa, .3), rs(s, u0, xb, .3), rs(s, u0, xb, .2), 'dark');
      let i = 0;
      for (let x = xa + .2; x < xb; x += .2, i++) p.seg(rs(s, u0, x, .31), rs(s, 1, x, .31), i % 2 === 1);   // corrugations
      for (const x of [xa, xb]) p.member(rs(s, u0, x, .25), rs(s, 1.01, x, .25), .06, .16, 'dark', { edges: true });
      const g = rs(s, u0, 0, .2); p.member(V(xa, g.y - .08, g.z + s * .08), V(xb, g.y - .08, g.z + s * .08), .14, .12, 'steel');  // gutter
    }
    p.box(-6, RIDGE + .28, -.35, 6, RIDGE + .62, .35, 'dark');      // ridge vent
    for (let x = -5.8; x < 6; x += .4) p.line(x, RIDGE + .45, .352, x + .2, RIDGE + .45, .352, true);
    p.anchors.main = rs(-1, .6, -4, .32); p.anchors.vent = V(3, RIDGE + .62, 0); p.anchors.gutter = rs(1, -.1, 6, .2);
  }

  // 4 · the glazed south side: six bays of glass between the bents, a clerestory band above
  {
    const p = P({ id: 'facade', start: 3.4, dur: 1.4, el: EAVE, explode: V(0, .6, 3.4), view: { az: .15, el: .12 } });
    const f = side(BARN, 'front', P0); p.push(wallM(f));
    for (let b = 0; b < 6; b++) {
      const s0 = b * 3 + .14, s1 = (b + 1) * 3 - .14;
      if (b === 3) { glaze(p, [s0, s1], [2.8, EAVE - P0 - .05], { fw: .06 }); continue; }   // the door bay: glass only above the door
      glaze(p, range(s0, s1, 2), [0, 2.8, EAVE - P0 - .05], { fw: .06 });
    }
    p.pop();
    // the back: green corrugated cladding with a strip of high windows
    const fb = side(BARN, 'back', P0); p.push(wallM(fb));
    clad(p, .14, fb.len - .14, 0, 2.4); clad(p, .14, fb.len - .14, 3.4, EAVE - P0 - .05);
    glaze(p, range(.14, fb.len - .14, 6), [2.4, 3.4], { fw: .06 });
    p.pop();
    p.anchors.main = V(-4.5, P0 + 2.0, ZB + .08); p.anchors.clere = V(5.5, P0 + 3.4, ZB + .08); p.anchors.back = V(-6, P0 + 1.5, -ZB - .12);
  }

  // 5 · gables: vertical boards up to the slope, a hay door with its hoist beam on the east end
  {
    const p = P({ id: 'gables', start: 3.9, dur: 1.2, el: RIDGE, explode: V(0, 1.6, 0), view: { az: 1.2, el: .22 } });
    for (const [x, n] of [[X0 - .05, -1], [X1 + .05, 1]]) {
      for (let z = -ZB + .1; z < ZB - .1; z += .2) {
        const zz = z + .1, top = gableTop(Math.abs(zz) > Math.abs(z) ? zz : z) - .25;
        const door = n > 0 && z > -1.0 && z < 1.0;
        if (door) { p.box(x - .03, P0, z, x + .03, EAVE + .4, z + .2, 'timber', { edges: 'fine' }); p.box(x - .03, EAVE + 2.2, z, x + .03, Math.max(EAVE + 2.2, top), z + .2, 'timber', { edges: 'fine' }); }
        else p.box(x - .03, P0, z, x + .03, Math.max(P0 + .1, top), z + .2, 'timber', { edges: 'fine' });
      }
      // a round window in the west gable, a door below
      if (n < 0) {
        const c = V(x - .04, EAVE + 1.9, 0), N = 18;
        const pts = Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2; return V(x - .04, c.y + Math.sin(a) * .9, Math.cos(a) * .9); });
        for (let i = 0; i < N; i++) { tri(p, c, pts[i], pts[(i + 1) % N], 'steel', false); p.seg(pts[i], pts[(i + 1) % N]); }
        p.line(x - .045, c.y - .9, 0, x - .045, c.y + .9, 0); p.line(x - .045, c.y, -.9, x - .045, c.y, .9);
        p.glassQuad(V(x - .06, P0 + .1, 1.4), V(x - .06, P0 + .1, -.2), V(x - .06, P0 + 2.4, -.2), V(x - .06, P0 + 2.4, 1.4));
      }
    }
    // hay door: two leaves swung open, the hoist beam with its pulley
    const x = X1 + .05;
    p.box(x, EAVE + .4, -1.05, x + .1, EAVE + .5, 1.05, 'timber'); p.box(x, EAVE + 2.1, -1.05, x + .1, EAVE + 2.2, 1.05, 'timber');
    p.glassQuad(V(x + .02, EAVE + .5, -1.0), V(x + .02, EAVE + .5, 1.0), V(x + .02, EAVE + 2.1, 1.0), V(x + .02, EAVE + 2.1, -1.0));
    for (const s of [-1, 1]) { p.box(x, EAVE + .5, s * 1.05, x + 1.0, EAVE + 2.1, s * 1.05 + s * .06, 'fabric'); p.line(x, EAVE + .5, s * 1.08, x + 1.0, EAVE + 2.1, s * 1.08, true); p.line(x, EAVE + 2.1, s * 1.08, x + 1.0, EAVE + .5, s * 1.08, true); }
    p.member(V(x - .2, RIDGE - 1.1, 0), V(x + 1.6, RIDGE - 1.1, 0), .2, .24, 'timber');
    cylinder(p, x + 1.4, RIDGE - 1.6, 0, .18, .12, 'steel', { n: 10 }); p.line(x + 1.4, RIDGE - 1.6, .18, x + 1.4, EAVE + .2, .18, true);
    p.anchors.main = V(X0 - .1, EAVE + 1.9, -.95); p.anchors.hay = V(x + 1.0, EAVE + 1.3, 1.1); p.anchors.hoist = V(x + 1.6, RIDGE - 1.1, 0);
  }

  // 6 · the barn door: a big timber leaf on a steel track, slid half open
  {
    const p = P({ id: 'barndoor', start: 4.4, dur: .9, el: P0 + 3.0, explode: V(2.6, .4, 2.8), view: { az: .35, el: .14 } });
    const z = ZB + .22, xa = 0 - 1.5 + 1.8;   // the leaf: 3.2 m wide, slid 1.8 m east
    p.box(-1.6, P0 + 2.95, z - .05, 6.4, P0 + 3.05, z + .05, 'steel');   // track
    for (const x of [-1.4, 0, 1.6, 3.2, 4.8, 6.2]) p.box(x - .05, P0 + 2.85, ZB, x + .05, P0 + 2.95, z, 'steel', { edges: 'fine' });
    p.box(xa - 1.6, P0 + .05, z, xa + 1.6, P0 + 2.85, z + .1, 'fabric');
    for (let x = xa - 1.6 + .2; x < xa + 1.6; x += .2) p.line(x, P0 + .05, z + .102, x, P0 + 2.85, z + .102, true);
    const fr = (a, b) => p.member(a, b, .12, .05, 'paper', { edges: true });
    fr(V(xa - 1.55, P0 + .12, z + .12), V(xa + 1.55, P0 + .12, z + .12)); fr(V(xa - 1.55, P0 + 2.78, z + .12), V(xa + 1.55, P0 + 2.78, z + .12));
    fr(V(xa - 1.55, P0 + 1.45, z + .12), V(xa + 1.55, P0 + 1.45, z + .12));
    fr(V(xa - 1.5, P0 + .15, z + .12), V(xa + 1.5, P0 + 1.42, z + .12)); fr(V(xa - 1.5, P0 + 1.48, z + .12), V(xa + 1.5, P0 + 2.75, z + .12));
    for (const x of [xa - 1.2, xa + 1.2]) cylinder(p, x, P0 + 2.85, z + .05, .1, .04, 'steel', { n: 10 });
    p.anchors.main = V(xa + 1.6, P0 + 1.6, z + .1); p.anchors.track = V(5.6, P0 + 3.0, z);
  }

  // 7 · silo: a cream steel grain silo, now the stair tower, a bridge into the mezzanine
  {
    const p = P({ id: 'silo', start: 4.9, dur: 1.3, el: 11.6, explode: V(-3.4, 2.4, 0), view: { az: -.85, el: .26 } });
    const cx = -12.4, cz = -2.4, r = 2.0, h = 10.0;
    cylinder(p, cx, P0, cz, r, h, 'concrete', { n: 32, staves: false, bands: range(.6, h - .4, 13), lid: 'dark', open: true });
    const N = 32, apex = V(cx, P0 + h + 1.3, cz);   // the conical cap
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, b = (i + 1) / N * Math.PI * 2; tri(p, V(cx + Math.cos(b) * (r + .12), P0 + h, cz + Math.sin(b) * (r + .12)), V(cx + Math.cos(a) * (r + .12), P0 + h, cz + Math.sin(a) * (r + .12)), apex, 'dark', i % 2 ? 'fine' : false); }
    cylinder(p, cx, P0 + h + 1.25, cz, .28, .3, 'dark', { n: 10 });
    // slit windows following the stair round
    for (let k = 0; k < 9; k++) {
      const a = .4 + k * .7, y = P0 + .8 + k * 1.0, c = Math.cos(a), s = Math.sin(a), q = V(cx + c * (r + .01), y, cz + s * (r + .01));
      const t = V(-s, 0, c).multiplyScalar(.18);
      p.glassQuad(q.clone().sub(t), q.clone().add(t), q.clone().add(t).setY(y + .9), q.clone().sub(t).setY(y + .9), false);
      p.seg(q.clone().sub(t), q.clone().add(t)); p.seg(q.clone().sub(t).setY(y + .9), q.clone().add(t).setY(y + .9));
    }
    // the bridge: a glazed steel tube between the silo and the barn's west gable
    const bx0 = cx + r - .1, bx1 = X0 - .1, bz0 = -1.0, bz1 = .6;
    p.box(bx0, MEZZ - .3, bz0, bx1, MEZZ, bz1, 'steel');
    p.box(bx0, MEZZ + 2.3, bz0, bx1, MEZZ + 2.45, bz1, 'steel');
    for (const z of [bz0, bz1]) { p.glassQuad(V(bx0, MEZZ, z), V(bx1, MEZZ, z), V(bx1, MEZZ + 2.3, z), V(bx0, MEZZ + 2.3, z)); p.line(bx0, MEZZ + 1.1, z, bx1, MEZZ + 1.1, z, true); }
    for (const x of [bx0 + .05, (bx0 + bx1) / 2, bx1 - .05]) for (const z of [bz0, bz1]) p.box(x - .04, MEZZ, z - .04, x + .04, MEZZ + 2.3, z + .04, 'steel', { edges: 'fine' });
    p.anchors.main = V(cx + r * .7, P0 + 6.5, cz + r * .7); p.anchors.bridge = V((bx0 + bx1) / 2, MEZZ + 2.45, bz1); p.anchors.cap = apex;
  }

  // 8 · greenhouse: a glass lean-to on the east end, planting beds inside
  {
    const p = P({ id: 'greenhouse', start: 5.5, dur: 1.1, el: P0 + 3.6, explode: V(3.6, 1.6, 0), view: { az: .95, el: .32 } });
    const x0 = X1 + .3, x1 = 14.4, z0 = -3.4, z1 = 2.6, yl = P0 + 2.4, yh = P0 + 3.6;   // the roof falls to the east
    const yAt = (x) => yh + (yl - yh) * (x - x0) / (x1 - x0);
    const xs = range(x0, x1, 4), zs = range(z0, z1, 5);
    for (const x of xs) for (const z of [z0, z1]) p.box(x - .04, P0, z - .04, x + .04, yAt(x), z + .04, 'steel', { edges: 'fine' });
    for (const z of zs) for (const x of [x1]) p.box(x - .04, P0, z - .04, x + .04, yl, z + .04, 'steel', { edges: 'fine' });
    for (const z of zs) p.member(V(x0, yh, z), V(x1 + .1, yl - .02, z), .05, .07, 'steel', { edges: 'fine' });
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i], b = xs[i + 1];
      p.glassQuad(V(b, P0 + .5, z1), V(a, P0 + .5, z1), V(a, yAt(a), z1), V(b, yAt(b), z1));   // front, back
      p.glassQuad(V(a, P0 + .5, z0), V(b, P0 + .5, z0), V(b, yAt(b), z0), V(a, yAt(a), z0));
    }
    for (let j = 0; j < zs.length - 1; j++) {
      p.glassQuad(V(x1, P0 + .5, zs[j]), V(x1, P0 + .5, zs[j + 1]), V(x1, yl, zs[j + 1]), V(x1, yl, zs[j]));
      p.glassQuad(V(x0, yh + .02, zs[j]), V(x1, yl + .02, zs[j]), V(x1, yl + .02, zs[j + 1]), V(x0, yh + .02, zs[j + 1]));
    }
    p.box(x0, P0, z0, x1, P0 + .5, z0 + .08, 'concrete'); p.box(x0, P0, z1 - .08, x1, P0 + .5, z1, 'concrete'); p.box(x1 - .08, P0, z0, x1, P0 + .5, z1, 'concrete');
    planter(p, x0 + .4, z0 + .4, x1 - .5, z0 + 1.6, P0, .6, R); planter(p, x0 + .4, z1 - 1.6, x1 - .5, z1 - .4, P0, .6, R);
    shrubs(p, x0 + .5, z0 + .5, x1 - .6, z0 + 1.5, P0 + .6, 9, R, .18, .3); shrubs(p, x0 + .5, z1 - 1.5, x1 - .6, z1 - .5, P0 + .6, 9, R, .18, .3);
    p.anchors.main = V(x1, yl - .3, (z0 + z1) / 2); p.anchors.beds = V(12, P0 + .8, z1);
  }

  // 9 · lap pool: a long basin in the terrace, a timber sun deck with loungers
  {
    const p = P({ id: 'pool', start: 6.0, dur: 1.0, el: P0, explode: V(0, 1.2, 2.4), view: { az: .3, el: .55 } });
    const x0 = -7, x1 = 5, z0 = 5.6, z1 = 7.8;
    p.box(x0 - .3, P0, z0 - .3, x1 + .3, P0 + .06, z0, 'paper'); p.box(x0 - .3, P0, z1, x1 + .3, P0 + .06, z1 + .3, 'paper');
    p.box(x0 - .3, P0, z0, x0, P0 + .06, z1, 'paper'); p.box(x1, P0, z0, x1 + .3, P0 + .06, z1, 'paper');
    p.quad(V(x0, P0 - 1.2, z1), V(x1, P0 - 1.2, z1), V(x1, P0 - 1.2, z0), V(x0, P0 - 1.2, z0), 'clad');   // the basin floor, seen through the water
    p.quad(V(x0, P0 - 1.2, z0), V(x1, P0 - 1.2, z0), V(x1, P0, z0), V(x0, P0, z0), 'clad');
    p.quad(V(x1, P0 - 1.2, z1), V(x0, P0 - 1.2, z1), V(x0, P0, z1), V(x1, P0, z1), 'clad');
    p.quad(V(x0, P0 - 1.2, z1), V(x0, P0 - 1.2, z0), V(x0, P0, z0), V(x0, P0, z1), 'clad');
    p.quad(V(x1, P0 - 1.2, z0), V(x1, P0 - 1.2, z1), V(x1, P0, z1), V(x1, P0, z0), 'clad');
    p.glassQuad(V(x0, P0 - .12, z1), V(x1, P0 - .12, z1), V(x1, P0 - .12, z0), V(x0, P0 - .12, z0));
    for (let x = x0 + 2; x < x1; x += 2) p.line(x, P0 - .11, z0 + .15, x, P0 - .11, z1 - .15, true);
    p.line(x0 + .2, P0 - .11, (z0 + z1) / 2, x1 - .2, P0 - .11, (z0 + z1) / 2, true);
    p.box(x1 + .5, P0, z0 - .3, x1 + 4.6, P0 + .12, z1 + .3, 'deck');
    for (let x = x1 + .64; x < x1 + 4.6; x += .14) p.line(x, P0 + .121, z0 - .3, x, P0 + .121, z1 + .3, true);
    for (const z of [z0 + .3, z1 - .5]) { p.box(x1 + 1.2, P0 + .12, z - .3, x1 + 3.2, P0 + .42, z + .3, 'paper'); p.quad(V(x1 + 1.2, P0 + .42, z - .3), V(x1 + 1.2, P0 + .42, z + .3), V(x1 + .75, P0 + .95, z + .3), V(x1 + .75, P0 + .95, z - .3), 'fabric', true); }
    p.anchors.main = V(x0 + 3, P0, z1 + .3); p.anchors.deck = V(x1 + 3.6, P0 + .12, z0);
  }

  // 10 · carport: four steel posts, a green roof with sedum and a timber log store
  {
    const p = P({ id: 'carport', start: 6.4, dur: 1.0, el: P0 + 2.9, explode: V(-2.4, 2.0, 1.6), view: { az: -.7, el: .32 } });
    const x0 = -15.6, x1 = -11, z0 = 2.4, z1 = 8.6;
    for (const [x, z] of [[x0 + .2, z0 + .2], [x1 - .2, z0 + .2], [x0 + .2, z1 - .2], [x1 - .2, z1 - .2]]) p.box(x - .07, P0, z - .07, x + .07, P0 + 2.6, z + .07, 'steel');
    p.box(x0, P0 + 2.6, z0, x1, P0 + 2.9, z1, 'steel');
    p.box(x0 + .1, P0 + 2.9, z0 + .1, x1 - .1, P0 + 3.0, z1 - .1, 'soil', { edges: 'fine' });
    shrubs(p, x0 + .2, z0 + .2, x1 - .2, z1 - .2, P0 + 3.0, 22, R, .12, .24);
    for (let row = 0; row < 5; row++) for (let k = 0; k < 9; k++) {
      const z = z0 + .5 + k * .32 + (row % 2) * .16, y = P0 + .15 + row * .24;
      if (z > z1 - 3.4) continue;
      log(p, V(x0 + .2, y, z), V(x0 + 1.1, y, z), .11, 'bark', { n: 6 });
    }
    p.anchors.main = V(x1, P0 + 2.75, (z0 + z1) / 2); p.anchors.roof = V(x0 + 1, P0 + 3.1, z1 - .6);
  }

  // 11 · garden: an orchard of trees, lavender rows, meadow grass
  {
    const p = P({ id: 'garden', big: true, planting: true, start: 6.9, dur: 1.4, el: 0, explode: V(0, 0, 0), view: { az: .2, el: .34 } });
    tree(p, -19, 0, 2, 8.5, 3.0, R, false); tree(p, 18.5, 0, -4, 9.5, 3.3, R, false); tree(p, -12, 0, -11.5, 10, 3.5, R, false);
    tree(p, 6, 0, -11, 9, 3.2, R, false); tree(p, 19, 0, 8, 6.6, 2.4, R, false);
    for (let row = 0; row < 3; row++) shrubs(p, 6 + row * 2.4, 10.4, 7 + row * 2.4, 14, 0, 9, R, .18, .26);
    planter(p, -4.6, 3.6 + .9, -2.0, 4.6 + .9, P0, .5, R); planter(p, 6.6, 4.5, 8.6, 5.3, P0, .5, R);
    grass(p, -20, 10.5, 20, 15, 0, 140, R);
    p.anchors.main = V(-19, 4, 2); p.anchors.lavender = V(9, .3, 10.4);
  }
  return parts;
}

export const CALLOUTS = [
  { part: 'silo', a: 'cap', k: 'silo', el: '+11.60', o: true },
  { part: 'roof', a: 'vent', k: 'roof', el: '+' + (RIDGE + .62).toFixed(2), o: true },
  { part: 'silo', a: 'bridge', k: 'bridge', o: true },
  { part: 'gables', a: 'hoist', k: 'hoist', o: true },
  { part: 'greenhouse', a: 'main', k: 'greenhouse', o: true },
  { part: 'facade', a: 'clere', k: 'facade', o: true },
  { part: 'barndoor', a: 'main', k: 'barndoor', o: true },
  { part: 'carport', a: 'roof', k: 'carport', o: true },
  { part: 'pool', a: 'main', k: 'pool', o: true },
  { part: 'plinth', a: 'main', k: 'plinth', el: '+' + P0.toFixed(2), o: false },
  { part: 'frame', a: 'brace', k: 'brace', o: false },
  { part: 'frame', a: 'mezz', k: 'mezz', el: '+' + MEZZ.toFixed(2), o: false },
  { part: 'roof', a: 'gutter', k: 'gutter', o: false },
  { part: 'gables', a: 'main', k: 'oculus', o: false },
  { part: 'gables', a: 'hay', k: 'hay', o: false },
  { part: 'barndoor', a: 'track', k: 'track', o: false },
  { part: 'pool', a: 'deck', k: 'sundeck', o: false },
  { part: 'greenhouse', a: 'beds', k: 'beds', o: false },
  { part: 'facade', a: 'back', k: 'back', o: false },
  { part: 'garden', a: 'lavender', k: 'lavender', o: false },
];

export const ORDER = ['plinth', 'frame', 'roof', 'facade', 'gables', 'barndoor', 'silo', 'greenhouse', 'pool', 'carport', 'garden'];
export const PART = {
  plinth:     { code: 'GB-01', el: '+0.30', mass: 210, qty: 1 },
  frame:      { code: 'GB-02', el: '+8.50', mass: 14.6, qty: 7 },
  roof:       { code: 'GB-03', el: '+9.12', mass: 4.2, qty: 2 },
  facade:     { code: 'GB-04', el: '+4.50', mass: 6.8, qty: 54 },
  gables:     { code: 'GB-05', el: '+8.50', mass: 2.9, qty: 160 },
  barndoor:   { code: 'GB-06', el: '+3.30', mass: .42, qty: 1 },
  silo:       { code: 'GB-07', el: '+11.60', mass: 11.0, qty: 1 },
  greenhouse: { code: 'GB-08', el: '+3.90', mass: 1.9, qty: 32 },
  pool:       { code: 'GB-09', el: '+0.30', mass: 46, qty: 1 },
  carport:    { code: 'GB-10', el: '+3.30', mass: 5.1, qty: 4 },
  garden:     { code: 'GB-11', el: '+0.00', mass: 0, qty: 5 },
};
export const LEVELS = [
  { v: 0, k: 'ground' }, { v: P0, k: 'plinth' }, { v: MEZZ, k: 'mezz' }, { v: EAVE, k: 'eave' }, { v: RIDGE, k: 'ridge' }, { v: 11.6, k: 'silo' },
];

export const TEXT = {
  en: {
    ui: { title: 'glass barn', sub: 'Timber bents, a black roof and a glazed south side, raised part by part.', drawingV: 'glass barn · axonometric' },
    stats: [['floor area', '144 m²'], ['mass', '303 t'], ['bents', '7 · 11 parts']],
    name: {
      plinth: 'Plinth and terrace', frame: 'Timber bents', roof: 'Corrugated roof', facade: 'Glazed south side', gables: 'Board gables', barndoor: 'Sliding barn door',
      silo: 'Silo stair tower', greenhouse: 'Greenhouse', pool: 'Lap pool', carport: 'Green-roof carport', garden: 'Orchard and lavender', site: 'Site',
    },
    co: {
      silo: 'Silo · stair tower', roof: 'Black corrugated roof', bridge: 'Glass bridge', hoist: 'Hay hoist beam', greenhouse: 'Lean-to greenhouse',
      facade: 'Glazed south side · 3 m bays', barndoor: 'Sliding barn door', carport: 'Carport · sedum roof', pool: 'Lap pool 12 m', plinth: 'Concrete plinth',
      brace: 'Knee brace', mezz: 'Mezzanine', gutter: 'Steel gutter', oculus: 'Round gable window', hay: 'Hay door', track: 'Barn door track',
      sundeck: 'Sun deck', beds: 'Raised beds', back: 'Profiled sheet · high windows', lavender: 'Lavender rows',
    },
    lv: { ground: 'ground', plinth: 'plinth', mezz: 'mezzanine', eave: 'eave', ridge: 'ridge', silo: 'silo cap' },
    info: {
      plinth: { size: '31.0 × 17.0 m', mat: 'polished concrete, 1.2 m joints', trade: 'concrete', qty: '1 slab · 527 m²', note: 'One slab under the barn, the terrace and the pool; steps down to the path.' },
      frame: { size: '18.0 × 8.0 × 8.2 m', mat: 'oak posts, glulam rafters, knee braces', trade: 'carpentry', qty: '7 bents at 3 m', note: 'Each bent is a post-and-rafter portal; a mezzanine fills the west two bays.' },
      roof: { size: '2 × 19.4 × 6.2 m', mat: 'black corrugated steel, timber soffit', trade: 'roofing', qty: '2 slopes · 1 ridge vent', note: 'A 45° pitch; the ridge vent lets the summer heat out.' },
      facade: { size: '18.0 × 4.2 m', mat: 'steel frames, triple glazing; profiled sheet to the north', trade: 'glazing', qty: '54 panes', note: 'The whole south side is glass between the bents; the north side keeps a band of high windows.' },
      gables: { size: '2 × 8.0 × 8.2 m', mat: 'vertical larch boards', trade: 'carpentry', qty: '160 boards', note: 'A round window lights the mezzanine; the east gable keeps its hay door and hoist.' },
      barndoor: { size: '3.2 × 2.8 m', mat: 'red boards on a white Z frame, steel track', trade: 'carpentry', qty: '1 leaf · 420 kg', note: 'Rolls along the front on six hangers; open, it parks over the next bay.' },
      silo: { size: 'Ø 4.0 × 11.3 m', mat: 'cream steel rings, black cone', trade: 'steel', qty: '1 spiral stair · 9 slits', note: 'An old grain silo turned stair tower; a glass bridge crosses into the mezzanine.' },
      greenhouse: { size: '5.1 × 6.0 × 3.6 m', mat: 'steel frame, glass, concrete curb', trade: 'glazing', qty: '32 panes · 2 beds', note: 'Leans on the east gable; the roof falls away from the barn.' },
      pool: { size: '12.0 × 2.2 m', mat: 'white coping, larch sun deck', trade: 'pools', qty: '1 basin · 2 loungers', note: 'Set in the terrace in front of the glass, so the barn reflects in it.' },
      carport: { size: '4.6 × 6.2 × 3.0 m', mat: 'steel frame, sedum roof', trade: 'steel and landscape', qty: '4 posts · 1 log store', note: 'The roof is planted; logs are stacked at the back.' },
      garden: { size: 'site 44 × 26 m', mat: 'orchard trees, lavender, meadow', trade: 'landscape', qty: '5 trees · 3 lavender rows', note: 'Lavender runs to the east of the path; the orchard frames the barn.' },
    },
  },
  ru: {
    ui: { title: 'стеклянный амбар', sub: 'Деревянные рамы, чёрная кровля и стеклянный южный фасад, по частям.', drawingV: 'стеклянный амбар · аксонометрия' },
    stats: [['площадь', '144 м²'], ['масса', '303 т'], ['рамы', '7 · 11 частей']],
    name: {
      plinth: 'Цоколь и терраса', frame: 'Деревянные рамы', roof: 'Волнистая кровля', facade: 'Стеклянный южный фасад', gables: 'Дощатые фронтоны', barndoor: 'Откатные ворота',
      silo: 'Силос-лестница', greenhouse: 'Теплица', pool: 'Плавательный бассейн', carport: 'Навес с зелёной кровлей', garden: 'Сад и лаванда', site: 'Участок',
    },
    co: {
      silo: 'Силос · лестничная башня', roof: 'Чёрная волнистая кровля', bridge: 'Стеклянный мост', hoist: 'Балка подъёмника', greenhouse: 'Пристроенная теплица',
      facade: 'Южный фасад · шаг 3 м', barndoor: 'Откатные ворота', carport: 'Навес · седум', pool: 'Бассейн 12 м', plinth: 'Бетонный цоколь',
      brace: 'Подкос', mezz: 'Антресоль', gutter: 'Стальной жёлоб', oculus: 'Круглое окно', hay: 'Сенная дверь', track: 'Направляющая ворот',
      sundeck: 'Солнечная палуба', beds: 'Высокие грядки', back: 'Профлист · верхние окна', lavender: 'Ряды лаванды',
    },
    lv: { ground: 'земля', plinth: 'цоколь', mezz: 'антресоль', eave: 'свес', ridge: 'конёк', silo: 'верх силоса' },
    info: {
      plinth: { size: '31,0 × 17,0 м', mat: 'шлифованный бетон, швы 1,2 м', trade: 'бетонные', qty: '1 плита · 527 м²', note: 'Одна плита под амбаром, террасой и бассейном; ступени к дорожке.' },
      frame: { size: '18,0 × 8,0 × 8,2 м', mat: 'дубовые стойки, клеёные стропила, подкосы', trade: 'плотницкие', qty: '7 рам с шагом 3 м', note: 'Каждая рама — портал из стоек и стропил; антресоль занимает два западных пролёта.' },
      roof: { size: '2 × 19,4 × 6,2 м', mat: 'чёрная волнистая сталь, деревянный софит', trade: 'кровельные', qty: '2 ската · 1 конёк-вентиляция', note: 'Уклон 45°; через коньковую вентиляцию уходит летнее тепло.' },
      facade: { size: '18,0 × 4,2 м', mat: 'стальные рамы, тройное остекление; профлист на севере', trade: 'остекление', qty: '54 стекла', note: 'Весь южный фасад — стекло между рамами; на севере полоса верхних окон.' },
      gables: { size: '2 × 8,0 × 8,2 м', mat: 'вертикальная доска лиственницы', trade: 'плотницкие', qty: '160 досок', note: 'Круглое окно освещает антресоль; на восточном фронтоне сохранены сенная дверь и подъёмник.' },
      barndoor: { size: '3,2 × 2,8 м', mat: 'красная доска на белой Z-раме, стальная направляющая', trade: 'плотницкие', qty: '1 створка · 420 кг', note: 'Катится вдоль фасада на шести подвесах; открытая, стоит перед соседним пролётом.' },
      silo: { size: 'Ø 4,0 × 11,3 м', mat: 'кремовые стальные кольца, чёрный конус', trade: 'металл', qty: '1 винтовая лестница · 9 прорезей', note: 'Бывший зерновой силос стал лестничной башней; стеклянный мост ведёт на антресоль.' },
      greenhouse: { size: '5,1 × 6,0 × 3,6 м', mat: 'стальной каркас, стекло, бетонный борт', trade: 'остекление', qty: '32 стекла · 2 грядки', note: 'Пристроена к восточному фронтону; крыша падает от амбара.' },
      pool: { size: '12,0 × 2,2 м', mat: 'белый бортик, палуба из лиственницы', trade: 'бассейны', qty: '1 чаша · 2 шезлонга', note: 'Врезан в террасу перед стеклом, амбар отражается в воде.' },
      carport: { size: '4,6 × 6,2 × 3,0 м', mat: 'стальной каркас, кровля из седума', trade: 'металл и озеленение', qty: '4 стойки · 1 поленница', note: 'Кровля засажена; дрова сложены в глубине.' },
      garden: { size: 'участок 44 × 26 м', mat: 'плодовые деревья, лаванда, луг', trade: 'озеленение', qty: '5 деревьев · 3 ряда лаванды', note: 'Лаванда идёт к востоку от дорожки; сад обрамляет амбар.' },
    },
  },
};
