// boomtown example model: the deck house. One file holds the whole model: META (how the terminal and the place
// round it treat this model), build() (the parts, drawn in code), CALLOUTS, ORDER / PART / LEVELS and TEXT.
//
// The deck house: a timber deck with container modules, a glazed two-storey core, a penthouse with a
// slatted rooftop pergola and solar array, a roof garden, a steel stair and access walkway, a timber
// pergola on a steel frame, a glazed pavilion, planters, tables and trees. Metres, y up, +z to the front.
import * as THREE from 'three';
import { Part, V, rng } from 'boomtown/kit.js';
import { up, side, wallM, F0, clad, glaze, range, slider, railing, stair, planter as planter0, tree, shrubs, grass, subtract, picnic as picnic0 } from 'boomtown/shapes.js';

export const DECK = 0.45;      // deck top
export const L2 = 3.73;        // core first floor / access walkway
export const ROOF = 6.91;      // core roof, roof garden
export const PH_TOP = 9.31;    // penthouse roof
export const RP_TOP = 10.45;   // rooftop pergola
export const PG_TOP = 3.46;    // timber pergola

// footprints (x0, z0, x1, z1)
const STUDIO = [-16, -10, -7, -4];
const KIOSK = [-17.5, 1.0, -11.5, 3.6];
const CORE = [-4, -8, 8, 0];
const PAV = [6, 3.5, 15, 9.5];
const PH = [-1, -7, 6, -2];


// ── how the terminal treats this model ─────────────────────────────────────
export const META = {
  code: 'BT',                                          // part codes: BT-01 ...; the overview is BT-00
  lot: { x0: -20, x1: 20, z0: -11, z1: 11, h: .45 },   // the plinth the meadow is laid out round; h = its height (ivy skirt)
  entrance: [-3.2, 11.3],                              // where the garden path from the eye ends
  trees: [[-12, 9], [-2.6, 6.4], [18, 9], [-24, -5], [-23, 6.8], [-9, -14.2], [3.5, -14.4], [16, -13.8], [24.6, -5.5], [25, 4.8]],
  ivy: [   // walls ivy climbs: x0, z0, x1, z1, y0, y1, nx, nz
    [-16.02, -10, -16.02, -4, .45, 3.4, -1, 0], [-16, -10.02, -7, -10.02, .45, 2.6, 0, -1], [-17.52, 1, -17.52, 3.6, .45, 2.4, -1, 0],
    [-4.02, -8, -4.02, 0, .45, 2.8, -1, 0], [-4, -8.02, 8, -8.02, .45, 2.2, 0, -1], [6, 3.48, 15, 3.48, .45, 1.8, 0, -1], [5.98, 3.5, 5.98, 9.5, .45, 2.0, -1, 0],
  ],
  steps: [-6.5, .5],                                   // a gap in the planting along the front (x from, to)
  top: RP_TOP,                                         // the elevation shown on the overview
  cut: { section: -3.0, plan: 2.25 },                  // section A-A (z) and the plan cut (y)
  // the 24 s show: frames (f:...) and parts, in order; it always ends on the ground
  tour: ['f:axoR', 'penthouse', 'solar', 'f:top', 'walkway', 'stair', 'pavilion', 'f:front', 'pergola', 'studio', 'f:axoL', 'f:eye'],
  eye: { theta: .3, dist: 46 },                        // where the eye stands on the meadow: azimuth, metres out
};

const picnic = (p, x, z, rot = 0) => picnic0(p, x, z, rot, DECK);
const planter = (p, x0, z0, x1, z1, y = DECK, h = .55, rand) => planter0(p, x0, z0, x1, z1, y, h, rand);

// ── the parts ──────────────────────────────────────────────────────────────
export function build() {
  const parts = [];
  const P = (def) => { const p = new Part(def); parts.push(p); return p; };
  const R = rng(20261106);

  // 0 · site: ground lines, set-out grid and dimensions
  {
    const p = P({ id: 'site', site: true, start: .1, dur: 1.3, list: false, mono: true });
    const X = 27, Z = 17;
    for (let x = -25; x <= 25; x += 5) p.line(x, 0, -Z + .6, x, 0, Z - .6, true);
    for (let z = -15; z <= 15; z += 5) p.line(-X + .6, 0, z, X - .6, 0, z, true);
    // dashed site boundary
    const dash = (a, b) => {
      const d = new THREE.Vector3().subVectors(b, a); const L = d.length(); d.normalize();
      for (let s = 0; s < L; s += 1.6) { const e = Math.min(L, s + 1.0); p.seg(a.clone().addScaledVector(d, s), a.clone().addScaledVector(d, e)); }
    };
    dash(V(-X, 0, -Z), V(X, 0, -Z)); dash(V(X, 0, -Z), V(X, 0, Z)); dash(V(X, 0, Z), V(-X, 0, Z)); dash(V(-X, 0, Z), V(-X, 0, -Z));
    for (const [cx, cz] of [[-X, -Z], [X, -Z], [X, Z], [-X, Z]]) { p.line(cx - .9, 0, cz, cx + .9, 0, cz); p.line(cx, 0, cz - .9, cx, 0, cz + .9); }
    // dimension lines along the front and the right side of the deck
    const dz = 13.4, dx = 22.4;
    p.line(-20, 0, dz, 20, 0, dz); p.line(-20, 0, 11.9, -20, 0, dz + .5); p.line(20, 0, 11.9, 20, 0, dz + .5);
    for (const x of [-20, 20]) p.line(x - .35, 0, dz + .35, x + .35, 0, dz - .35);
    p.line(dx, 0, -11, dx, 0, 11); p.line(20.4, 0, -11, dx + .5, 0, -11); p.line(20.4, 0, 11, dx + .5, 0, 11);
    for (const z of [-11, 11]) p.line(dx - .35, 0, z + .35, dx + .35, 0, z - .35);
    p.anchors.dimX = V(0, 0, dz); p.anchors.dimZ = V(dx, 0, 0);
    // north point on the ground, front left
    const nx = -23.5, nz = 13.5;
    p.poly([V(nx, 0, nz + 1.4), V(nx + .55, 0, nz - .2), V(nx, 0, nz + .25), V(nx - .55, 0, nz - .2)], true);
    p.line(nx, 0, nz + 1.4, nx, 0, nz - 1.2);
    p.anchors.north = V(nx, 0, nz - 1.6);
  }

  // 1 · deck, footings and steps
  {
    const p = P({ id: 'deck', big: true, faint: true, start: .55, dur: 1.5, el: DECK, explode: V(0, 0, 0) });
    // footings in a 2.5 m grid, only the outer rows show
    for (let x = -19; x <= 19.01; x += 2.5) for (const z of [-10.5, 10.5]) p.box(x - .2, -.06, z - .2, x + .2, .06, z + .2, 'concrete', { edges: 'fine' });
    for (let z = -8; z <= 8.01; z += 2.5) for (const x of [-19.5, 19.5]) p.box(x - .2, -.06, z - .2, x + .2, .06, z + .2, 'concrete', { edges: 'fine' });
    p.box(-20, .06, -11, 20, DECK, 11, 'deck', { skip: 'y' });
    // fascia board line and joist ends along the visible edges
    for (const z of [11]) { p.line(-20, .18, z + .003, 20, .18, z + .003, true); }
    p.line(20.003, .18, -11, 20.003, .18, 11, true);
    // planks, broken around the buildings that sit on the deck
    const holes = [STUDIO, KIOSK, CORE, PAV].map((r) => [r[0] + .05, r[2] - .05, r[1] + .05, r[3] - .05]);
    for (const t of [[-12, 9], [-2.6, 6.4], [18.0, 9.0]]) holes.push([t[0] - 1, t[0] + 1, t[1] - 1, t[1] + 1]);
    const pitch = .3;
    for (let z = -11 + pitch; z < 11 - 1e-6; z += pitch) {
      let iv = [[-20, 20]];
      for (const h of holes) if (z > h[2] - 1e-6 && z < h[3] + 1e-6) iv = subtract(iv, h[0], h[1]);
      for (const [a, b] of iv) if (b - a > .05) p.line(a, DECK, z, b, DECK, z, true);
      let x = -20 + R() * 3.9;
      while (x < 20) {
        if (iv.some(([a, b]) => x > a + .05 && x < b - .05)) p.line(x, DECK, z - pitch, x, DECK, z, true);
        x += 3.9 + R() * .5;
      }
    }
    // steps along the front, west of centre
    p.box(-20, .06, 11, -1, .30, 11.38, 'deck');
    p.box(-20, .06, 11.38, -1, .15, 11.76, 'deck');
    for (const [y, z0, z1] of [[.30, 11, 11.38], [.15, 11.38, 11.76]]) {
      p.line(-20, y, (z0 + z1) / 2, -1, y, (z0 + z1) / 2, true);
    }
    p.anchors.main = V(-6.5, DECK, 3.4);
    p.anchors.steps = V(-15, .30, 11.2);
    p.anchors.opening = V(-12, DECK + .1, 9.9);
  }

  // 2 · studio module with a green roof (back left)
  {
    const p = P({ id: 'studio', start: 1.45, dur: 1.4, el: 3.75, explode: V(-2.5, 2.0, -2.5), view: { az: -.35, el: .42 } });
    const r = STUDIO, [x0, z0, x1, z1] = r, y0 = DECK, y1 = DECK + 3.0;
    p.box(x0, y0, z0, x1, y0 + .15, z1, 'steel');                               // base frame
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) p.box(x - .09, y0, z - .09, x + .09, y1 + .02, z + .09, 'steel');
    let f = side(r, 'back', y0); p.push(wallM(f)); clad(p, .09, f.len - .09, .15, 3.0); p.pop();
    f = side(r, 'left', y0); p.push(wallM(f)); clad(p, .09, f.len - .09, .15, 3.0); p.pop();
    f = side(r, 'right', y0); p.push(wallM(f)); clad(p, .09, 2.2, .15, 3.0); glaze(p, range(2.2, f.len - .09, 2), [.15, 2.25, 3.0]); p.pop();
    f = side(r, 'front', y0); p.push(wallM(f));
    glaze(p, [.09, 1.9, 3.7, 5.5], [.15, 2.35, 3.0]); slider(p, 5.5, 7.3, .15, 2.35, .5); glaze(p, [5.5, 7.3], [2.35, 3.0]); glaze(p, [7.3, f.len - .09], [.15, 2.35, 3.0]);
    p.pop();
    p.box(x0 - .1, y1, z0 - .1, x1 + .1, y1 + .18, z1 + .1, 'steel');               // roof slab
    // parapet and the green roof
    p.box(x0 - .1, y1 + .18, z0 - .1, x1 + .1, y1 + .42, z0 + .05, 'steel'); p.box(x0 - .1, y1 + .18, z1 - .05, x1 + .1, y1 + .42, z1 + .1, 'steel');
    p.box(x0 - .1, y1 + .18, z0 + .05, x0 + .05, y1 + .42, z1 - .05, 'steel'); p.box(x1 - .05, y1 + .18, z0 + .05, x1 + .1, y1 + .42, z1 - .05, 'steel');
    p.box(x0 + .05, y1 + .18, z0 + .05, x1 - .05, y1 + .32, z1 - .05, 'soil', { edges: 'fine' });
    shrubs(p, x0 + .2, z0 + .2, x1 - .2, z1 - .2, y1 + .32, 22, R, .25, .55);
    grass(p, x0 + .3, z0 + .3, x1 - .3, z1 - .3, y1 + .32, 26, R);
    // inside: a long desk and shelving
    p.box(x0 + .4, y0 + .15, z0 + .4, x0 + 4.6, y0 + .9, z0 + 1.2, 'timber');
    p.box(x1 - 2.6, y0 + .15, z0 + .25, x1 - .4, y0 + 2.1, z0 + .65, 'timber');
    for (const t of [.6, 1.05, 1.5]) p.line(x1 - 2.6, y0 + .15 + t, z0 + .654, x1 - .4, y0 + .15 + t, z0 + .654, true);
    p.anchors.main = V((x0 + x1) / 2 - 1, y1 + .4, (z0 + z1) / 2);
    p.anchors.roof = V(x0 + 2.2, y1 + .5, z1 - 1.2);
  }

  // 3 · container kiosk with corrugated sheet and a serving hatch (under the pergola)
  {
    const p = P({ id: 'kiosk', start: 2.05, dur: 1.2, el: 3.05, explode: V(-3.0, 1.2, 1.5), view: { az: -.55, el: .32 } });
    const r = KIOSK, [x0, z0, x1, z1] = r, y0 = DECK, h = 2.6, y1 = y0 + h;
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
      p.box(x - .08, y0, z - .08, x + .08, y1, z + .08, 'steel');
      for (const y of [y0, y1 - .12]) p.box(x - .1, y, z - .1, x + .1, y + .12, z + .1, 'dark', { edges: 'fine' });   // corner castings
    }
    p.box(x0, y0, z0, x1, y0 + .12, z1, 'steel'); p.box(x0, y1 - .12, z0, x1, y1, z1, 'steel');
    let f = side(r, 'back', y0); p.push(wallM(f)); clad(p, .08, f.len - .08, .12, h - .12, .1, .12); p.pop();
    f = side(r, 'left', y0); p.push(wallM(f)); clad(p, .08, f.len - .08, .12, h - .12, .1, .12);
    // end doors with lock bars
    p.line(f.len / 2, .14, .02, f.len / 2, h - .14, .02); for (const s of [.6, 1.0, f.len - 1.0, f.len - .6]) p.line(s, .2, .03, s, h - .2, .03, true);
    p.pop();
    f = side(r, 'right', y0); p.push(wallM(f)); clad(p, .08, f.len - .08, .12, h - .12, .1, .12); p.pop();
    f = side(r, 'front', y0); p.push(wallM(f));
    clad(p, .08, 1.2, .12, h - .12, .1, .12); clad(p, 4.6, f.len - .08, .12, h - .12, .1, .12);
    clad(p, 1.2, 4.6, .12, 1.0, .1, .12); clad(p, 1.2, 4.6, 2.2, h - .12, .1, .12);
    p.box(1.1, .95, -.1, 4.7, 1.05, .45, 'timber');                                // counter
    // the hatch flap, propped open as an awning
    p.push(new THREE.Matrix4().makeTranslation(0, 2.2, 0).multiply(new THREE.Matrix4().makeRotationX(-1.75)));
    p.box(1.15, -1.2, 0, 4.65, 0, .05, 'clad'); p.ribs(F0, 1.15, 4.65, -1.18, -.02, .12, .055);
    p.pop();
    p.member(V(1.4, 1.05, .45), V(1.4, 2.35, .83), .03, .03, 'steel', { edges: 'fine' });
    p.member(V(4.4, 1.05, .45), V(4.4, 2.35, .83), .03, .03, 'steel', { edges: 'fine' });
    p.pop();
    p.box(x0, y1, z0, x1, y1 + .05, z1, 'clad');
    for (let x = x0 + .3; x < x1 - .1; x += .3) p.line(x, y1 + .052, z0 + .05, x, y1 + .052, z1 - .05, true);
    p.anchors.main = V(x0 + .4, y0 + 1.8, z1 + .02);
    p.anchors.sheet = V(x1 + .01, y0 + 1.2, (z0 + z1) / 2);
  }

  // 4 · central block: two floors, glazed to the front and east, clad to the back and west
  {
    const p = P({ id: 'core', start: 2.55, dur: 1.6, el: ROOF, explode: V(0, 1.2, 0), view: { az: .45, el: .30 } });
    const r = CORE, [x0, z0, x1, z1] = r, y0 = DECK;
    p.box(x0, y0, z0, x1, y0 + .15, z1, 'concrete');
    p.box(x0 - .05, L2 - .3, z0 - .05, x1 + .05, L2, z1 + .05, 'concrete');          // first floor slab, its edge reads on the facade
    p.box(x0 - .25, ROOF - .3, z0 - .25, x1 + .25, ROOF, z1 + .25, 'concrete');      // roof slab with a small overhang
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [2, z1]]) {
      p.box(x - .14, y0 + .15, z - .14, x + .14, L2 - .3, z + .14, 'steel');
      p.box(x - .14, L2, z - .14, x + .14, ROOF - .3, z + .14, 'steel');
    }
    const h1 = L2 - .3 - (y0 + .15), h2 = ROOF - .3 - L2;
    // back and west: corrugated cladding, a narrow window strip on the west
    let f = side(r, 'back', y0 + .15); p.push(wallM(f)); clad(p, .14, f.len - .14, 0, h1); p.pop();
    f = side(r, 'back', L2); p.push(wallM(f)); clad(p, .14, f.len - .14, 0, h2); p.pop();
    f = side(r, 'left', y0 + .15); p.push(wallM(f)); clad(p, .14, 5.0, 0, h1); clad(p, 5.9, f.len - .14, 0, h1); glaze(p, [5.0, 5.9], [0, h1 - .5]); clad(p, 5.0, 5.9, h1 - .5, h1); p.pop();
    f = side(r, 'left', L2); p.push(wallM(f)); clad(p, .14, 2.0, 0, h2); clad(p, 2.9, f.len - .14, 0, h2); glaze(p, [2.0, 2.9], [0, h2]); p.pop();
    // front: full height glazing in 1.5 m bays, a transom at door head height
    f = side(r, 'front', y0 + .15); p.push(wallM(f));
    glaze(p, range(.14, 5.86, 4), [0, 2.3, h1]); glaze(p, [6.14, 7.6], [0, 2.3, h1]); slider(p, 7.6, 9.5, 0, 2.3, .55); glaze(p, [7.6, 9.5], [2.3, h1]); glaze(p, range(9.5, f.len - .14, 2), [0, 2.3, h1]);
    p.pop();
    f = side(r, 'front', L2); p.push(wallM(f)); glaze(p, range(.14, 5.86, 4), [0, 2.2, h2]); glaze(p, range(6.14, f.len - .14, 4), [0, 2.2, h2]); p.pop();
    // east: glazed, a sliding door to the stair side upstairs
    f = side(r, 'right', y0 + .15); p.push(wallM(f)); glaze(p, range(.14, f.len - .14, 5), [0, 2.3, h1]); p.pop();
    f = side(r, 'right', L2); p.push(wallM(f)); glaze(p, [.14, 1.6], [0, 2.2, h2]); slider(p, 1.6, 3.4, 0, 2.2, .5); glaze(p, [1.6, 3.4], [2.2, h2]); glaze(p, range(3.4, f.len - .14, 3), [0, 2.2, h2]); p.pop();
    // ground floor: kitchen island, a long table with benches
    p.box(-1.8, y0 + .15, -6.2, 1.6, y0 + 1.05, -5.2, 'timber');
    p.box(-1.9, y0 + 1.05, -6.3, 1.7, y0 + 1.1, -5.1, 'paper', { edges: 'fine' });
    p.box(-3.6, y0 + .15, -7.85, 3.0, y0 + .95, -7.25, 'timber');                      // back counter
    p.box(-3.6, y0 + 1.6, -7.85, 3.0, y0 + 2.3, -7.45, 'timber');                      // wall cabinets
    p.box(3.3, y0 + .87, -4.6, 6.8, y0 + .92, -3.5, 'timber');                         // table
    for (const x of [3.5, 6.6]) p.box(x - .05, y0 + .15, -4.4, x + .05, y0 + .87, -3.7, 'timber', { edges: 'fine' });
    for (const z of [-4.95, -3.15]) p.box(3.5, y0 + .5, z - .17, 6.6, y0 + .55, z + .17, 'timber', { edges: 'fine' });
    // first floor: sofa, low table, bookcase
    p.box(-3.2, L2, -6.6, -1.0, L2 + .42, -5.7, 'fabric'); p.box(-3.2, L2 + .42, -6.6, -1.0, L2 + .85, -6.35, 'fabric');
    p.box(-2.6, L2, -4.8, -1.4, L2 + .4, -4.2, 'timber');
    p.box(1.0, L2, -7.85, 5.5, L2 + 2.2, -7.45, 'timber');
    for (const t of [.45, .9, 1.35, 1.8]) p.line(1.0, L2 + t, -7.448, 5.5, L2 + t, -7.448, true);
    for (const s of [2.5, 4.0]) p.line(s, L2, -7.448, s, L2 + 2.2, -7.448, true);
    p.box(4.6, L2, -3.2, 6.6, L2 + .75, -2.4, 'timber');                                // desk
    p.anchors.main = V(x1 - .3, L2 - .15, z1 + .1);
    p.anchors.facade = V(1.0, L2 + 1.2, z1 + .02);
  }

  // 5 · access walkway at first floor level, steel mesh railing H 1100
  {
    const p = P({ id: 'walkway', start: 3.45, dur: 1.1, el: L2, explode: V(0, 2.0, 3.2), view: { az: .55, el: .28 } });
    const x0 = -4, x1 = 12, z0 = 0.02, z1 = 1.6;
    p.box(x0, L2 - .2, z0, x1, L2, z1, 'deck');
    for (let z = z0 + .2; z < z1 - .05; z += .2) p.line(x0, L2, z, x1, L2, z, true);
    p.box(x0, L2 - .38, z1 - .02, x1, L2 - .2, z1 + .06, 'steel');                     // edge beam
    for (const x of [-3.7, 2, 7.7, 11.7]) p.box(x - .07, DECK, z1 - .22, x + .07, L2 - .38, z1 - .08, 'steel');
    railing(p, [V(x0, 0, z1 - .03), V(x1, 0, z1 - .03)], L2);
    railing(p, [V(x1 - .03, 0, z1 - .03), V(x1 - .03, 0, 1.42)], L2);
    railing(p, [V(x0 + .03, 0, z1 - .03), V(x0 + .03, 0, z0 + .05)], L2);
    p.anchors.main = V(-1.5, L2, z1);
    p.anchors.rail = V(5, L2 + 1.1, z1 - .03);
  }

  // 6 · steel stair from the walkway down to the deck
  {
    const p = P({ id: 'stair', start: 3.95, dur: 1.1, el: L2, explode: V(3.5, 1.4, 1.6), view: { az: .95, el: .32 } });
    const s = stair(p, 12.0, .22, 1.38, L2, DECK);
    p.box(11.9, L2 - .2, .22, 12.06, L2, 1.38, 'steel');
    p.anchors.main = V(14.6, (L2 + DECK) / 2 + .2, 1.4);
  }

  // 7 · penthouse module on the core roof
  {
    const p = P({ id: 'penthouse', start: 4.55, dur: 1.3, el: PH_TOP, explode: V(0, 6.0, 0), view: { az: .35, el: .32 } });
    const r = PH, [x0, z0, x1, z1] = r, y0 = ROOF, y1 = PH_TOP - .22;
    p.box(x0, y0, z0, x1, y0 + .1, z1, 'timber');
    for (const x of [x0, x0 + 1.75, x0 + 3.5, x0 + 5.25, x1]) for (const z of [z0, z1]) if (!(z === z1 && x === x0 + 3.5)) p.box(x - .07, y0 + .1, z - .07, x + .07, y1, z + .07, 'timber');
    for (const z of [z0 + 1.25, z0 + 2.5, z0 + 3.75]) for (const x of [x0, x1]) p.box(x - .07, y0 + .1, z - .07, x + .07, y1, z + .07, 'timber');
    const h = y1 - (y0 + .1);
    let f = side(r, 'front', y0 + .1); p.push(wallM(f));
    glaze(p, [.07, 1.75, 2.6], [0, 2.1, h], { tint: 'timber' }); slider(p, 2.6, 4.4, 0, 2.1, .55); glaze(p, [2.6, 4.4], [2.1, h], { tint: 'timber' }); glaze(p, [4.4, 5.25, f.len - .07], [0, 2.1, h], { tint: 'timber' });
    p.pop();
    f = side(r, 'right', y0 + .1); p.push(wallM(f)); glaze(p, range(.07, f.len - .07, 4), [0, 2.1, h], { tint: 'timber' }); p.pop();
    f = side(r, 'left', y0 + .1); p.push(wallM(f)); glaze(p, range(.07, f.len - .07, 4), [0, 2.1, h], { tint: 'timber' }); p.pop();
    f = side(r, 'back', y0 + .1); p.push(wallM(f)); clad(p, .07, f.len - .07, 0, h, .08, .16); p.pop();
    p.box(x0 - .35, y1, z0 - .35, x1 + .35, PH_TOP, z1 + .35, 'timber');               // roof with a deep fascia
    p.line(x0 - .35, y1 + .1, z1 + .353, x1 + .35, y1 + .1, z1 + .353, true);
    // inside: bed and armchair
    p.box(3.4, y0 + .1, -6.8, 5.6, y0 + .55, -5.0, 'fabric'); p.box(3.4, y0 + .55, -6.8, 5.6, y0 + 1.05, -6.6, 'timber');
    p.box(3.6, y0 + .55, -6.5, 4.4, y0 + .68, -6.1, 'paper', { edges: 'fine' }); p.box(4.6, y0 + .55, -6.5, 5.4, y0 + .68, -6.1, 'paper', { edges: 'fine' });
    p.box(-.6, y0 + .1, -6.6, .4, y0 + .5, -5.7, 'fabric'); p.box(-.6, y0 + .5, -6.6, .4, y0 + .95, -6.4, 'fabric');
    p.anchors.main = V(x1 + .35, PH_TOP - .1, z1 - 1.0);
    p.anchors.door = V(3.5, y0 + 1.2, z1 + .02);
  }

  // 8 · roof garden on the core roof: beds, terrace boards, mesh railing
  {
    const p = P({ id: 'garden', start: 5.25, dur: 1.2, el: ROOF, explode: V(0, 3.2, 0), view: { az: .2, el: .55 } });
    const [x0, z0, x1, z1] = CORE, y = ROOF;
    p.box(x0 - .25, y, z0 - .25, x1 + .25, y + .14, z0 - .1, 'concrete'); p.box(x0 - .25, y, z1 + .1, x1 + .25, y + .14, z1 + .25, 'concrete');
    p.box(x0 - .25, y, z0 - .1, x0 - .1, y + .14, z1 + .1, 'concrete'); p.box(x1 + .1, y, z0 - .1, x1 + .25, y + .14, z1 + .1, 'concrete');
    railing(p, [V(x0 - .17, 0, z1 + .17), V(x1 + .17, 0, z1 + .17), V(x1 + .17, 0, z0 - .17), V(x0 - .17, 0, z0 - .17), V(x0 - .17, 0, z1 + .17)], y + .14, 1.1);
    // planting beds west and east, timber faced
    const bed = (a, b, c, d) => {
      p.box(a, y, b, c, y + .42, d, 'timber');
      for (const t of [.14, .28]) { p.line(a, y + t, d + .003, c, y + t, d + .003, true); p.line(c + .003, y + t, b, c + .003, y + t, d, true); }
      p.box(a + .06, y + .42, b + .06, c - .06, y + .46, d - .06, 'soil', { edges: 'fine' });
      shrubs(p, a + .1, b + .1, c - .1, d - .1, y + .46, Math.round((c - a) * (d - b) * 1.6), R, .22, .48);
      grass(p, a + .15, b + .15, c - .15, d - .15, y + .46, Math.round((c - a) * (d - b) * 2.2), R);
    };
    bed(-3.8, -7.75, -1.7, -.4); bed(6.3, -7.75, 7.75, -3.2); bed(-1.4, -7.75, 6.0, -7.2);
    // terrace boards in front of the penthouse, two loungers and a bench
    p.box(-1.6, y, -1.85, 6.2, y + .06, -.3, 'deck');
    for (let x = -1.6 + .2; x < 6.2; x += .2) p.line(x, y + .06, -1.85, x, y + .06, -.3, true);
    for (const x of [-.8, .6]) { p.box(x, y + .06, -1.6, x + .7, y + .32, -.5, 'fabric'); p.member(V(x, y + .32, -1.6), V(x + .7, y + .75, -1.75), .02, .02, 'timber', { edges: 'fine' }); }
    p.box(3.8, y + .06, -.75, 5.8, y + .46, -.45, 'timber');
    p.anchors.main = V(-2.8, y + .9, -2.2);
    p.anchors.rail = V(7.0, y + 1.25, z1 + .17);
  }

  // 9 · rooftop pergola: slats on beams above the penthouse
  {
    const p = P({ id: 'rpergola', start: 5.75, dur: 1.1, el: RP_TOP, explode: V(0, 8.6, 0), view: { az: .3, el: .5 } });
    const x0 = -1.5, x1 = 6.5, z0 = -7.5, z1 = -1.5, yb = PH_TOP, yt = RP_TOP;
    for (const x of [x0, 2.5, x1]) for (const z of [z0, z1]) p.box(x - .07, yb, z - .07, x + .07, yt - .36, z + .07, 'timber');
    for (const z of [z0, z1]) p.box(x0 - .3, yt - .36, z - .08, x1 + .3, yt - .18, z + .08, 'timber');
    for (const x of [x0, x1]) p.box(x - .07, yt - .36, z0 - .1, x + .07, yt - .2, z1 + .1, 'timber', { edges: 'fine' });
    for (let x = x0 - .2; x <= x1 + .21; x += .32) p.box(x - .028, yt - .18, z0 - .45, x + .028, yt, z1 + .45, 'timber', { edges: true, noEdge: [0, 4] });
    p.anchors.main = V(x0 + 1.2, yt, z1 + .45);
  }

  // 10 · solar array on the east half of the rooftop pergola
  {
    const p = P({ id: 'solar', start: 6.25, dur: 1.0, el: RP_TOP + .4, explode: V(0, 10.8, 0), view: { az: .25, el: .62 } });
    const tilt = -.16;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const cx = 2.95 + i * 1.12, cz = -6.4 + j * 2.0, w = 1.04, l = 1.72;
      p.push(new THREE.Matrix4().makeTranslation(cx, RP_TOP + .14, cz).multiply(new THREE.Matrix4().makeRotationX(-tilt)));
      p.box(-w / 2, 0, -l / 2, w / 2, .045, l / 2, 'solar');
      for (let k = 1; k < 4; k++) p.line(-w / 2 + w * k / 4, .047, -l / 2 + .02, -w / 2 + w * k / 4, .047, l / 2 - .02, true);
      for (let k = 1; k < 6; k++) p.line(-w / 2 + .02, .047, -l / 2 + l * k / 6, w / 2 - .02, .047, -l / 2 + l * k / 6, true);
      p.pop();
    }
    for (const z of [-7.15, -5.65, -5.15, -3.65]) p.box(2.35, RP_TOP, z - .025, 6.25, RP_TOP + .1, z + .025, 'steel', { edges: 'fine' });
    p.anchors.main = V(6.1, RP_TOP + .35, -4.4);
  }

  // 11 · timber pergola on a steel frame, over the kiosk and the tables
  {
    const p = P({ id: 'pergola', start: 6.75, dur: 1.3, el: PG_TOP, explode: V(-1.0, 5.0, 2.0), view: { az: -.6, el: .3 } });
    const x0 = -18.6, x1 = -6.4, z0 = -1.6, z1 = 8.4, y = DECK, top = PG_TOP;
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {   // timber corner posts 200 x 200 on steel shoes
      p.box(x - .1, y + .25, z - .1, x + .1, top - .3, z + .1, 'timber');
      p.box(x - .13, y, z - .13, x + .13, y + .25, z + .13, 'steel', { edges: 'fine' });
      for (let t = y + .6; t < top - .4; t += .45) p.line(x - .1, t, z + .101, x + .1, t, z + .101, true);
    }
    for (const x of [-14.5, -10.5]) for (const z of [z0, z1]) p.box(x - .06, y, z - .06, x + .06, top - .3, z + .06, 'steel');
    // steel edge beams (I-section) around the top
    const ibeam = (a, b, alongX) => {
      if (alongX) {
        p.box(a[0], top - .3, a[1] - .06, b[0], top, a[1] + .06, 'steel');
        p.line(a[0], top - .045, a[1] + .062, b[0], top - .045, a[1] + .062, true); p.line(a[0], top - .255, a[1] + .062, b[0], top - .255, a[1] + .062, true);
      } else {
        p.box(a[0] - .06, top - .3, a[1], a[0] + .06, top, b[1], 'steel');
        p.line(a[0] + .062, top - .045, a[1], a[0] + .062, top - .045, b[1], true); p.line(a[0] + .062, top - .255, a[1], a[0] + .062, top - .255, b[1], true);
      }
    };
    ibeam([x0 - .1, z0], [x1 + .1, z0], true); ibeam([x0 - .1, z1], [x1 + .1, z1], true);
    ibeam([x0, z0], [x0, z1], false); ibeam([x1, z0], [x1, z1], false); ibeam([-12.5, z0], [-12.5, z1], false);
    // timber rafters
    for (let x = x0 + .1; x <= x1 - .05; x += .5) p.box(x - .03, top, z0 - .35, x + .03, top + .18, z1 + .35, 'timber', { edges: true, noEdge: [0, 4] });
    for (const z of [z0 + 2.5, z0 + 5, z0 + 7.5]) p.box(x0 - .2, top + .18, z - .025, x1 + .2, top + .23, z + .025, 'timber', { edges: 'fine' });
    p.anchors.main = V(x1 + .1, top, z1 - 2.0);
    p.anchors.post = V(x1, y + 1.6, z1 + .1);
  }

  // 12 · glazed pavilion, front right, with a sliding glass door
  {
    const p = P({ id: 'pavilion', start: 7.25, dur: 1.3, el: DECK + 3.0, explode: V(3.0, 1.6, 3.2), view: { az: .62, el: .22 } });
    const r = PAV, [x0, z0, x1, z1] = r, y0 = DECK, y1 = y0 + 2.75;
    p.box(x0, y0, z0, x1, y0 + .12, z1, 'concrete');
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) p.box(x - .1, y0, z - .1, x + .1, y1, z + .1, 'steel');
    const h = y1 - (y0 + .12);
    let f = side(r, 'back', y0 + .12); p.push(wallM(f)); clad(p, .1, f.len - .1, 0, h); p.pop();
    f = side(r, 'left', y0 + .12); p.push(wallM(f)); clad(p, .1, f.len - .1, 0, h); p.pop();
    f = side(r, 'front', y0 + .12); p.push(wallM(f));
    glaze(p, [.1, 1.6, 3.1], [0, 2.25, h]); slider(p, 3.1, 5.9, 0, 2.25, .62); glaze(p, [3.1, 5.9], [2.25, h]); glaze(p, [5.9, 7.4, f.len - .1], [0, 2.25, h]);
    p.pop();
    f = side(r, 'right', y0 + .12); p.push(wallM(f)); glaze(p, range(.1, f.len - .1, 4), [0, 2.25, h]); p.pop();
    p.box(x0 - .3, y1, z0 - .3, x1 + .3, y1 + .28, z1 + .6, 'deck');                    // boarded roof, deeper over the front
    p.line(x0 - .3, y1 + .14, z1 + .603, x1 + .3, y1 + .14, z1 + .603, true);
    for (let x = x0 + .4; x < x1 - .2; x += .45) p.line(x, y1 + .282, z0 - .2, x, y1 + .282, z1 + .5, true);
    // inside: café counter and three small tables with stools
    p.box(x0 + .6, y0 + .12, z0 + .25, x0 + 5.6, y0 + 1.05, z0 + .85, 'timber');
    p.box(x0 + .5, y0 + 1.05, z0 + .2, x0 + 5.7, y0 + 1.1, z0 + .9, 'paper', { edges: 'fine' });
    for (const [tx, tz] of [[x0 + 2.2, 6.6], [x0 + 4.6, 7.6], [x0 + 6.9, 6.2]]) {
      p.box(tx - .4, y0 + .72, tz - .4, tx + .4, y0 + .76, tz + .4, 'timber');
      p.box(tx - .03, y0 + .12, tz - .03, tx + .03, y0 + .72, tz + .03, 'steel', { edges: 'fine' });
      for (const [a, b] of [[-.65, 0], [.65, 0], [0, .65]]) p.box(tx + a - .17, y0 + .12, tz + b - .17, tx + a + .17, y0 + .46, tz + b + .17, 'fabric', { edges: 'fine' });
    }
    p.anchors.main = V(x1 + .1, y0 + 1.6, z1 - 1.6);
    p.anchors.door = V(x0 + 4.5, y0 + 1.3, z1 + .05);
  }

  // 13 · landscape: trees in deck openings and on the ground, planter boxes, picnic tables
  {
    const p = P({ id: 'landscape', big: true, planting: true, start: 7.85, dur: 1.5, el: DECK, explode: V(0, 0, 0), view: { az: -.25, el: .3 } });
    tree(p, -12, DECK, 9, 8.2, 3.0, R);
    tree(p, -2.6, DECK, 6.4, 7.0, 2.4, R);
    tree(p, 18.0, DECK, 9.0, 7.0, 2.4, R);
    tree(p, -24, 0, -5, 9.0, 3.3, R, false);
    tree(p, -23, 0, 6.8, 7.0, 2.7, R, false);
    tree(p, -9, 0, -14.2, 10.0, 3.6, R, false);
    tree(p, 3.5, 0, -14.4, 9.2, 3.3, R, false);
    tree(p, 16, 0, -13.8, 8.4, 3.0, R, false);
    tree(p, 24.6, 0, -5.5, 8.0, 2.9, R, false);
    tree(p, 25, 0, 4.8, 6.6, 2.5, R, false);
    planter(p, -19.6, -8.4, -18.9, -5.6, DECK, .55, R);
    planter(p, -19.6, -3.0, -18.9, -.2, DECK, .55, R);
    planter(p, 19.0, -9.6, 19.7, -6.4, DECK, .55, R);
    planter(p, 19.0, -1.6, 19.7, 1.6, DECK, .55, R);
    planter(p, 2.0, 10.1, 5.2, 10.7, DECK, .55, R);
    planter(p, -7.8, 10.1, -4.6, 10.7, DECK, .55, R);
    picnic(p, -15.2, 5.9, 0); picnic(p, -9.4, 5.6, 0); picnic(p, -14.0, -.1, 0);
    picnic(p, 2.4, 5.2, Math.PI / 2); picnic(p, 17.4, 3.4, Math.PI / 2);
    // benches along the walkway posts
    p.box(-3.2, DECK, 3.0, -.4, DECK + .45, 3.4, 'timber');
    p.anchors.main = V(-12, DECK + 5.4, 9);
    p.anchors.planter = V(3.6, DECK + .55, 10.7);
    p.anchors.opening = V(-2.6, DECK + .14, 7.4);
  }

  return parts;
}

// callouts: which anchor, which label key, shown at the overview or only when the part is in focus
export const CALLOUTS = [
  { part: 'rpergola', a: 'main', k: 'rpergola', el: '+10.45', o: true },
  { part: 'solar', a: 'main', k: 'solar', o: true },
  { part: 'garden', a: 'main', k: 'garden', el: '+6.91', o: true },
  { part: 'penthouse', a: 'main', k: 'penthouse', el: '+9.31', o: true },
  { part: 'pavilion', a: 'door', k: 'slider', o: false },
  { part: 'walkway', a: 'main', k: 'walkway', el: '+3.73', o: true },
  { part: 'stair', a: 'main', k: 'stair', o: true },
  { part: 'deck', a: 'main', k: 'deck', el: '+0.45', o: true },
  { part: 'pavilion', a: 'main', k: 'pavilion', o: true },
  { part: 'kiosk', a: 'sheet', k: 'sheet', o: false },
  { part: 'walkway', a: 'rail', k: 'rail', el: 'H 1100', o: false },
  { part: 'landscape', a: 'planter', k: 'planter', o: false },
  { part: 'pergola', a: 'post', k: 'post', el: '200 × 200', o: false },
  { part: 'pergola', a: 'main', k: 'pergola', el: '+3.46', o: true },
  { part: 'landscape', a: 'opening', k: 'opening', o: false },
  { part: 'deck', a: 'steps', k: 'steps', o: false },
  { part: 'studio', a: 'main', k: 'studio', el: '+3.75', o: true },
  { part: 'core', a: 'main', k: 'core', el: '+6.91', o: false },
  { part: 'kiosk', a: 'main', k: 'kiosk', o: true },
  { part: 'penthouse', a: 'door', k: 'slider', o: false },
  { part: 'garden', a: 'rail', k: 'rail', el: 'H 1100', o: false },
  { part: 'studio', a: 'roof', k: 'greenroof', o: false },
  { part: 'core', a: 'facade', k: 'facade', o: false },
];

// Part data: code, elevation and the inspector rows.
export const ORDER = ['deck', 'studio', 'kiosk', 'core', 'walkway', 'stair', 'penthouse', 'garden', 'rpergola', 'solar', 'pergola', 'pavilion', 'landscape'];

export const PART = {
  deck:      { code: 'BT-01', el: '+0.45', mass: 41.0, qty: 2940 },
  studio:    { code: 'BT-02', el: '+3.75', mass: 14.2, qty: 1 },
  kiosk:     { code: 'BT-03', el: '+3.05', mass: 4.1, qty: 1 },
  core:      { code: 'BT-04', el: '+6.91', mass: 96.0, qty: 38 },
  walkway:   { code: 'BT-05', el: '+3.73', mass: 3.8, qty: 4 },
  stair:     { code: 'BT-06', el: '+3.73', mass: 1.6, qty: 19 },
  penthouse: { code: 'BT-07', el: '+9.31', mass: 9.4, qty: 1 },
  garden:    { code: 'BT-08', el: '+6.91', mass: 18.0, qty: 41 },
  rpergola:  { code: 'BT-09', el: '+10.45', mass: 1.9, qty: 26 },
  solar:     { code: 'BT-10', el: '+10.59', mass: .15, qty: 6 },
  pergola:   { code: 'BT-11', el: '+3.46', mass: 6.2, qty: 8 },
  pavilion:  { code: 'BT-12', el: '+3.20', mass: 12.5, qty: 1 },
  landscape: { code: 'BT-13', el: '+0.45', mass: 0, qty: 10 },
};

export const LEVELS = [
  { v: 0, k: 'ground' }, { v: .45, k: 'deck' }, { v: 3.46, k: 'pergola' }, { v: 3.73, k: 'walkway' },
  { v: 6.91, k: 'garden' }, { v: 9.31, k: 'penthouse' }, { v: 10.45, k: 'rpergola' },
];


export const TEXT = {
  en: {
    ui: { title: 'deck house', sub: 'Timber deck, container modules and a glazed core, raised part by part.', drawingV: 'deck house · axonometric' },
    stats: [['deck area', '880 m²'], ['mass', '209 t'], ['modules', '4 · 13 parts']],
    name: {
      deck: 'Wooden deck', studio: 'Studio module', kiosk: 'Container kiosk', core: 'Central block', walkway: 'Access walkway',
      stair: 'Steel stair', penthouse: 'Penthouse module', garden: 'Roof garden', rpergola: 'Rooftop pergola', solar: 'Solar array',
      pergola: 'Timber pergola', pavilion: 'Glazed pavilion', landscape: 'Trees and planters', site: 'Site',
    },
    co: {
      rpergola: 'Rooftop pergola', solar: 'Solar array', garden: 'Roof garden', penthouse: 'Penthouse module', slider: 'Sliding glass door',
      walkway: 'Access walkway', stair: 'Steel stair', deck: 'Wooden deck', pavilion: 'Glazed pavilion', sheet: 'Corrugated metal sheet',
      rail: 'Steel mesh railing', planter: 'Planter box · wood finish', post: 'Timber corner post', pergola: 'Wooden pergola · steel frame',
      opening: 'Tree planter / deck opening', steps: 'Wooden steps', studio: 'Studio module', core: 'Central block', kiosk: 'Container kiosk',
      greenroof: 'Green roof · sedum', facade: 'Curtain wall · 1.5 m bays',
    },
    lv: { ground: 'ground', deck: 'deck', pergola: 'pergola', walkway: 'first floor', garden: 'roof garden', penthouse: 'penthouse', rpergola: 'top' },
    info: {
      deck: { size: '40.0 × 22.0 m', mat: 'thermo-ash boards on a steel frame', trade: 'carpentry', qty: '2 940 boards', note: 'Raised 450 mm on screw piles in a 2.5 m grid. Three trees grow through it.' },
      studio: { size: '9.0 × 6.0 × 3.0 m', mat: 'steel frame, corrugated sheet, double glazing', trade: 'modular', qty: '1 module · 54 m²', note: 'A green roof of sedum and shrubs sits behind a low parapet.' },
      kiosk: { size: '6.0 × 2.6 × 2.6 m', mat: 'corrugated steel, timber counter', trade: 'modular', qty: '1 container', note: 'The hatch opens up as an awning on two steel stays.' },
      core: { size: '12.0 × 8.0 m · 2 floors', mat: 'steel frame, CLT slabs, curtain wall', trade: 'steel and glazing', qty: '38 glass panes', note: 'Glazed to the south and east, clad in corrugated sheet to the north and west.' },
      walkway: { size: '16.0 × 1.6 m', mat: 'steel edge beam, timber boards', trade: 'steel', qty: '4 posts', note: 'Runs along the first floor; steel mesh railing H 1100.' },
      stair: { size: '5.3 × 1.2 m', mat: 'steel stringers and treads', trade: 'steel', qty: '19 risers × 173 mm', note: 'Going 280 mm, handrail at 1000 mm on both sides.' },
      penthouse: { size: '7.0 × 5.0 × 2.4 m', mat: 'timber frame, triple glazing', trade: 'carpentry and glazing', qty: '1 module · 35 m²', note: 'Opens onto the roof terrace through a sliding glass door.' },
      garden: { size: '12.0 × 8.0 m', mat: 'planters 420 mm, terrace boards', trade: 'landscape', qty: '3 beds · 41 shrubs', note: 'Drainage mat and root barrier over the roof slab; mesh railing H 1100.' },
      rpergola: { size: '8.0 × 6.0 m', mat: 'larch slats 56 × 180 at 320 mm', trade: 'carpentry', qty: '26 slats', note: 'Shades the penthouse and carries the solar array.' },
      solar: { size: '6 × 1.04 × 1.72 m', mat: 'monocrystalline panels, 9° tilt', trade: 'electrical', qty: '6 × 430 W = 2.6 kWp', note: 'On rails over the east half of the rooftop pergola.' },
      pergola: { size: '12.2 × 10.0 m', mat: 'steel I-beams, larch rafters at 500 mm', trade: 'steel and carpentry', qty: '4 timber posts 200 × 200', note: 'Shades the kiosk and the picnic tables.' },
      pavilion: { size: '9.0 × 6.0 × 2.75 m', mat: 'steel frame, glazing, corrugated back', trade: 'glazing', qty: '1 café · 54 m²', note: 'Two-leaf sliding glass door with a 2.8 m clear opening.' },
      landscape: { size: 'site 54 × 34 m', mat: 'deck openings, timber planters', trade: 'landscape', qty: '10 trees · 6 planters', note: 'Five picnic tables; three trees grow through the deck.' },
    },
  },
  ru: {
    ui: { title: 'дом на настиле', sub: 'Настил, модули-контейнеры и стеклянный корпус, по частям.', drawingV: 'дом на настиле · аксонометрия' },
    stats: [['площадь настила', '880 м²'], ['масса', '209 т'], ['модули', '4 · 13 части']],
    name: {
      deck: 'Деревянный настил', studio: 'Модуль-студия', kiosk: 'Контейнер-киоск', core: 'Центральный корпус', walkway: 'Галерея доступа',
      stair: 'Стальная лестница', penthouse: 'Модуль пентхауса', garden: 'Сад на крыше', rpergola: 'Пергола на крыше', solar: 'Солнечные панели',
      pergola: 'Деревянная пергола', pavilion: 'Стеклянный павильон', landscape: 'Деревья и кашпо', site: 'Участок',
    },
    co: {
      rpergola: 'Пергола на крыше', solar: 'Солнечные панели', garden: 'Сад на крыше', penthouse: 'Модуль пентхауса', slider: 'Раздвижная стеклянная дверь',
      walkway: 'Галерея доступа', stair: 'Стальная лестница', deck: 'Деревянный настил', pavilion: 'Стеклянный павильон', sheet: 'Профилированный лист',
      rail: 'Сетчатое ограждение', planter: 'Кашпо · отделка деревом', post: 'Угловая стойка', pergola: 'Пергола · стальной каркас',
      opening: 'Лунка для дерева в настиле', steps: 'Деревянные ступени', studio: 'Модуль-студия', core: 'Центральный корпус', kiosk: 'Контейнер-киоск',
      greenroof: 'Зелёная кровля · седум', facade: 'Витраж · шаг 1,5 м',
    },
    lv: { ground: 'земля', deck: 'настил', pergola: 'пергола', walkway: '2 этаж', garden: 'сад на крыше', penthouse: 'пентхаус', rpergola: 'верх' },
    info: {
      deck: { size: '40,0 × 22,0 м', mat: 'термоясень на стальном каркасе', trade: 'плотницкие', qty: '2 940 досок', note: 'Поднят на 450 мм на винтовых сваях с шагом 2,5 м. Сквозь него растут три дерева.' },
      studio: { size: '9,0 × 6,0 × 3,0 м', mat: 'стальной каркас, профлист, стеклопакеты', trade: 'модульные', qty: '1 модуль · 54 м²', note: 'Зелёная кровля из седума и кустарников за низким парапетом.' },
      kiosk: { size: '6,0 × 2,6 × 2,6 м', mat: 'профилированная сталь, деревянная стойка', trade: 'модульные', qty: '1 контейнер', note: 'Окно выдачи поднимается козырьком на двух стальных упорах.' },
      core: { size: '12,0 × 8,0 м · 2 этажа', mat: 'стальной каркас, CLT-перекрытия, витраж', trade: 'металл и остекление', qty: '38 стёкол', note: 'Остеклён на юг и восток, на север и запад обшит профлистом.' },
      walkway: { size: '16,0 × 1,6 м', mat: 'стальная балка, деревянный настил', trade: 'металл', qty: '4 стойки', note: 'Идёт вдоль второго этажа; сетчатое ограждение H 1100.' },
      stair: { size: '5,3 × 1,2 м', mat: 'стальные косоуры и ступени', trade: 'металл', qty: '19 подъёмов × 173 мм', note: 'Проступь 280 мм, поручень 1000 мм с двух сторон.' },
      penthouse: { size: '7,0 × 5,0 × 2,4 м', mat: 'деревянный каркас, тройное остекление', trade: 'плотницкие и остекление', qty: '1 модуль · 35 м²', note: 'Выходит на террасу на крыше через раздвижную дверь.' },
      garden: { size: '12,0 × 8,0 м', mat: 'кашпо 420 мм, террасная доска', trade: 'озеленение', qty: '3 гряды · 41 куст', note: 'Дренажный мат и корнезащита поверх плиты; ограждение H 1100.' },
      rpergola: { size: '8,0 × 6,0 м', mat: 'ламели из лиственницы 56 × 180 с шагом 320', trade: 'плотницкие', qty: '26 ламелей', note: 'Затеняет пентхаус и несёт солнечные панели.' },
      solar: { size: '6 × 1,04 × 1,72 м', mat: 'монокристаллические панели, наклон 9°', trade: 'электрика', qty: '6 × 430 Вт = 2,6 кВт', note: 'На рейках над восточной половиной перголы.' },
      pergola: { size: '12,2 × 10,0 м', mat: 'стальные двутавры, стропила из лиственницы с шагом 500', trade: 'металл и плотницкие', qty: '4 стойки 200 × 200', note: 'Даёт тень киоску и столам для пикника.' },
      pavilion: { size: '9,0 × 6,0 × 2,75 м', mat: 'стальной каркас, остекление, профлист', trade: 'остекление', qty: '1 кафе · 54 м²', note: 'Двухстворчатая раздвижная дверь, проём 2,8 м.' },
      landscape: { size: 'участок 54 × 34 м', mat: 'лунки в настиле, деревянные кашпо', trade: 'озеленение', qty: '10 деревьев · 6 кашпо', note: 'Пять столов для пикника; три дерева растут сквозь настил.' },
    },
  },
};
