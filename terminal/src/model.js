// Turns the kit's parts into three.js objects: per part a group with paper fills, glass, ink, fine
// hatch and camera-facing outlines for the round foliage. Also builds the foliage strokes and the
// draw-on order of every segment.
import * as THREE from 'three';
import { inkMaterial, fillMaterial, glassMaterial, lineGeometry } from './ink.js';
import { rng } from './kit.js';
import { solidMaterial } from './paint.js';
import { MATS } from './kit.js';

const RING_SEG = 30;
const sphereGeo = new THREE.IcosahedronGeometry(1, 3);
// foliage lobes for the painted model: smooth balls, finer for the big ones
const lobeGeo = [new THREE.IcosahedronGeometry(1, 1), new THREE.IcosahedronGeometry(1, 2), new THREE.IcosahedronGeometry(1, 3)];

function seqFor(arr, box, rand, base = 0, span = 1) {
  const n = arr.length / 6, seq = new Float32Array(n);
  const sz = new THREE.Vector3(); box.getSize(sz);
  const hy = Math.max(sz.y, .5), hx = Math.max(sz.x, sz.z, .5);
  const alongX = sz.x >= sz.z;
  for (let i = 0; i < n; i++) {
    const k = i * 6;
    const my = (arr[k + 1] + arr[k + 4]) / 2, mx = (arr[k] + arr[k + 3]) / 2, mz = (arr[k + 2] + arr[k + 5]) / 2;
    const yn = (my - box.min.y) / hy;
    const hn = alongX ? (mx - box.min.x) / hx : (box.max.z - mz) / hx;
    seq[i] = base + span * Math.min(1, Math.max(0, .58 * yn + .3 * hn + .12 * rand()));
  }
  return seq;
}

// foliage: a few curved strokes lying on each ball, like leaf clusters drawn with a pen
function foliageStrokes(p, rand) {
  const out = [];
  for (const s of p.spheres) {
    const k = s.r > .9 ? 4 : s.r > .45 ? 3 : 2;
    for (let i = 0; i < k; i++) {
      // a small circle on the sphere: centre direction biased upward and toward the front
      const th = rand() * Math.PI * 2, ph = .35 + rand() * .9;
      const c = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      const a = .28 + rand() * .22;                    // angular radius of the small circle
      const t1 = new THREE.Vector3().crossVectors(c, Math.abs(c.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      const t2 = new THREE.Vector3().crossVectors(c, t1);
      const a0 = rand() * Math.PI * 2, a1 = a0 + Math.PI * (.55 + rand() * .45);
      const N = 7; let prev = null;
      for (let j = 0; j <= N; j++) {
        const t = a0 + (a1 - a0) * j / N;
        const d = c.clone().multiplyScalar(Math.cos(a)).addScaledVector(t1, Math.sin(a) * Math.cos(t)).addScaledVector(t2, Math.sin(a) * Math.sin(t));
        const q = s.c.clone().addScaledVector(d, s.r * 1.006);
        if (prev) out.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
        prev = q;
      }
    }
  }
  return out;
}

export function compile(parts, scene) {
  const rand = rng(77);
  const objs = [];
  for (const p of parts) {
    const g = new THREE.Group(); g.name = p.id;
    const o = { part: p, group: g, mats: [], rings: null, box: new THREE.Box3(), pick: [] };
    // fills, including the foliage balls
    const fp = p.fp.slice(), fn = p.fn.slice(), fc = p.fc.slice();
    const sp = sphereGeo.attributes.position, sn = sphereGeo.attributes.normal, si = sphereGeo.index;
    for (const s of p.spheres) {
      const cnt = si ? si.count : sp.count;
      for (let i = 0; i < cnt; i++) {
        const j = si ? si.getX(i) : i;
        fp.push(s.c.x + sp.getX(j) * s.r, s.c.y + sp.getY(j) * s.r, s.c.z + sp.getZ(j) * s.r);
        fn.push(sn.getX(j), sn.getY(j), sn.getZ(j));
        fc.push(s.tint[0], s.tint[1], s.tint[2]);
      }
    }
    if (fp.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      o.box.copy(geo.boundingBox);
      const m = fillMaterial(); const mesh = new THREE.Mesh(geo, m);
      mesh.renderOrder = 0; mesh.userData.part = p.id; g.add(mesh);
      o.fill = mesh; o.pick.push(mesh); o.mats.push(m);
    }
    // the painted model: the same solids with material ids, toned and shadowed; foliage as round lobes that grow
    if ((p.fp.length || p.spheres.length) && !p.mono) {
      const pos = p.fp.slice(), nor = p.fn.slice(), mat = p.fm.slice(), ag = new Array(p.fp.length / 3 * 4).fill(-1);
      const n0 = p.fp.length / 3;
      // each lobe: a growth threshold from low to high and a little at random, so a crown fills in from its trunk up
      const ys = p.spheres.map((q) => q.c.y), y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 1);
      for (const q of p.spheres) {
        const geo = lobeGeo[q.r > 1.4 ? 2 : q.r > .45 ? 1 : 0], gp = geo.attributes.position, gi = geo.index;
        const cnt = gi ? gi.count : gp.count, id = Math.max(0, MATS.indexOf(q.mat));
        const t = Math.min(.95, .7 * (q.c.y - y0) / Math.max(.1, y1 - y0) + .25 * rand());
        for (let i = 0; i < cnt; i++) {
          const j = gi ? gi.getX(i) : i, x = gp.getX(j), y = gp.getY(j), z = gp.getZ(j);
          // a lobe sits a little flattened underneath, like a drawn canopy
          const yy = y < 0 ? y * .82 : y;
          pos.push(q.c.x + x * q.r, q.c.y + yy * q.r, q.c.z + z * q.r);
          nor.push(x, y, z); mat.push(id); ag.push(q.c.x, q.c.y, q.c.z, t);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('mat', new THREE.Float32BufferAttribute(mat, 1));
      geo.setAttribute('aG', new THREE.Float32BufferAttribute(ag, 4));
      geo.computeBoundingSphere();
      const m = solidMaterial(); const mesh = new THREE.Mesh(geo, m);
      mesh.customDepthMaterial = m.userData.depth;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.renderOrder = 0; mesh.userData.part = p.id;
      mesh.layers.enable(1);                    // drawn again in the normal pass that finds the outlines
      g.add(mesh); o.solid = mesh; o.lobes = p.spheres.length > 0 && n0 >= 0;
    }
    if (p.gp.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p.gp, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.gn, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(p.gp.length).fill(1), 3));
      const m = glassMaterial(); const mesh = new THREE.Mesh(geo, m);
      mesh.renderOrder = 2; mesh.userData.part = p.id; g.add(mesh);
      o.glass = mesh; o.pick.push(mesh);
    }
    if (o.box.isEmpty()) {
      const b = new THREE.Box3();
      for (let i = 0; i < p.ink.length; i += 3) b.expandByPoint(new THREE.Vector3(p.ink[i], p.ink[i + 1], p.ink[i + 2]));
      o.box.copy(b);
    }
    const fine = p.fine;
    const leafArcs = foliageStrokes(p, rand);
    const mk = (arr, opt, base, span) => {
      if (!arr.length) return null;
      const a = new Float32Array(arr);
      const geo = lineGeometry(a, seqFor(a, o.box, rand, base, span));
      const m = inkMaterial({ ...opt, mono: p.mono ? 1 : 0 });
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 1; g.add(mesh);
      return mesh;
    };
    o.ink = mk(p.ink, { width: 1.35, opacity: 1, colA: p.mono ? .9 : .66 }, 0, .82);
    o.fine = mk(fine, { width: .85, opacity: .62, colA: p.mono ? .8 : p.faint ? .3 : .55, fine: true }, .18, .82);
    o.arcs = mk(leafArcs, { width: .85, opacity: .62, colA: 0 }, .18, .82);
    if (p.mono && o.ink) { o.ink.material.uniforms.opacity.value = .5; o.ink.material.uniforms.linewidth.value = 1; }
    if (p.mono && o.fine) { o.fine.material.uniforms.opacity.value = .22; }
    // camera-facing outlines of the foliage balls, rebuilt each frame
    if (p.spheres.length) {
      const n = p.spheres.length * RING_SEG;
      const arr = new Float32Array(n * 6);
      const geo = lineGeometry(arr, new Float32Array(n));
      const m = inkMaterial({ width: 1.2, opacity: 1, colA: 0 });
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 1; g.add(mesh);
      o.rings = mesh; o.ringArr = arr;
    }
    // points on the part's own drawn edges, used to test what stands in front of it
    o.samples = [];
    { const a = p.ink, n = a.length / 6, step = Math.max(1, Math.floor(n / 32));
      for (let i = (step >> 1); i < n && o.samples.length < 32; i += step) { const k = i * 6; o.samples.push(new THREE.Vector3((a[k] + a[k + 3]) / 2, (a[k + 1] + a[k + 4]) / 2, (a[k + 2] + a[k + 5]) / 2)); } }
    o.inkMats = [o.ink, o.fine, o.rings, o.arcs].filter(Boolean).map((x) => x.material);
    o.base = { ink: o.ink?.material.uniforms.opacity.value ?? 1, fine: o.fine?.material.uniforms.opacity.value ?? 1, ring: 1,
      wInk: o.ink?.material.uniforms.linewidth.value ?? 1.35, wFine: o.fine?.material.uniforms.linewidth.value ?? .85 };
    o.size = o.box.getSize(new THREE.Vector3()); o.center = o.box.getCenter(new THREE.Vector3());
    // what the part is made of: surface area per material (trunks and both leaf greens count as planting)
    if (!p.mono) {
      const area = {}, add = (k, a) => { if (k === 'leaf2' || k === 'bark' || k === 'leaf') k = 'planting'; area[k] = (area[k] || 0) + a; };
      const triA = (a, i) => { const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], uz = a[i + 5] - a[i + 2], vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], vz = a[i + 8] - a[i + 2];
        return .5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); };
      for (let i = 0; i + 8 < p.fp.length; i += 9) add(MATS[p.fm[i / 3]] || 'paper', triA(p.fp, i));
      for (const q of p.spheres) add(q.mat, 2 * Math.PI * q.r * q.r);
      for (let i = 0; i + 8 < p.gp.length; i += 9) add('glass', triA(p.gp, i) * .5);   // panes are drawn both ways
      o.matArea = area;
    }
    scene.add(g); objs.push(o);
  }
  return objs;
}

const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
// orient the foliage outlines to the camera: a circle just in front of each ball
export function updateRings(objs, camera) {
  _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1);
  for (const o of objs) {
    if (!o.rings || !o.group.visible) continue;
    const arr = o.ringArr, gp = o.group.position;
    let k = 0;
    for (const s of o.part.spheres) {
      _c.copy(s.c).add(gp);
      _d.subVectors(camera.position, _c); const dist = _d.length(); _d.multiplyScalar(1 / dist);
      const lift = s.r * .35, rr = s.r * (dist - lift) / dist;
      const cx = s.c.x + _d.x * lift, cy = s.c.y + _d.y * lift, cz = s.c.z + _d.z * lift;
      for (let i = 0; i < RING_SEG; i++) {
        const a0 = i / RING_SEG * Math.PI * 2, a1 = (i + 1) / RING_SEG * Math.PI * 2;
        const c0 = Math.cos(a0) * rr, s0 = Math.sin(a0) * rr, c1 = Math.cos(a1) * rr, s1 = Math.sin(a1) * rr;
        arr[k++] = cx + _r.x * c0 + _u.x * s0; arr[k++] = cy + _r.y * c0 + _u.y * s0; arr[k++] = cz + _r.z * c0 + _u.z * s0;
        arr[k++] = cx + _r.x * c1 + _u.x * s1; arr[k++] = cy + _r.y * c1 + _u.y * s1; arr[k++] = cz + _r.z * c1 + _u.z * s1;
      }
    }
    const ib = o.rings.geometry.attributes.instanceStart.data;
    ib.needsUpdate = true;
  }
}
