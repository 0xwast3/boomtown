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
import { build } from './build.mjs';

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
const url = (q) => 'file://' + file + '?' + q.filter(Boolean).join('&');

async function still(q, shot) {
  await page.goto(url(['t=99', ...pass, ...q]));
  await page.waitForFunction(() => window.__done === true, null, { timeout: 600000, polling: 250 });
  await page.evaluate(() => document.fonts.ready);
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
  await page.waitForFunction(() => window.__step && window.__step(0) > 0, null, { timeout: 600000, polling: 200 });
  for (let i = 0; i < 400 && !(await page.evaluate(() => document.documentElement.classList.contains('live'))); i++) { await page.evaluate(() => window.__step(0)); await page.waitForTimeout(50); }
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const gif = out.endsWith('.gif');
  const enc = gif
    ? ['-vf', `fps=${fps},split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, '-loop', '0']
    : ['-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...enc, out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(len * fps), dt = 1000 / fps, t0 = Date.now();
  for (let k = 0; k < Math.round(from * fps); k++) await page.evaluate((d) => window.__step(d), dt);
  for (let k = 0; k < N; k++) {
    await page.evaluate((d) => window.__step(d), dt);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94, timeout: 600000 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (k % fps === 0) process.stdout.write(`\r${(k / fps).toFixed(0)} / ${len} s  ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('\n' + path.relative(process.cwd(), out));
}
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
