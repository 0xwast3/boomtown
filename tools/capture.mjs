#!/usr/bin/env node
// Render a built terminal to stills, a review sheet or a film.
//
//   node tools/capture.mjs deck-house --still --frame axoL --out boomtown-out/axo.png
//   node tools/capture.mjs deck-house --still --show 9.5 --out boomtown-out/show-9.5.png   # the show's camera at 9.5 s
//   node tools/capture.mjs deck-house --sheet --out boomtown-out/sheet.png                 # 12 tiles through the show
//   node tools/capture.mjs deck-house --film --fps 30 --out boomtown-out/deck-house.mp4    # the whole 24 s show
//   node tools/capture.mjs deck-house --film --fps 12 --size 960x540 --out x.gif            # a README gif
//
// The first argument is a model name / folder (it is built first) or a ready .html file.
// --size WxH is the CSS layout (default 1920x1080, the terminal's design size), --dpr multiplies it.
// Other flags pass straight into the page: --frame eye|axoL|axoR|top|front|back|side, --focus <part>,
// --explode 1, --xray 1, --cut section|plan, --paint 0, --lang ru.
// A film runs the page on a virtual clock, so every frame is exact however slow the renderer is.
// Set CHROMIUM to use another Chromium binary, FFMPEG for another ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { MARK_ID, markRect, markTime, markStyle, markInner } from '../terminal/src/mark.js';
const MARK_SVG = fs.readFileSync(fileURLToPath(new URL('../terminal/assets/mark.svg', import.meta.url)), 'utf8');

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf('--' + k); if (i < 0) return d; const v = args[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };
const target = args[0];
if (!target || target.startsWith('--')) { console.error('usage: node tools/capture.mjs <model|file.html> --still|--sheet|--film [--out file]'); process.exit(1); }
const file = target.endsWith('.html') ? path.resolve(target) : await build(target);
const [W, H] = String(flag('size', '1920x1080')).split('x').map(Number);
const dpr = +flag('dpr', 1);
const mode = flag('film') ? 'film' : flag('sheet') ? 'sheet' : 'still';
const name = path.basename(file, '.html');
const out = path.resolve(flag('out', path.join('boomtown-out', `${name}-${mode}${mode === 'film' ? '.mp4' : '.png'}`)));
fs.mkdirSync(path.dirname(out), { recursive: true });
const pass = ['frame', 'focus', 'explode', 'xray', 'cut', 'paint', 'lang', 'labels', 'q'].filter((k) => flag(k) !== undefined).map((k) => `${k}=${flag(k)}`);

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=' + (process.env.ANGLE || 'default'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const query = (q) => '?' + q.filter(Boolean).join('&');
const url = (q) => 'file://' + file + query(q);

// The @0xwast3 mark (LICENSE): before every shot the page's own mark must be there, whole and in its place for this
// moment, and the capture puts its own copy, its seal, exactly over it. A page without the mark is not captured.
async function seal(ms) {
  const r = markRect(ms, W, H);
  const why = await page.evaluate(({ id, r, st, inner }) => {
    const m = document.getElementById(id);
    if (!m) return 'missing from the page';
    const cs = getComputedStyle(m), b = m.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility !== 'visible' || cs.opacity !== '1') return 'hidden';
    if (Math.abs(b.left - r.x) > 1.5 || Math.abs(b.top - r.y) > 1.5 || Math.abs(b.width - r.w) > 1.5 || Math.abs(b.height - r.h) > 1.5) return 'moved, shrunk or stopped';
    let s = document.getElementById(id + '-seal');
    if (!s) { s = document.createElement('div'); s.id = id + '-seal'; s.setAttribute('popover', 'manual'); s.attachShadow({ mode: 'open' }); document.documentElement.appendChild(s); }
    s.setAttribute('style', st);
    if (s.shadowRoot.innerHTML !== inner) s.shadowRoot.innerHTML = inner;
    try { if (s.matches(':popover-open')) s.hidePopover(); s.showPopover(); } catch (e) {}
    return '';
  }, { id: MARK_ID, r, st: markStyle(r), inner: markInner(MARK_SVG, r, false) });
  if (why) {
    console.error(`\nThe @0xwast3 mark is ${why}. Every page, picture and film made with boomtown carries it: it is the condition of the licence (LICENSE).`
      + '\nNothing was captured. Restore terminal/ and tools/ from github.com/0xwast3/boomtown and build again.');
    await browser.close(); process.exit(2);
  }
}

async function still(q, shot) {
  await page.goto(url(['t=99', ...pass, ...q]));
  await page.waitForFunction(() => window.__done === true, null, { timeout: 600000, polling: 250 });
  await page.evaluate(() => document.fonts.ready);
  await seal(markTime(0, { still: true, search: query(['t=99', ...pass, ...q]) }));
  return page.screenshot({ path: shot, timeout: 600000 });
}

if (mode === 'still') {
  const s = flag('show');
  await still(s !== undefined ? [`show=${s}`] : [], out);
  console.log(path.relative(process.cwd(), out));
} else if (mode === 'sheet') {
  // tiles through the show, labelled with their second
  const n = +flag('tiles', 12), cols = +flag('cols', 4), times = Array.from({ length: n }, (_, i) => +(1 + (i + .5) * 23 / n).toFixed(1));
  const shots = [];
  for (const t of times) shots.push((await still([`show=${t}`])).toString('base64'));
  const tw = 480, th = Math.round(tw * H / W);
  const html = `<body style="margin:0;background:#140c18;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:6px;padding:6px;font:600 14px system-ui;color:#fff">`
    + shots.map((b, i) => `<div style="position:relative"><img src="data:image/png;base64,${b}" style="width:${tw}px;height:${th}px;display:block"><span style="position:absolute;left:8px;top:6px;background:#0009;padding:2px 6px;border-radius:6px">t=${times[i]}</span></div>`).join('') + '</body>';
  const p2 = await browser.newPage({ viewport: { width: cols * (tw + 6) + 6, height: 100 }, deviceScaleFactor: 1 });
  await p2.setContent(html); await p2.screenshot({ path: out, fullPage: true });
  console.log(path.relative(process.cwd(), out));
} else {
  // the film: the page runs live, on a clock that only moves when we step it
  const fps = +flag('fps', 30), len = +flag('len', 25), from = +flag('from', 0);
  await page.addInitScript(() => {
    let T = 0; const q = []; const base = Date.now();
    performance.now = () => T; Date.now = () => base + T;
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.cancelAnimationFrame = () => {};
    window.__step = (ms) => { T += ms; const cbs = q.splice(0); for (const cb of cbs) cb(T); return q.length; };
  });
  await page.goto(url(['q=' + (flag('q') ?? 0), ...pass.filter((p) => !p.startsWith('q='))]));
  await page.evaluate(() => document.fonts.ready);
  // wait until the show is live (shaders compiled), running the queued frames without moving the clock
  await page.waitForFunction(() => { if (window.__step) window.__step(0); return document.documentElement.classList.contains('live'); }, null, { timeout: 600000, polling: 200 });
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const gif = out.endsWith('.gif');
  const enc = gif
    ? ['-vf', `fps=${fps},split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, '-loop', '0']
    : ['-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...enc, out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(len * fps), dt = 1000 / fps, t0 = Date.now();
  let T = 0;                                                     // the page's clock, kept here too, for the seal
  for (let k = 0; k < Math.round(from * fps); k++) { await page.evaluate((d) => window.__step(d), dt); T += dt; }
  for (let k = 0; k < N; k++) {
    await page.evaluate((d) => window.__step(d), dt); T += dt;
    await seal(T);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94, timeout: 600000 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (k % fps === 0) process.stdout.write(`\r${(k / fps).toFixed(0)} / ${len} s  ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('\n' + path.relative(process.cwd(), out));
}
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
