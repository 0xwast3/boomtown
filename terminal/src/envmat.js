// Materials for the place around the house, drawn like the house: flat tones stepped by the sun, cool shade,
// ink from the outline pass. One global wind field moves everything that grows; one cloud field dims the ground.
import * as THREE from 'three';
import { G } from './ink.js';

const D2R = Math.PI / 180;
// one warm key sun, 30 degrees up, from the east-south-east: the fronts take it raking, the trees cast west
export const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, (90 - 30) * D2R, 1.25).normalize();
export const HAZE = new THREE.Color('#cdd6d4');

export const E = {
  uEnvT: { value: 0 },          // the place's own clock (stops under reduced motion)
  uWindOn: { value: 1 },
  uSun: { value: SUN_DIR.clone() },
  uFocal: { value: 1000 },      // px per unit at depth 1: for the size test that thins small things far away
  uCam: { value: new THREE.Vector3() },
};

export const ENV_GLSL = /* glsl */`
uniform float uEnvT;
uniform float uWindOn;
uniform vec3 uSun;
uniform float uFocal;
float eh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float en(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(eh1(i), eh1(i + vec2(1.0, 0.0)), u.x), mix(eh1(i + vec2(0.0, 1.0)), eh1(i + vec2(1.0, 1.0)), u.x), u.y); }
float efbm(vec2 p){ return .5 * en(p) + .27 * en(p * 2.03 + 5.2) + .15 * en(p * 4.01 + 1.7) + .08 * en(p * 8.07 + 9.3); }
const vec2 WDIR = vec2(.829, -.559);
// gusts: a wave that runs across the place in the wind's direction, broken up by a slow noise
float gust(vec2 p){
  float w = dot(p, WDIR);
  float wave = .5 + .5 * sin(w * .11 - uEnvT * 1.35);
  wave *= wave;
  float n = en(p * .045 - WDIR * uEnvT * .42);
  return (.25 + .95 * wave * (.35 + .8 * n)) * uWindOn;
}
// the lowest cloud deck (also drawn in the sky): its shadow on whatever stands below
float cloudAt(vec2 q){ return smoothstep(.57, .66, efbm(q)); }
float cloudShadow(vec3 wp){
  vec2 p = wp.xz + uSun.xz / max(.2, uSun.y) * (320.0 - wp.y);
  return cloudAt(p / 380.0 + vec2(uEnvT * .0042, uEnvT * .0017) * .6);
}
`;

// kinds: 0 grass, 1 herb (ferns, hostas, tall grass, ivy, far trees), 2 leaves on a cluster (trees, shrubs),
// 3 bark, 4 still things (litter, twigs, stones, moss), 5 the ground
const VERT_COMMON = /* glsl */`
attribute float aSway;
attribute vec4 aPivot;
attribute float aMat;
#ifdef USE_INSTANCING
attribute float aVar;
#endif
uniform float uKind;
uniform float uMinPx;
uniform float uRefH;
uniform float uScaleIn;
uniform float uSwayAmp;
uniform float uPivLocal;
attribute float aTree;
varying float vTree;
varying vec3 vWP;
varying vec3 vWN;
varying vec3 vSN;
varying float vSway;
varying float vVar;
varying float vMatV;
`;
const VERT_BEGIN = /* glsl */`
#include <begin_vertex>
mat4 IM = modelMatrix;
float vv = .5;
#ifdef USE_INSTANCING
IM = modelMatrix * instanceMatrix;
vv = aVar;
#endif
vec3 io = IM[3].xyz;
// size test: an instance smaller on screen than uMinPx shrinks into its root (no popping, it just fades in size)
float scl = length(IM[1].xyz);
float dep = max(.1, -(viewMatrix * vec4(io, 1.0)).z);
float lod = uMinPx > 0.0 ? smoothstep(uMinPx, uMinPx * 2.4, uRefH * scl * uFocal / dep) : 1.0;
lod *= smoothstep(vv * .55, vv * .55 + .45, uScaleIn);
transformed *= lod;
vec3 wp = (IM * vec4(transformed, 1.0)).xyz;
vec3 dw = vec3(0.0);
float g = gust(io.xz);
vec3 pivW = uPivLocal > .5 ? (IM * vec4(aPivot.xyz, 1.0)).xyz : aPivot.xyz;
if (uKind < .5) {                       // grass: 3 to 8 degrees in the gusts, a little shiver
  float hgt = max(0.0, wp.y - io.y);
  float ang = radians(3.0 + 5.0 * clamp(g, 0.0, 1.0)) * uSwayAmp + .035 * sin(uEnvT * 2.6 + vv * 23.0) * uWindOn;
  dw.xz = WDIR * hgt * sin(ang) * (.4 + .6 * aSway);
  dw.y = -hgt * (1.0 - cos(ang)) * aSway;
} else if (uKind < 1.5) {               // herbs: a smaller bend, the leaves flutter fast and small
  float hgt = max(0.0, wp.y - io.y);
  float ang = radians(1.2 + 3.5 * g) * uSwayAmp;
  dw.xz = WDIR * hgt * sin(ang) * aSway;
  float fl = sin(uEnvT * 7.3 + vv * 31.0 + wp.x * 3.1 + wp.z * 2.7) * .016 * aSway * (.35 + g) * uWindOn;
  dw += vec3(fl, fl * .6, -fl * .5);
} else if (uKind < 2.5) {               // leaves in clusters: the branch sways on an 8-12 s cycle, the leaf flutters
  float hk = clamp(pivW.y / 12.0, 0.0, 1.0) * uSwayAmp;
  float ph = aPivot.w * 6.2832;
  float sw = sin(uEnvT * 6.2832 / (8.0 + 4.0 * fract(aPivot.w * 7.13)) + ph) * uWindOn;
  float gp = gust(pivW.xz);
  dw.xz = (WDIR * (.14 * sw + .42 * gp) + vec2(-WDIR.y, WDIR.x) * .09 * sw) * hk * hk * 1.6;
  float fl = sin(uEnvT * 9.4 + aPivot.w * 40.0 + wp.x * 4.1 + wp.y * 3.3) * .028 * aSway * (.3 + gp) * uWindOn;
  dw += vec3(fl * .6, fl, fl * .4);
} else if (uKind < 3.5) {               // bark: the crown moves with its leaves, the trunk stays
  float hk = clamp(wp.y / 12.0, 0.0, 1.0) * uSwayAmp;
  float sw = sin(uEnvT * 6.2832 / 10.0 + io.x * .1) * uWindOn;
  dw.xz = WDIR * (.14 * sw + .42 * gust(wp.xz)) * hk * hk * 1.6 * aSway;
}
mat3 R3 = mat3(IM);
transformed += (transpose(R3) * dw) / max(1e-6, dot(R3[0], R3[0]));
vWP = wp + dw;
vWN = normalize(R3 * objectNormal);
vSN = normalize(vWP - pivW);
vSway = aSway; vVar = vv; vMatV = aMat;
vTree = aTree;
`;

const FRAG_COMMON = /* glsl */`
uniform float uKind;
uniform vec3 uA0, uA1, uA2, uA3;     // tones of the first make-up: shade, mid, lit, glow (backlit)
uniform vec3 uB0, uB1, uB2, uB3;     // and of the second (bark, flowers, plumes, a pale leaf edge)
uniform float uTrans;                // how much backlight shines through
uniform float uAO;                   // darker at the roots
uniform float uSphere;               // leaves: share of the cluster's round normal
uniform float uNPass;
uniform float uColor;
uniform sampler2D uDens;             // planting density around the house (ground: damp soil, shade at the roots)
uniform vec4 uDensR;                 // its area: x0, z0, size
uniform vec2 uPath[6];
uniform float uHide[11];             // per tree (1..10): it stands back to a hatched ghost
varying float vTree;
varying vec3 vWP;
varying vec3 vWN;
varying vec3 vSN;
varying float vSway;
varying float vVar;
varying float vMatV;
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float pathD(vec2 p){ float d = 1e4; for (int i = 0; i < 5; i++) d = min(d, segD(p, uPath[i], uPath[i + 1])); return d; }
`;

// the drawing: shade, mid and lit in steps; cast shadow and cloud shade take the sun away; shadowed parts lean cool
// and pick up a green bounce from the grass; leaves against the sun glow
const FRAG_BODY = /* glsl */`
if (vTree > .5) {
  float hid = 0.0; int ti = int(vTree + .5);
  for (int i = 1; i < 11; i++) if (ti == i) hid = uHide[i];
  if (hid > .01) {
    if (hid > .97 || uNPass > .5 && hid > .3) discard;
    float hl = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);   // a fine dissolve while it goes
    if (hl < hid) discard;
  }
}
vec3 Nw = normalize(vWN); if (!gl_FrontFacing) Nw = -Nw;
if (uSphere > 0.0) Nw = normalize(mix(Nw, vSN, uSphere));
if (uNPass > .5) { gl_FragColor = vec4(normalize((viewMatrix * vec4(Nw, 0.0)).xyz) * .5 + .5, 1.0); return; }
float mB = smoothstep(.5, .9, vMatV);
vec3 t0 = mix(uA0, uB0, mB), t1 = mix(uA1, uB1, mB), t2 = mix(uA2, uB2, mB), t3 = mix(uA3, uB3, mB);
vec3 Vd = normalize(cameraPosition - vWP);
float sh = 1.0 - getShadowMask();
float cl = 1.0 - .42 * cloudShadow(vWP);
float extra = 0.0;
if (uKind > 4.5) {
  // the ground: turf with thin soil, moss in the hollows, clover drifts, a gravel path, damp soil at the roots
  vec2 p = vWP.xz;
  float fw = length(fwidth(p)) + 1e-5;
  #define AAF(f) (1.0 - smoothstep(.2, .55, fw * (f)))
  float far = smoothstep(18.0, 140.0, length(vWP - cameraPosition));
  float n1 = efbm(p * .06), n2 = efbm(p * .31 + 3.1);
  float dens = texture2D(uDens, (p - uDensR.xy) / uDensR.z).r;
  #define CUT(v, th) smoothstep((th) - fwidth(v) * .8 - .006, (th) + fwidth(v) * .8 + .006, v)
  float vs = n1 * .8 + n2 * .35 + dens * .2 - .02, vm = efbm(p * .17 + 7.0), vc = efbm(p * .45 + 11.0);
  float far2 = smoothstep(50.0, 200.0, length(vWP - cameraPosition));
  float soil = CUT(vs, .67) * (1.0 - .65 * far2);
  float moss = CUT(vm, .6) * (1.0 - soil) * (1.0 - .4 * far2);
  float clov = CUT(vc, .64) * (1.0 - soil) * (1.0 - moss);
  float pd = pathD(p);
  float path = 1.0 - smoothstep(.75 - fw, 1.05 + fw, pd + (en(p * 3.0) - .5) * .25 * AAF(3.0));
  vec3 g0 = vec3(.0218, .0405, .0145), g1 = vec3(.0545, .0925, .0335), g2 = vec3(.109, .177, .052), g3 = vec3(.20, .30, .09);
  float sp = mix(.5, en(p * 9.0), AAF(9.0)) * (1.0 - far);     // the turf's own speckle, gone in the distance
  float tc = mix(.5, step(.5, en(p * 1.3 + 5.7)), AAF(1.3));    // coarse tussocks that hold from afar
  g2 *= (.86 + .3 * sp) * (.92 + .16 * tc * far); g1 *= (.88 + .26 * sp) * (.93 + .14 * tc * far);
  vec3 s0 = vec3(.035, .029, .021), s1 = vec3(.052, .044, .032), s2 = vec3(.068, .057, .040);
  vec3 m0 = vec3(.035, .045, .012), m1 = vec3(.088, .11, .025), m2 = vec3(.16, .19, .042);
  vec3 c0 = vec3(.028, .058, .018), c1 = vec3(.07, .14, .04), c2 = vec3(.14, .27, .07);
  vec3 r0 = vec3(.12, .11, .09), r1 = vec3(.22, .2, .16), r2 = vec3(.34, .31, .25);
  float sm = moss * (.75 + .5 * mix(.5, step(.5, en(p * 14.0)), AAF(14.0)));
  float sc = clov * mix(.55, step(.45, en(p * 6.0 + vec2(en(p * 2.0) * 3.0))), AAF(6.0));
  t0 = mix(mix(mix(mix(g0, s0, soil), m0, sm), c0, sc), r0, path);
  t1 = mix(mix(mix(mix(g1, s1, soil), m1, sm), c1, sc), r1, path);
  t2 = mix(mix(mix(mix(g2, s2, soil), m2, sm), c2, sc), r2, path);
  t3 = t2;
  if (path > .5) { float gr = mix(.38, step(.62, en(p * 22.0)), AAF(22.0)); t2 *= .85 + .3 * gr; t1 *= .85 + .3 * gr; }
  // damp: darker soil where the planting is thick, with a wet glint toward the sun
  float wet = smoothstep(.25, .7, dens) * (1.0 - path);
  t0 *= 1.0 - .2 * wet; t1 *= 1.0 - .24 * wet; t2 *= 1.0 - .22 * wet;
  extra = wet * smoothstep(.965, .99, dot(reflect(-Vd, vec3(0.0, 1.0, 0.0)), uSun)) * (1.0 - sh);
  sh = max(sh, .4 * smoothstep(.45, 1.0, dens));             // the roots of thick planting sit in their own shade
}
float d = dot(Nw, uSun);
float k1 = smoothstep(-.72, -.48, d);
float k2 = smoothstep(-.14, .08, d) * (1.0 - sh) * cl;
vec3 col = mix(t0, t1, k1);
col = mix(col, t2 * vec3(1.07, 1.0, .88), k2);
float shade = 1.0 - k2;
col = mix(col, col * vec3(.9, .98, 1.1) + vec3(0.0, .006, .002), shade * .6);
if (uTrans > 0.0) {
  float tr = pow(clamp(dot(-Vd, uSun), 0.0, 1.0), 3.0) * uTrans * (1.0 - .55 * sh) * cl;
  float rim = 1.0 - abs(dot(Nw, Vd));
  col = mix(col, t3, smoothstep(.22, .5, tr * (.45 + rim)));
}
if (uKind < 2.5 && uKind != 5.0) col *= mix(1.0 - uAO, 1.0, smoothstep(0.0, .55, vSway));
col *= .92 + .16 * vVar;
if (uKind > 2.5 && uKind < 3.5) {
  // bark: dark crevices, moss in them on the shaded side, low down
  float cr = vMatV;
  float mossB = smoothstep(.2, .6, -dot(Nw.xz, uSun.xz)) * smoothstep(5.0, .5, vWP.y) * step(.45, cr);
  col *= mix(1.0, .55, cr);
  col = mix(col, mix(vec3(.04, .052, .016), vec3(.11, .14, .035), k2), mossB * .85);
}
col += extra * vec3(.35, .33, .28);
// the line drawing mode: the place pales to a ghost behind the red-violet lines
col = mix(mix(vec3(.84, .83, .82), col, .22), col, uColor);
outgoingLight = col;
`;

const _dummyDens = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
_dummyDens.needsUpdate = true;
export const ENVU = {
  uDens: { value: _dummyDens },
  uDensR: { value: new THREE.Vector4(-100, -100, 200, 0) },
  uPath: { value: [0, 0, 0, 0, 0, 0].map(() => new THREE.Vector2(1e4, 1e4)) },
  uHide: { value: new Array(11).fill(0) },
};

const toLin = (hex) => new THREE.Color(hex);
// tones: [shade, mid, lit, glow]
export function vegMaterial(o) {
  const kind = o.kind;
  const A = (o.tones || ['#2c3a20', '#41592c', '#55753a', '#86a35c']).map(toLin);
  const B = (o.tones2 || o.tones || ['#2c3a20', '#41592c', '#55753a', '#86a35c']).map(toLin);
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: o.side ?? THREE.FrontSide, shadowSide: o.shadowSide ?? THREE.FrontSide });
  const U = {
    uKind: { value: kind }, uMinPx: { value: o.minPx ?? 0 }, uRefH: { value: o.refH ?? 1 }, uScaleIn: { value: o.scaleIn ?? 2 },
    uSwayAmp: { value: o.sway ?? 1 }, uPivLocal: { value: o.pivLocal ? 1 : 0 },
    uA0: { value: A[0] }, uA1: { value: A[1] }, uA2: { value: A[2] }, uA3: { value: A[3] },
    uB0: { value: B[0] }, uB1: { value: B[1] }, uB2: { value: B[2] }, uB3: { value: B[3] },
    uTrans: { value: o.trans ?? 0 }, uAO: { value: o.ao ?? 0 }, uSphere: { value: o.sphere ?? 0 },
  };
  m.userData.u = U;
  const shared = { uEnvT: E.uEnvT, uWindOn: E.uWindOn, uSun: E.uSun, uFocal: E.uFocal, uNPass: G.uNPass, uColor: G.uColor, ...ENVU };
  const patchV = (sh) => sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + ENV_GLSL + VERT_COMMON)
    .replace('#include <begin_vertex>', VERT_BEGIN);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, U);
    sh.vertexShader = patchV(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ENV_GLSL + FRAG_COMMON)
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('#include <opaque_fragment>', FRAG_BODY + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'bt-env-' + kind;
  // the shadow moves with the wind as the thing itself does
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: o.shadowSide ?? THREE.FrontSide });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + ENV_GLSL + VERT_COMMON.replace(/varying[^;]*;/g, ''))
      .replace('#include <begin_vertex>', VERT_BEGIN.replace(/^v(WP|WN|SN|Sway|Var|MatV|Tree) =.*$/gm, '').replace(/vWP = [^;]*;|vWN = [^;]*;|vSN = [^;]*;|vSway = aSway; vVar = vv; vMatV = aMat;/g, ''));
  };
  depth.customProgramCacheKey = () => 'bt-env-depth-' + kind;
  m.userData.depth = depth;
  return m;
}
