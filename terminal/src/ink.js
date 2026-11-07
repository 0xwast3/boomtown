// Ink and paint: screen-space fat lines whose colour runs red into violet and drifts slowly,
// paper fills with a pale wash, and glass. Lines draw themselves on through `uReveal`.
import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

// the user's gradient, sampled: red, crimson, magenta, purple, deep violet
export const RAMP = ['#e43a33', '#d8344a', '#c8336f', '#a82c92', '#7c22a0'];

export const G = {
  uTime: { value: 0 },
  resolution: { value: new THREE.Vector2(1, 1) },
  uPaint: { value: 1 },
  uRamp: { value: RAMP.map((c) => new THREE.Color(c)) },
  uShift: { value: 0 },          // pushes the whole drawing a little further toward violet (hover, focus)
  uColor: { value: 1 },          // 1: the painted model (true colours, dark ink), 0: the red-violet drawing
  uClip: { value: [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4)] },
  uDetail: { value: 1 },         // 0 far out to 1 close in: the painted model's ink thins and lightens with distance
};



const inkVert = /* glsl */`
#include <common>
#include <clipping_planes_pars_vertex>
uniform float linewidth;
uniform vec2 resolution;
uniform float uReveal;
uniform float uSpan;
uniform float uColor;
uniform float uDetail;
attribute vec3 instanceStart;
attribute vec3 instanceEnd;
attribute float instanceSeq;
varying vec2 vUv;
varying vec3 vWorld;
varying float vAge;
void trimSegment(const in vec4 start, inout vec4 end) {
  float a = projectionMatrix[2][2];
  float b = projectionMatrix[3][2];
  float nearEstimate = -0.5 * b / a;
  float alpha = (nearEstimate - start.z) / (end.z - start.z);
  end.xyz = mix(start.xyz, end.xyz, alpha);
}
void main() {
  float f = clamp((uReveal - instanceSeq) / uSpan, 0.0, 1.0);
  vAge = clamp((uReveal - instanceSeq - uSpan) / .22, 0.0, 1.0);   // freshly drawn lines glow, then settle into ink
  vec3 s3 = instanceStart;
  vec3 e3 = mix(instanceStart, instanceEnd, f);
  float aspect = resolution.x / resolution.y;
  vec4 start = modelViewMatrix * vec4(s3, 1.0);
  vec4 end = modelViewMatrix * vec4(e3, 1.0);
  vUv = uv;
  vWorld = (modelMatrix * vec4(position.y < 0.5 ? s3 : e3, 1.0)).xyz;
  bool perspective = (projectionMatrix[2][3] == -1.0);
  if (perspective) {
    if (start.z < 0.0 && end.z >= 0.0) trimSegment(start, end);
    else if (end.z < 0.0 && start.z >= 0.0) trimSegment(end, start);
  }
  vec4 clipStart = projectionMatrix * start;
  vec4 clipEnd = projectionMatrix * end;
  vec3 ndcStart = clipStart.xyz / clipStart.w;
  vec3 ndcEnd = clipEnd.xyz / clipEnd.w;
  vec2 dir = ndcEnd.xy - ndcStart.xy;
  dir.x *= aspect;
  float dl = length(dir);
  dir = dl > 1e-7 ? dir / dl : vec2(1.0, 0.0);
  vec2 offset = vec2(dir.y, -dir.x);
  dir.x /= aspect;
  offset.x /= aspect;
  if (position.x < 0.0) offset *= -1.0;
  if (position.y < 0.0) offset += -dir;
  else if (position.y > 1.0) offset += dir;
  offset *= linewidth * mix(1.0, mix(.8, 1.0, uDetail), uColor);
  offset /= resolution.y;
  vec4 clip = (position.y < 0.5) ? clipStart : clipEnd;
  offset *= clip.w;
  clip.xy += offset;
  gl_Position = clip;
  if (f <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vec4 mvPosition = (position.y < 0.5) ? start : end;
  #include <clipping_planes_vertex>
}`;

const inkFrag = /* glsl */`
uniform float opacity;
uniform float uTime;
uniform vec3 uRamp[5];
uniform float uHi;
uniform float uMono;
uniform float uShift;
uniform float uColor;
uniform float uColA;
uniform float uDetail;
uniform float uFine;
varying vec2 vUv;
varying vec3 vWorld;
varying float vAge;
#include <common>
#include <clipping_planes_pars_fragment>
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  if (t < 1.0) return mix(uRamp[0], uRamp[1], t);
  if (t < 2.0) return mix(uRamp[1], uRamp[2], t - 1.0);
  if (t < 3.0) return mix(uRamp[2], uRamp[3], t - 2.0);
  return mix(uRamp[3], uRamp[4], t - 3.0);
}
void main() {
  #include <clipping_planes_fragment>
  if (abs(vUv.y) > 1.0) {
    float a = vUv.x;
    float b = (vUv.y > 0.0) ? vUv.y - 1.0 : vUv.y + 1.0;
    if (a * a + b * b > 1.0) discard;
  }
  // mostly red; height and a slow travelling wave tip it toward violet
  float g = 0.06 + vWorld.y * 0.032 + dot(vWorld.xz, vec2(-0.0055, -0.0075));
  float w = sin(uTime * 0.42 + vWorld.x * 0.085 - vWorld.z * 0.07 + vWorld.y * 0.22);
  g += 0.20 * w * w * sign(w) + 0.06 + uShift;
  vec3 col = ramp(g);
  // a soft glint sweeping across the model
  float s = dot(vWorld, vec3(0.70, 0.30, 0.45));
  float band = exp(-pow((s - (mod(uTime * 5.5, 120.0) - 50.0)) / 3.4, 2.0));
  col = mix(col, ramp(0.62), 0.45 * band);
  col = mix(col, vec3(0.30, 0.25, 0.33), uMono);
  // painted model: the ink settles to a warm near-black once drawn; a studied part keeps the red-violet
  vec3 ink = mix(vec3(0.15, 0.11, 0.085), vec3(0.42, 0.37, 0.32), uMono);
  col = mix(col, ink, uColor * vAge);
  col = mix(col, ramp(g + 0.22), uHi * mix(0.55, 0.9, uColor));
  gl_FragColor = vec4(col, opacity * mix(1.0, uColA * mix(mix(.8, .3, uFine), 1.0, uDetail), uColor));
  #include <colorspace_fragment>
}`;

const fillVert = /* glsl */`
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;
void main() {
  vTint = color;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const fillFrag = /* glsl */`
uniform float opacity;
uniform float uPaint;
uniform float uHi;
uniform vec3 uRamp[5];
varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;
#include <common>
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float key = clamp(dot(n, normalize(vec3(-0.38, 1.0, 0.52))), 0.0, 1.0);
  float rim = clamp(dot(n, normalize(vec3(0.9, 0.15, 0.25))), 0.0, 1.0);
  vec3 paper = vec3(1.0, 0.994, 0.99);
  vec3 shade = vec3(0.925, 0.900, 0.915);
  vec3 col = mix(shade, paper, 0.42 + 0.58 * key);
  col = mix(col, col * vTint, uPaint);
  col += vec3(0.010, 0.002, 0.008) * rim;
  // a faint wash of the drawing colour on the focused or hovered part
  col = mix(col, mix(col, uRamp[1], 0.10), uHi);
  float g = fract(sin(dot(floor(vW.xz * 9.0 + vW.y * 5.0), vec2(12.9898, 78.233))) * 43758.5453);
  col *= 1.0 - 0.010 * g * uPaint;
  gl_FragColor = vec4(col, opacity);
  #include <colorspace_fragment>
}`;

const glassFrag = /* glsl */`
uniform float opacity;
uniform float uPaint;
uniform float uColor;
varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;
#include <common>
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(dot(n, v)), 2.0);
  float h = clamp(vW.y / 11.0, 0.0, 1.0);
  vec3 a = vec3(0.93, 0.80, 0.90), b = vec3(0.80, 0.74, 0.93);
  vec3 col = mix(a, b, 0.35 + 0.45 * h);
  col = mix(vec3(0.95, 0.93, 0.95), col, uPaint);
  // painted: clear glass in pale blue-green tones (#c4dfe4 to #e4f2f4), two white glints running diagonally
  // a deep teal low down to sky blue at the top, the sky's own pale blue at a glance
  vec3 pane = mix(vec3(0.030, 0.230, 0.310), vec3(0.120, 0.470, 0.660), smoothstep(-1.0, 12.0, vW.y));
  pane = mix(pane, vec3(0.500, 0.780, 0.900), fr * .85);
  float dv = (vW.x - vW.z) * .21 + vW.y * .33;
  float e = fwidth(dv), dg = fract(dv);
  float glint = smoothstep(.0, .015 + e, dg) * (1.0 - smoothstep(.05 - e, .065 + e, dg))
              + .6 * smoothstep(.12 - e, .13 + e, dg) * (1.0 - smoothstep(.145 - e, .155 + e, dg));
  glint *= 1.0 - smoothstep(.02, .06, e);
  col = mix(col, mix(pane, vec3(1.0), glint * .42), uColor);
  float al = opacity * mix(0.20 + 0.36 * fr, 0.42 + 0.3 * fr + 0.14 * glint, uColor);
  gl_FragColor = vec4(col, al);
  #include <colorspace_fragment>
}`;

export function inkMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      linewidth: { value: o.width || 1.3 },
      resolution: G.resolution,
      uReveal: { value: 0 },
      uSpan: { value: o.span || .1 },
      opacity: { value: o.opacity ?? 1 },
      uTime: G.uTime,
      uRamp: G.uRamp,
      uShift: G.uShift,
      uHi: { value: 0 },
      uMono: { value: o.mono || 0 },
      uColor: G.uColor,
      uColA: { value: o.colA ?? .7 },
      uFine: { value: o.fine ? 1 : 0 },
      uDetail: G.uDetail,
    },
    vertexShader: inkVert, fragmentShader: inkFrag,
    transparent: true, depthWrite: false, clipping: true, clippingPlanes: G.uClip.value,
  });
}
export function fillMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 1 }, uPaint: G.uPaint, uHi: { value: 0 }, uRamp: G.uRamp },
    vertexShader: fillVert, fragmentShader: fillFrag, vertexColors: true,
    side: THREE.DoubleSide, transparent: true, depthWrite: true,
    polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 3,
    clipping: true, clippingPlanes: G.uClip.value,
  });
}
export function glassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 1 }, uPaint: G.uPaint, uColor: G.uColor },
    vertexShader: fillVert, fragmentShader: glassFrag, vertexColors: true,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
    clipping: true, clippingPlanes: G.uClip.value,
  });
}

// line geometry with a draw-on order per segment
export function lineGeometry(arr, seq) {
  const g = new LineSegmentsGeometry();
  g.setPositions(arr);
  g.setAttribute('instanceSeq', new THREE.InstancedBufferAttribute(seq, 1));
  return g;
}
