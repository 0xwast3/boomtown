#!/usr/bin/env node
// Build one model into one offline HTML file: the terminal page, its fonts and pictures, three.js and the model.
//
//   node tools/build.mjs deck-house                 # a model in models/
//   node tools/build.mjs ./my-house                 # any folder with a model.js
//   node tools/build.mjs ./my-house --out out.html
//   node tools/build.mjs                            # every model in models/
//
// Output: ./boomtown-out/<name>.html (from the folder you run in). Inside a model, import the kit by name:
//   import { Part, V, rng } from 'boomtown/kit.js';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TERM = path.join(ROOT, 'terminal');
const A = (f) => path.join(TERM, 'assets', f);
const b64 = (f) => fs.readFileSync(A(f)).toString('base64');

function findModel(arg) {
  for (const c of [arg, path.join(ROOT, 'models', arg)]) {
    const p = path.resolve(c);
    if (fs.existsSync(path.join(p, 'model.js'))) return p;
  }
  throw new Error(`no model.js in "${arg}" or in models/${arg}`);
}

// The @0xwast3 mark: the author's credit and the one condition of the licence (LICENSE). The build stops if the mark,
// the code that draws it or the call that puts it on the page has been changed or taken out.
const MARK_SUM = {
  'terminal/assets/mark.svg': '4f7c091fe6d4412ee54585b07d17db40b52805ee3508471f0ca4799e99e3aa07',
  'terminal/src/mark.js': '7e15a3d608969b2e8ff31facf889cb9ab4380d4030c33ca6b6d960aa94cada75',
};
const markFail = (why) => {
  throw new Error(`the @0xwast3 mark: ${why}.\nEvery page, picture and film made with boomtown carries the @0xwast3 mark; it is the condition of the licence (LICENSE).`
    + '\nRestore the file from github.com/0xwast3/boomtown and build again.');
};
function checkMark(html, app) {
  for (const [f, sum] of Object.entries(MARK_SUM)) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) markFail(`${f} is missing`);
    if (crypto.createHash('sha256').update(fs.readFileSync(p, 'utf8').replace(/\r/g, '')).digest('hex') !== sum) markFail(`${f} has been changed`);
  }
  const main = fs.readFileSync(path.join(TERM, 'src', 'main.js'), 'utf8');
  if (!/^import \{ installMark \} from '\.\/mark\.js';$/m.test(main) || !/^import MARK_SVG from '\.\.\/assets\/mark\.svg';$/m.test(main)
    || !/^installMark\(MARK_SVG, \{ still: STILL, reduced: REDUCED \}\);$/m.test(main)) markFail('terminal/src/main.js no longer puts it on the page');
  if (!app.includes('bt-mark-0xwast3') || !app.includes('@0xwast3') || !app.includes('10 -711 5470 851')) markFail('the app has no mark');
  if (!html.includes('<meta name="author" content="@0xwast3">') || !html.includes('made with boomtown by @0xwast3')) markFail('terminal/template.html has lost its credit');
}

const plugin = (dir) => ({
  name: 'boomtown',
  setup(b) {
    b.onResolve({ filter: /^boomtown-model$/ }, () => ({ path: path.join(dir, 'model.js') }));
    b.onResolve({ filter: /^boomtown\// }, (a) => ({ path: path.join(TERM, 'src', a.path.slice(9)) }));
  },
});
const common = (dir) => ({ bundle: true, plugins: [plugin(dir)], loader: { '.svg': 'text' }, nodePaths: [path.join(ROOT, 'node_modules')], logLevel: 'error', legalComments: 'none' });

export async function build(arg, out) {
  const dir = findModel(arg), name = path.basename(dir);
  // the model's own texts and numbers, for the static page (the app sets them again at runtime)
  const tmp = path.join(ROOT, 'node_modules', '.boomtown', name + '-meta.mjs');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  await esbuild.build({ ...common(dir), stdin: { contents: "export { META, TEXT, ORDER } from 'boomtown-model';", resolveDir: dir }, platform: 'node', format: 'esm', outfile: tmp });
  const { META, TEXT, ORDER } = await import(pathToFileURL(tmp).href + '?' + Date.now());
  const app = (await esbuild.build({ ...common(dir), entryPoints: [path.join(TERM, 'src', 'main.js')], format: 'iife', minify: true, target: 'es2020', write: false })).outputFiles[0].text;
  if (/<\/script/i.test(app)) throw new Error('bundle contains a closing script tag');

  const bpath = fs.readFileSync(A('wordmark-b.txt'), 'utf8').trim();
  const fav = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e43a33'/>"
    + "<stop offset='.55' stop-color='#c8336f'/><stop offset='1' stop-color='#7c22a0'/></linearGradient></defs><rect width='1000' height='1000' rx='230' fill='url(#g)'/>"
    + `<path transform='translate(500 500) scale(1.02) translate(-284.5 360)' fill='#fff8f6' d='${bpath}'/></svg>`;
  const grain = "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n' x='0' y='0' width='100%' height='100%'>"
    + "<feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' seed='7' stitchTiles='stitch'/>"
    + "<feColorMatrix values='0 0 0 0 .40  0 0 0 0 .30  0 0 0 0 .34  .95 0 0 0 -.40'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const ui = TEXT.en.ui || {};
  const rep = {
    '%%FONT_INTER%%': b64('inter600.woff2'), '%%FONT_FREDOKA%%': b64('fredoka600.woff2'), '%%FONT_NUNITO%%': b64('nunito800-cyr.woff2'),
    '%%FONT_INTERTEXT%%': b64('intertext.woff2'), '%%FONT_MONO_LAT%%': b64('jbmono-latin.woff2'), '%%FONT_MONO_CYR%%': b64('jbmono-cyrillic.woff2'),
    '%%ICON_BLENDER%%': b64('blender_icon.png'), '%%ICON_CLAUDE%%': b64('claude_icon.png'), '%%GRAD%%': b64('grad.jpg'),
    '%%WORDMARK%%': fs.readFileSync(A('wordmark.svg'), 'utf8'),
    '%%FAVICON%%': Buffer.from(fav).toString('base64'), '%%GRAIN_FINE%%': Buffer.from(grain).toString('base64'),
    '%%TITLE%%': esc(ui.title || name), '%%SUB%%': esc(ui.sub || ''), '%%DRAWINGV%%': esc(ui.drawingV || (ui.title || name) + ' · axonometric'),
    '%%CODE%%': esc(META.code || 'BT'), '%%NPARTS%%': String(ORDER.length), '%%TOP%%': '+' + (META.top ?? 0).toFixed(2),
  };
  let html = fs.readFileSync(path.join(TERM, 'template.html'), 'utf8');
  for (const [k, v] of Object.entries(rep)) { if (!html.includes(k)) throw new Error('template has no ' + k); html = html.split(k).join(v); }
  html = html.replace('%%APP%%', () => app);   // last: the bundle itself may hold %% sequences
  checkMark(html, app);
  const left = html.split('<script>\n')[0].match(/%%[A-Z_]+%%/g);
  if (left) throw new Error('unfilled: ' + left.join(' '));
  out = path.resolve(out || path.join('boomtown-out', name + '.html'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${path.relative(process.cwd(), out)}  ${(html.length / 1024).toFixed(0)} KB`);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), o = args.indexOf('--out');
  const out = o >= 0 ? args.splice(o, 2)[1] : null;
  const list = args.length ? args : fs.readdirSync(path.join(ROOT, 'models')).filter((d) => fs.existsSync(path.join(ROOT, 'models', d, 'model.js')));
  for (const m of list) await build(m, list.length === 1 ? out : null);
}
