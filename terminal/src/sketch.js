// The two small drawings on the inspector card, made from the model itself: a front elevation (seen from +z)
// and a key plan (seen from above). Every part's fills are rasterised on a fine grid in that view and the grid
// is written back as rectangles; foliage balls become circles. Any model gets them without drawing anything.

const fmt = (v) => +v.toFixed(2);

function rasterise(part, ax, ay, flipY, box, cell) {
  const nx = Math.ceil((box.x1 - box.x0) / cell), ny = Math.ceil((box.y1 - box.y0) / cell);
  const g = new Uint8Array(nx * ny);
  const P = part.fp;
  const X = (i) => (P[i + ax] - box.x0) / cell;
  const Y = (i) => ((flipY ? -P[i + ay] : P[i + ay]) - box.y0) / cell;
  for (let t = 0; t < P.length; t += 9) {
    const x0 = X(t), y0 = Y(t), x1 = X(t + 3), y1 = Y(t + 3), x2 = X(t + 6), y2 = Y(t + 6);
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const i0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), i1 = Math.min(nx - 1, Math.ceil(Math.max(x0, x1, x2)));
    const j0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), j1 = Math.min(ny - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (Math.abs(area) < 1e-6) {   // seen edge on: a wall face in plan, a slab in elevation; mark the line it makes
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(x2 - x0), Math.abs(y2 - y0)) * 2) + 1;
      for (const [ax2, ay2, bx, by] of [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]])
        for (let k = 0; k <= n; k++) { const i = Math.floor(ax2 + (bx - ax2) * k / n), j = Math.floor(ay2 + (by - ay2) * k / n); if (i >= 0 && j >= 0 && i < nx && j < ny) g[j * nx + i] = 1; }
      continue;
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = i + .5, py = j + .5;
      const w0 = (x1 - px) * (y2 - py) - (x2 - px) * (y1 - py);
      const w1 = (x2 - px) * (y0 - py) - (x0 - px) * (y2 - py);
      const w2 = (x0 - px) * (y1 - py) - (x1 - px) * (y0 - py);
      if (area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0) g[j * nx + i] = 1;
    }
  }
  // runs per row, merged down while the run below is the same
  const out = [], open = new Map();
  for (let j = 0; j <= ny; j++) {
    const runs = new Set();
    if (j < ny) for (let i = 0; i < nx; i++) if (g[j * nx + i]) { const s = i; while (i < nx && g[j * nx + i]) i++; runs.add(s + ':' + i); }
    for (const [k, r] of open) if (!runs.has(k)) { out.push(r); open.delete(k); } else r.h++;
    for (const k of runs) if (!open.has(k)) { const [a, b] = k.split(':').map(Number); open.set(k, { a, b, j, h: 1 }); }
  }
  return out.map((r) => [box.x0 + r.a * cell, box.y0 + r.j * cell, (r.b - r.a) * cell, r.h * cell]);
}

// returns { elev: {viewBox, html}, plan: {viewBox, html} }; html is one <g data-p="id"> per part
export function sketches(parts, order, lot, top, cutZ) {
  const draw = parts.filter((p) => !p.site);
  const ids = [...draw.map((p) => p.id)].sort((a, b) => (order.indexOf(a) < 0 ? -1 : order.indexOf(a)) - (order.indexOf(b) < 0 ? -1 : order.indexOf(b)));
  const byId = Object.fromEntries(draw.map((p) => [p.id, p]));
  // extents: the lot, grown to whatever the model reaches
  let x0 = lot.x0 - 1.5, x1 = lot.x1 + 1.5, z0 = lot.z0 - 1.4, z1 = lot.z1 + 1.4, y1 = top + 1.2;
  for (const p of draw) {
    for (let i = 0; i < p.fp.length; i += 3) { x0 = Math.min(x0, p.fp[i] - .5); x1 = Math.max(x1, p.fp[i] + .5); z0 = Math.min(z0, p.fp[i + 2] - .5); z1 = Math.max(z1, p.fp[i + 2] + .5); y1 = Math.max(y1, p.fp[i + 1] + .6); }
    for (const s of p.spheres) { x0 = Math.min(x0, s.c.x - s.r); x1 = Math.max(x1, s.c.x + s.r); y1 = Math.max(y1, s.c.y + s.r + .3); }
  }
  const cellE = (x1 - x0) / 190, cellP = Math.max(x1 - x0, z1 - z0) / 170;
  const elevBox = { x0, x1, y0: -y1, y1: .4 }, planBox = { x0, x1, y0: z0, y1: z1 };
  const rects = (list, c) => list.map(([x, y, w, h]) => `<rect class="${c}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"/>`).join('');
  const circ = (cx, cy, r) => `<circle class="t" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"/>`;
  let elev = '', plan = '';
  // elevation: back to front, so the nearer parts draw over the farther ones
  const depth = (id) => { const p = byId[id]; let s = 0, n = 0; for (let i = 2; i < p.fp.length; i += 30) { s += p.fp[i]; n++; } for (const q of p.spheres) { s += q.c.z; n++; } return n ? s / n : 0; };
  const eOrder = [...ids].sort((a, b) => (byId[a].big ? 1 : 0) - (byId[b].big ? 1 : 0) || depth(a) - depth(b));
  for (const id of eOrder) {
    const p = byId[id], c = p.big && !p.planting ? 'd' : 'b';
    elev += `<g data-p="${id}" class="x">${rects(rasterise(p, 0, 1, true, elevBox, cellE), c)}${p.spheres.map((s) => circ(s.c.x, -s.c.y, s.r)).join('')}</g>`;
  }
  // plan: the plinth first, then low to high
  const height = (id) => { const p = byId[id]; let m = 0; for (let i = 1; i < p.fp.length; i += 3) m = Math.max(m, p.fp[i]); return m; };
  const pOrder = [...ids].sort((a, b) => (byId[b].big && !byId[b].planting ? 1 : 0) - (byId[a].big && !byId[a].planting ? 1 : 0) || height(a) - height(b));
  for (const id of pOrder) {
    const p = byId[id], c = p.big && !p.planting ? 'd' : 'b';
    plan += `<g data-p="${id}">${rects(rasterise(p, 0, 2, false, planBox, cellP), c)}${p.spheres.map((s) => circ(s.c.x, s.c.z, s.r)).join('')}</g>`;
  }
  const cz = cutZ ?? 0;
  plan += `<polyline class="cut" points="${fmt(x0 + .3)},${fmt(cz)} ${fmt(x1 - .3)},${fmt(cz)}"/><text class="cutt" x="${fmt(x0 + .1)}" y="${fmt(cz - .6)}">A</text><text class="cutt" x="${fmt(x1 - 1)}" y="${fmt(cz - .6)}">A</text>`
    + `<g transform="translate(${fmt(x0 + .6)} ${fmt(z0 + .3)})"><path d="M0 -0 L.5 1.5 L0 1.15 L-.5 1.5 Z" fill="rgb(62 38 74 / .6)"/><text class="nt" x=".9" y="1.4">N</text></g>`;
  return {
    elev: { viewBox: `${fmt(x0)} ${fmt(-y1)} ${fmt(x1 - x0)} ${fmt(y1 + .6)}`, x0, x1, html: elev },
    plan: { viewBox: `${fmt(x0)} ${fmt(z0)} ${fmt(x1 - x0)} ${fmt(z1 - z0)}`, html: plan },
  };
}
