// The painted model, drawn the boomtown way:
// - every material in three flat tones (lit, mid, shade = the colour, x .84, x .58), stepped by how a face turns
//   to one light, with a narrow soft band at each step so a face turning past a threshold fades instead of snapping;
// - the light stays put relative to the viewer: from the upper right of the screen, a little behind the model, so
//   the face turned to the viewer's right reads lit, the left side falls into shade, cast shadows fall to the lower left;
// - cast shadows are flat blue, on the ground and on what the model stands on (the deck, terraces, roofs);
// - foliage is a cloud of round lobes in the same three tones, outlined by the ink pass (see post.js).
import * as THREE from 'three';
import { MATS, COLOR } from './kit.js';
import { G } from './ink.js';
import { SUN_DIR } from './envmat.js';

export const SHADOW_BLUE = '#3f566c';   // cool slate: the flat cast shadow, leaning to the green it stands in
const matColors = MATS.map((k) => new THREE.Color(COLOR[k]));
G.uLight = { value: new THREE.Vector3(.4, .85, .2).normalize() };   // toward the light, world space
G.uNPass = { value: 0 };                                            // 1 while the normal pass for the outlines is drawn
G.uShadowCol = { value: new THREE.Color(SHADOW_BLUE) };

// ── light ────────────────────────────────────────────────────────────────
// One warm sun, fixed in the world (see envmat.js), with two shadow cascades fitted to what is on screen:
// a fine one over the area of interest (the house, or the meadow from the eye to the house) and a wide coarse one.
export const SUN = new THREE.DirectionalLight('#ffffff', 1);
export const SUN2 = new THREE.DirectionalLight('#ffffff', 0);
G.uLight.value.copy(SUN_DIR);
const _c = new THREE.Vector3(), _ls = new THREE.Matrix4(), _li = new THREE.Matrix4(), _q = new THREE.Vector3();
function fit(light, cx, cz, r, size) {
  const sc = light.shadow.camera;
  // the box in light space, its centre snapped to whole texels so the shadows do not swim as the view moves
  _ls.lookAt(SUN_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)); _li.copy(_ls).invert();
  _q.set(cx, 0, cz).applyMatrix4(_li);
  const tx = 2 * r / size; _q.x = Math.round(_q.x / tx) * tx; _q.y = Math.round(_q.y / tx) * tx;
  _c.copy(_q).applyMatrix4(_ls);
  light.target.position.copy(_c);
  light.position.copy(_c).addScaledVector(SUN_DIR, 260);
  if (sc.right !== r) { Object.assign(sc, { left: -r, right: r, top: r, bottom: -r }); sc.updateProjectionMatrix(); }
}
// the area of interest: around the target, pulled toward the camera when it stands low (the eye on the meadow)
const _f = new THREE.Vector3();
export function aimShadows(camera, target, aspect) {
  const dist = camera.position.distanceTo(target);
  const elev = Math.asin(Math.max(-1, Math.min(1, (camera.position.y - target.y) / Math.max(1e-3, dist))));
  const low = 1 - THREE.MathUtils.smoothstep(elev, .15, .6);
  _f.subVectors(camera.position, target); _f.y = 0;
  const hd = _f.length();
  const cx = target.x + _f.x * .5 * low, cz = target.z + _f.z * .5 * low;
  const span = dist * Math.tan(camera.fov * Math.PI / 360) * Math.max(1, aspect) * 1.15;
  const r = Math.max(24, Math.min(64, Math.max(span, hd * .5 * low * 1.1 + 22)));
  fit(SUN, cx, cz, Math.round(r), SUN.shadow.mapSize.x);
  fit(SUN2, cx, cz, 150, SUN2.shadow.mapSize.x);
}
export function setupLight(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  for (const [L, size, rad] of [[SUN, 4096, 1.8], [SUN2, 2048, 1.2]]) {
    L.castShadow = true;
    L.shadow.autoUpdate = false;          // redrawn when something moves: every frame while the wind blows (see main.js)
    Object.assign(L.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 120, far: 420 });
    L.shadow.camera.updateProjectionMatrix();
    L.shadow.mapSize.set(size, size);
    L.shadow.bias = -.0005;
    L.shadow.normalBias = size > 3000 ? .035 : .09;
    L.shadow.radius = rad;
    scene.add(L, L.target);
  }
  return { near: SUN, far: SUN2 };
}

// ── surfaces ─────────────────────────────────────────────────────────────
const NOISE = /* glsl */`
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y); }
`;
// a little of each material's own make-up, kept quiet: the tones carry the form, the ink carries the detail
const SURFACE = /* glsl */`
vec3 surface(int id, vec3 c, vec3 P, vec3 N) {
  float ny = abs(N.y);
  vec2 t2 = normalize(vec2(-N.z, N.x) + 1e-5);
  float s = dot(P.xz, t2);                       // runs along a vertical face
  // how far one pixel reaches across the surface: every pattern fades to its mean before it gets finer than a pixel,
  // so boards, ribs and cells never break into stair steps or moire
  vec3 fP = fwidth(P);
  float fs = length(fP.xz) + 1e-5;
  if (id == 2) {                                 // deck boards: one tone per board and per length, a dark gap
    float k = ny > .5 ? (P.z + 11.0) / .3 : P.y / .13 + 40.0;
    float fk = ny > .5 ? fP.z / .3 : fP.y / .13;
    float along = ny > .5 ? P.x : s;
    float idx = floor(k), fr = fract(k);
    float off = h1(vec2(idx, 1.3)) * 3.9;
    float j = floor((along + off) / 3.9);
    float fine = smoothstep(.12, .45, fk);
    c *= mix(.91 + .13 * h1(vec2(idx, j)), .975, fine);
    float gap = smoothstep(.0, .07 + fk, fr) * (1.0 - smoothstep(.93 - fk, 1.0, fr));
    c *= mix(mix(.74, 1.0, gap), .965, fine);
  } else if (id == 1 || id == 12) {              // timber and bark: a soft grain
    vec2 q = ny > .5 ? P.xz : vec2(s, P.y);
    c *= .94 + .09 * mix(vnoise(vec2(q.x * 1.3 + q.y * .2, q.y * 6.0 + q.x * 6.0)), .5, smoothstep(.1, .3, max(fs, fP.y) * 6.0));
  } else if (id == 4) {                          // corrugated sheet: ribs
    if (ny < .5) { float r = sin(s * 6.2831853 / .15); c *= .93 + .07 * r * (1.0 - smoothstep(.2, .5, fs / .15)); }
  } else if (id == 9) {                          // solar cells
    vec2 q = fract(vec2(P.x / .26, P.z / .287));
    float fq = max(fP.x / .26, fP.z / .287);
    float ln = 1.0 - smoothstep(.04, .08 + fq, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
    ln = mix(ln, .24, smoothstep(.15, .45, fq));
    c = mix(c, c * 1.55 + .08, ln * .55);
  } else if (id == 6) {                          // soil
    c *= .86 + .2 * mix(vnoise(P.xz * 6.0), .5, smoothstep(.1, .3, fs * 6.0));
  } else if (id == 7 || id == 8) {               // foliage: a few lighter leaves
    c *= .95 + .1 * mix(step(.72, vnoise(P.xz * 3.1 + P.y * 2.3)), .28, smoothstep(.1, .3, max(fs, fP.y) * 3.1));
  }
  return c;
}
`;
// three tones, blended across a narrow band at each step
const TONE = /* glsl */`
float tone3(float d) {
  float a = smoothstep(-.05 - .12, -.05 + .12, d), b = smoothstep(-.6 - .12, -.6 + .12, d);
  return mix(mix(.36, .68, b), 1.0, a);   // (linear light: the sRGB x .84 and x .58 tones)
}
`;

// a lit, shadowed, toned material for the painted model; `hi` is the red-violet wash on a studied part,
// `grow` lets the foliage lobes swell from their centres as the planting is put in
export function solidMaterial() {
  const m = new THREE.MeshLambertMaterial({
    color: 0xffffff, transparent: true, opacity: 1, side: THREE.FrontSide, shadowSide: THREE.DoubleSide,
    clippingPlanes: G.uClip.value, clipShadows: true,
    polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 3,
  });
  const hi = { value: 0 }, grow = { value: 2 }, dim = { value: 0 };
  m.userData.hi = hi; m.userData.grow = grow; m.userData.dim = dim;
  const patchV = (sh) => {
    sh.uniforms.uGrow = grow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float mat;\nattribute vec4 aG;\nuniform float uGrow;\nvarying float vMat;\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (aG.w >= 0.0) { float gk = smoothstep(aG.w, aG.w + .35, uGrow); transformed = aG.xyz + (transformed - aG.xyz) * max(gk, .001); }\nvMat = mat;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uMatCol: { value: matColors }, uHi: hi, uDim: dim, uRamp: G.uRamp, uLight: G.uLight, uNPass: G.uNPass, uShadowCol: G.uShadowCol });
    patchV(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uMatCol[${MATS.length}];\nuniform float uHi;\nuniform float uDim;\nuniform vec3 uRamp[5];\nuniform vec3 uLight;\nuniform float uNPass;\nuniform vec3 uShadowCol;\nvarying float vMat;\nvarying vec3 vWP;\nvarying vec3 vWN;\n${NOISE}\n${SURFACE}\n${TONE}`)
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('#include <color_fragment>', '#include <color_fragment>\nint mi = int(vMat + .5); vec3 base = uMatCol[0];\n' +
        MATS.map((_, i) => `if (mi == ${i}) base = uMatCol[${i}];`).join(' ') + '\n')
      .replace('#include <opaque_fragment>', `
        if (uNPass > .5) { gl_FragColor = vec4(normalize(normal) * .5 + .5, (mi == 7 || mi == 8) ? 1.0 : .4); return; }
        vec3 Nw = normalize(vWN); if (!gl_FrontFacing) Nw = -Nw;
        vec3 col = surface(mi, base, vWP, Nw) * tone3(dot(Nw, uLight));
        float sh = 1.0 - getShadowMask();
        float up = smoothstep(.55, .85, Nw.y);
        col = mix(col, col * .7, sh * (1.0 - up));
        col = mix(col, uShadowCol * (.94 + .06 * base), sh * up * .9);
        // shade picks up the meadow: a green bounce on faces turned away from the sun and from the sky
        float away = (1.0 - smoothstep(-.1, .25, dot(Nw, uLight))) * (1.0 - max(Nw.y, 0.0));
        col *= mix(vec3(1.0), vec3(.9, 1.05, .93), .55 * max(away, sh * (1.0 - up)));
        col = mix(col, col * .8 + uRamp[1] * .22, uHi * .45);
        // saturated, never washed out: push the colour away from its own grey
        float lum = dot(col, vec3(.2126, .7152, .0722));
        col = max(mix(vec3(lum), col, 1.15), 0.0);
        // while another part is studied this one stays solid but steps back: quieter, lighter
        col = mix(col, vec3(lum) * .7 + vec3(.1, .105, .1), uDim * .3);
        outgoingLight = col;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'boomtown-toon';
  // its shadow has the same foliage growth
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, clippingPlanes: G.uClip.value });
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.uGrow = grow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aG;\nuniform float uGrow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (aG.w >= 0.0) { float gk = smoothstep(aG.w, aG.w + .35, uGrow); transformed = aG.xyz + (transformed - aG.xyz) * max(gk, .001); }');
  };
  depth.customProgramCacheKey = () => 'boomtown-toon-depth';
  m.userData.depth = depth;
  return m;
}
