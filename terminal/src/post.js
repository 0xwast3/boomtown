// The ink and the hand: the model is drawn into a buffer, its solids drawn again into a normal and depth buffer,
// and one full-screen pass then
// - lays heavy ink on silhouettes (where the depth jumps: around the building, a tree in front of a wall, every lobe
//   of a crown) and light ink on creases (where the surface turns), like a hand inker who weights the outline;
// - leaves the house to its own ink lines (it is drawn with fat lines along every edge): the house writes .4 into the
//   alpha of the normal buffer, and no silhouette or crease is laid where the nearest thing is the house, so its
//   edges are never inked twice;
// - and a last FXAA pass smooths the stair steps the depth-based ink and the leaf cards leave.
// The lines stay straight: no wobble, no paper grain (both made the house's edges crooked and noisy).
import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { G } from './ink.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;        // drawing buffer, px
uniform float uPx;        // drawing buffer px per css px
uniform float uNear;
uniform float uFar;
uniform float uWob;       // wobble, css px
uniform float uInk;       // silhouette half width, css px
uniform float uGrain;     // paper grain strength
uniform float uOn;        // 1: outlines on (the painted model)
uniform vec3 uInkCol;
uniform float uDof;       // 0..1: depth of field (at the eye's height)
uniform float uFocus;     // focus distance, m
uniform float uDofPx;     // largest blur radius, css px
varying vec2 vUv;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ return .65 * vn(p) + .35 * vn(p * 2.03 + 7.1); }
// 1 / distance: for a perspective camera this runs linearly across any flat face, so its second difference
// is zero on planes (the ground seen at a glance stays clean) and jumps only where one thing stands before another
float W(vec2 uv){ float d = texture2D(tDepth, uv).x; return (uFar - d * (uFar - uNear)) / (uNear * uFar); }
vec4 N(vec2 uv){ vec4 n = texture2D(tNormal, uv); return vec4(n.xyz * 2.0 - 1.0, n.a); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - .055, step(.0031308, c)); }
// blur radius (buffer px) at a distance: a thin lens focused at uFocus
float coc(float w){ return min(1.0, abs(w - 1.0 / uFocus) * 6.5) * uDofPx * uPx * uDof; }
void main(){
  vec2 uv = vUv;
  vec4 c = texture2D(tColor, uv);
  float w0 = W(uv);
  // depth of field: a gather over a golden-angle disc; a tap counts if its own blur reaches this pixel,
  // and a tap behind this pixel may not bleed over it further than this pixel's own blur
  float c0 = uDof > .001 ? coc(w0) : 0.0;
  if (uDof > .001) {
    float R = uDofPx * uPx * uDof;
    vec4 acc = c; float ws = 1.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i) + .5;
      float r = sqrt(fi / 12.0), a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * r * R;
      vec2 t = uv + o / uRes;
      float wt = W(t), ct = coc(wt);
      float reach = wt > w0 ? ct : min(ct, c0);
      float k = clamp(reach - r * R + 1.0, 0.0, 1.0);
      acc += texture2D(tColor, t) * k; ws += k;
    }
    c = acc / ws;
  }
  float ink = 0.0;
  if (uOn > .001) {
    vec2 ox = vec2(uInk * uPx / uRes.x, 0.0), oy = vec2(0.0, uInk * uPx / uRes.y);
    float wl = W(uv - ox), wr = W(uv + ox), wd = W(uv - oy), wu = W(uv + oy);
    float ex = abs(wl + wr - 2.0 * w0), ey = abs(wd + wu - 2.0 * w0);
    float e2 = max(abs(W(uv - ox - oy) + W(uv + ox + oy) - 2.0 * w0), abs(W(uv - ox + oy) + W(uv + ox - oy) - 2.0 * w0));
    vec2 un = uv; float wn = w0;                                  // the nearest thing around: whose edge this is
    if (wl > wn) { wn = wl; un = uv - ox; } if (wr > wn) { wn = wr; un = uv + ox; }
    if (wd > wn) { wn = wd; un = uv - oy; } if (wu > wn) { wn = wu; un = uv + oy; }
    float own = texture2D(tNormal, un).a;
    float house = 1.0 - step(.15, abs(own - .4));                 // the house inks its own edges
    float ed = max(max(ex, ey), .7 * e2) / wn;                    // relative jump in distance
    float sil = smoothstep(.035, .09, ed) * (1.0 - house);
    vec2 qx = ox * .55, qy = oy * .55;
    vec4 n0 = N(uv), a = N(uv - qx), b = N(uv + qx), e = N(uv - qy), f = N(uv + qy);
    float cr = 0.0;
    if (n0.a > .7 && a.a > .7 && b.a > .7 && e.a > .7 && f.a > .7) {
      float m = min(min(dot(n0.xyz, a.xyz), dot(n0.xyz, b.xyz)), min(dot(n0.xyz, e.xyz), dot(n0.xyz, f.xyz)));
      cr = smoothstep(.55, .25, m) * .55;
    }
    float zn = 1.0 / max(wn, 1e-6);
    ink = max(sil, cr) * uOn;
    ink *= 1.0 - .6 * smoothstep(320.0, 900.0, zn);                // only the far forest's ink pales into the haze
    ink *= 1.0 - smoothstep(1.2, 3.5, coc(wn) / uPx);             // and leaves what is out of focus
  }
  float al = c.a * (1.0 - ink) + ink;
  if (al < .002) { gl_FragColor = vec4(0.0); return; }
  vec3 col = c.a > .001 ? toSRGB(c.rgb / c.a) : vec3(0.0);
  col = (col * c.a * (1.0 - ink) + uInkCol * ink) / al;
  gl_FragColor = vec4(col * al, al);
}`;

export function createPost(renderer) {
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  let samples = 4;
  const depthTex = new THREE.DepthTexture(1, 1); depthTex.type = THREE.UnsignedIntType;
  const normalRT = new THREE.WebGLRenderTarget(1, 1, { depthTexture: depthTex, depthBuffer: true });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: colorRT.texture }, tNormal: { value: normalRT.texture }, tDepth: { value: depthTex },
      uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 }, uNear: { value: .25 }, uFar: { value: 3000 },
      uDof: { value: 0 }, uFocus: { value: 90 }, uDofPx: { value: 7 },
      uWob: { value: 0 }, uInk: { value: 1.05 }, uGrain: { value: 0 }, uOn: { value: 1 },
      uInkCol: { value: new THREE.Vector3(35 / 255, 30 / 255, 22 / 255) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = mat.uniforms;
  // FXAA: the finished drawing goes through one more pass that finds stair steps by contrast and blends across them
  const fxRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const fxMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: fxRT.texture }, resolution: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VERT,
    fragmentShader: FXAAShader.fragmentShader.replace('float _SubpixelBlending = 1.0;', 'float _SubpixelBlending = .35;'),
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  const fxQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxMat); fxQuad.frustumCulled = false;
  const fxScene = new THREE.Scene(); fxScene.add(fxQuad);
  const clear = new THREE.Color(0, 0, 0);
  function setSize(w, h, dpr) {
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    const sm = dpr >= 1.75 ? 2 : 4;
    if (sm !== samples) { samples = sm; colorRT.samples = sm; colorRT.dispose(); }
    colorRT.setSize(W, H); normalRT.setSize(W, H); fxRT.setSize(W, H);
    fxMat.uniforms.resolution.value.set(1 / W, 1 / H);
    U.uRes.value.set(W, H); U.uPx.value = dpr;
  }
  // solids: the meshes drawn into the normal pass (layer 1); their blending is switched off for it
  function render(scene, camera, solids) {
    const prevAlpha = renderer.getClearAlpha(); renderer.getClearColor(clear);
    U.uNear.value = camera.near; U.uFar.value = camera.far;
    U.uInk.value = .78 + .3 * G.uDetail.value;   // the outline thins with distance, as the drawn lines do
    const outline = U.uOn.value > .001;
    if (outline) {
      G.uNPass.value = 1;
      const keep = [];
      for (const m of solids) { if (!m.visible) continue; keep.push([m, m.material.blending]); m.material.blending = THREE.NoBlending; }
      camera.layers.set(1);
      renderer.setRenderTarget(normalRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
      renderer.render(scene, camera);
      for (const [m, b] of keep) m.material.blending = b;
      G.uNPass.value = 0;
      camera.layers.set(0);
    }
    renderer.setRenderTarget(colorRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setRenderTarget(fxRT); renderer.clear(true, false, false);
    renderer.render(qScene, qCam);
    renderer.setRenderTarget(null); renderer.setClearColor(clear, prevAlpha); renderer.clear(true, true, false);
    renderer.render(fxScene, qCam);
  }
  return { setSize, render, uniforms: U };
}
