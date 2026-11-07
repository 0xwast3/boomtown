---
name: boomtown
description: Build any house or building as a 3D model written entirely in code and raise it part by part inside the boomtown construction terminal - a single offline HTML page with a red-violet ink look, exact camera frames, zoom, explode, x-ray, sections, labels and a 24-second camera show, plus stills, review sheets and an mp4 of the show. Use when someone asks to build, model, draw or film a house, cabin, barn, tower, pavilion or any building in 3D; gives a photo, render, sketch or plan of one and wants it rebuilt; or asks for "boomtown", a "construction terminal", an "assembly film" or "a house that builds itself".
---

# boomtown

One house in, one terminal out. Claude writes the building in code, part by part: the deck, the frame, the roof, the glass, the stair, the trees. The terminal draws it on in ink, colours it in flat saturated tones, stands it in a meadow and then tours it: every frame, every part close up, back down to the ground. The same page renders the stills and the film.

`SKILL_DIR` below is the folder this file lives in. Builds and renders go to `./boomtown-out` of the folder you run from.

## First run

```
cd "$SKILL_DIR" && npm install && npx playwright install chromium
```

The pages need nothing else and open from disk. The film needs `ffmpeg` on PATH. Set `CHROMIUM` (or `FFMPEG`) to use another binary; in a cloud container with Chromium preinstalled set `CHROMIUM` to it instead of installing a second one.

## The 6 examples

Build one, open the HTML, watch it raise itself. Start a new house from the example whose body is closest.

| | The building | Its parts | Worth stealing |
|---|---|---|---|
| `deck-house` | A timber deck with container modules, a glazed two-storey core, a penthouse, a roof garden and a pergola. | 13: deck, studio, kiosk, core, walkway, stair, penthouse, garden, rooftop pergola, solar, pergola, pavilion, trees. | Boxes on a footprint: `side()` + `wallM()` walls, curtain walls with `glaze()`, a straight steel stair, a big site. |
| `a-frame` | A steep A-frame cabin on a platform: glulam ribs, a standing-seam roof, a glass gable, a loft, a dormer, a stone chimney, a hot tub. | 11: platform, frame, roof, gable, loft, dormer, chimney, porch, hot tub, woodshed, clearing. | Sloped planes: a `slope(side, u, z, d)` mapper, glass clipped to a slope, triangles, round things (`cylinder`, `log`). |
| `glass-barn` | A long gabled barn with a glazed south side, board gables, a grain silo turned stair tower, a greenhouse, a pool and a carport. | 11: plinth, bents, roof, facade, gables, barn door, silo, greenhouse, pool, carport, garden. | Portal frames on a grid, a gable roof `rs()` mapper, a cone, a glass bridge, a lean-to. |
| `stack` | Shipping containers stacked on three levels, the top ones cantilevered, an outside steel stair, a roof deck with solar. | Containers, cantilevers, a V-column, terraces. | A `container()` maker, parts that slide out along their explode vector (`lift`). |
| `tower` | A tall narrow tower house: a brick and concrete base, floors turned a few degrees each, a spiral stair, a roof terrace with a pergola. | A podium, turned floors, the spiral, the terrace. | Rotated floor plates, a `spiral()` stair, brick. |
| `stilt` | A charred-timber cabin on larch piles with a wrap-around deck, a ramp, a sauna barrel and a water tank. | Piles, platform, cabin, roof, deck, ramp, sauna, tank. | Piles on uneven ground, a barrel, a mono-pitch roof. |

```
node "$SKILL_DIR/tools/build.mjs" a-frame           # → boomtown-out/a-frame.html, offline, ~1 MB
node "$SKILL_DIR/tools/build.mjs"                   # all of them
```

## The method

The 4 files in `docs/` are the method. Read them before the first house, and keep `docs/JOB_DESCRIPTION.md` open the whole time.

| File | What it holds |
|---|---|
| `docs/JOB_DESCRIPTION.md` | The brief: the look, the order of work, the parts, the camera, the show. Every correction the user gives goes into it, one line per mistake. |
| `docs/CHECKLIST.md` | How to write 10 to 12 numbered lines on what one house stands on, a template and a full example. |
| `docs/PROMPTS.md` | Every prompt, from the reference picture to the film. |
| `docs/LESSONS.md` | Every mistake so far and the line it added to the brief. |

The order, every time:

1. **The reference.** A photo, render, sketch or plan of the house, or the user's words. If there is no picture, generate one with the prompt in `docs/PROMPTS.md` or write the brief as numbers. It sets the building and nothing else: never import it, rebuild it.
2. **Measure it.** Footprint (width × depth), storey heights, eave and ridge, roof pitch, bay spacing, glazing share of each face. Metres, written down before any code.
3. **Write the checklist** for this house before the first line of code.
4. **Plan the parts.** 8 to 13 parts in the order a builder would raise them: ground, structure, envelope, glass, fittings, outside, planting. Each gets a start time, a duration, an explode vector, a close-up view and 1 to 3 named anchors for labels.
5. **The still loop.** Build, render `--frame axoL`, the ground frame and `--frame front`, grade every checklist line yes / partial / no against the reference. **Stop after round 2 and show the user.** Nothing gets filmed until they say yes.
6. **The show.** Write `META.tour`: 12 views, frames and parts alternating, never two parts from the same side in a row, ending on `f:eye`. Check it with `--sheet`.
7. **Render.** The film, then read the sheet of the final render.

## How a house is built

One folder per house with one file, `model.js`. The examples follow this exactly:

| Export | Job |
|---|---|
| `build()` | Returns the parts. Each part is a `Part` from `boomtown/kit.js`: boxes, quads, triangles, members between two points, glass panes, ink lines and fine lines, foliage balls, each tagged with one of 13 materials. Shapes from `boomtown/shapes.js`: walls on a footprint, cladding, glazing, sliders, railings, stairs, planters, trees, shrubs, cylinders, logs. |
| `CALLOUTS` | The labels: part, anchor, text key, an optional figure (`+6.91`, `H 1100`), shown at the overview (`o: true`) or only in close-up. |
| `ORDER`, `PART`, `LEVELS` | The list on the left (order of assembly), each part's code, elevation, mass and count, the levels the inspector snaps to. |
| `TEXT` | English and Russian: title, one-line description, part names, labels, level names, the inspector's rows and note for every part, three overview figures. |
| `META` | How the terminal treats this house: part code prefix, the plinth the meadow is laid out round (`lot`), where the path arrives, the house's own trees, walls ivy climbs, the height shown at the overview, the section cuts, the 24 s show, where the eye stands. |

Part flags: `site: true` for survey marks (never framed), `big: true` for parts spanning the whole lot (framed like the overview), `planting: true` for trees and planters (they thin out when a part is studied), `faint: true` for paler fine lines (deck boards).

Materials (`kit.js`, `COLOR`): `paper` `timber` `deck` `steel` `clad` `concrete` `soil` `leaf` `leaf2` `solar` `fabric` `dark` `bark` `blue` `brick` `yellow`, plus glass through `glassQuad`. Each is painted in three flat tones (lit, ×.84, ×.58). Change a colour in `COLOR`, never pale it.

For a house outside `SKILL_DIR`, make a folder with a `model.js` and import the kit by name:

```js
import * as THREE from 'three';
import { Part, V, rng } from 'boomtown/kit.js';
import { side, wallM, glaze, clad, railing, stair, tree, cylinder } from 'boomtown/shapes.js';
```

Build it with `node "$SKILL_DIR/tools/build.mjs" ./my-house`. The elevation and key plan on the inspector card are drawn from the geometry; you never draw them.

## Rules that decide whether it works

1. **Start from the reference, never from imagination.** Asked for "a cabin" with nothing to match, the model returns a generic box with a triangle on top. With measurements and a checklist it rebuilds what is in front of it.
2. **Port the closest example.** Copy its `model.js`, keep its helpers, timings and tour shape, change the building. A new building on a new structure of parts is twice the rounds.
3. **Measure, don't eyeball.** Write the footprint, heights and pitch as numbers first; check the axo still against them. A roof 20% too low passes every feature line and still reads wrong.
4. **Parts a builder would recognise.** 8 to 13 of them, each one thing you could point at on site. A part that is "misc details" never gets a good close-up.
5. **Saturated, straight, clean.** Colours deep and full (never pastel or washed out), lines straight (no wobble, no grain), glass clear with one glint. The terminal's look is fixed; the house brings its own materials, not a new style.
6. **Every view its own camera.** The tour alternates frames and parts and never visits two parts from the same side in a row. Give each part a `view: { az, el }` that faces it: a dormer from its own side, a roof from above, a door from low in front.
7. **Review after round 2.** A note after round 2 changes the outcome; after round 6 it only costs tokens.

## The terminal

The page around every house is fixed and comes from `terminal/`: the boomtown header (Blender | Claude, chapters · wordmark · about, en / ru), the frames bar (GROUND, AXO L, AXO R, TOP, FRONT, BACK, SIDE, turntable, zoom), the parts list and drawing card on the left, the inspector with elevation, key plan, materials and figures on the right, the assembly card, the dock (overview, explode, x-ray, cut A-A, plan, colour, labels, tour). It is designed for a 1920 × 1080 screen. Don't restyle it per house; a house changes only `models/<name>/model.js`.

What it does with any house: draws each part on in red-violet ink while it rises into place, paints it, stands it in a meadow with trees, ferns and a sky, opens on the ground frame, builds the house in 1 second, then flies one unbroken 24-second spline through `META.tour` and back down to the ground. Click a part to fly to it; drag, scroll and right-drag to orbit, zoom and pan. Keys: `E` explode, `X` x-ray, `S` section, `P` plan, `C` colour, `L` labels, `T` tour, `O` overview, `R` replay, `1`-`9` parts.

## Commands

```
node "$SKILL_DIR/tools/build.mjs" a-frame
node "$SKILL_DIR/tools/capture.mjs" a-frame --still --frame axoL --out boomtown-out/a-frame-axo.png
node "$SKILL_DIR/tools/capture.mjs" a-frame --still --out boomtown-out/a-frame-ground.png
node "$SKILL_DIR/tools/capture.mjs" a-frame --still --focus dormer --out boomtown-out/a-frame-dormer.png
node "$SKILL_DIR/tools/capture.mjs" a-frame --still --show 9.5 --out boomtown-out/a-frame-9.5.png
node "$SKILL_DIR/tools/capture.mjs" a-frame --sheet --out boomtown-out/a-frame-sheet.png
node "$SKILL_DIR/tools/capture.mjs" a-frame --film --fps 30 --out boomtown-out/a-frame.mp4
node "$SKILL_DIR/tools/capture.mjs" a-frame --film --fps 12 --size 960x540 --out boomtown-out/a-frame.gif
```

`--size` is the CSS layout (default 1920x1080, the terminal's own size) and `--dpr` multiplies it. A film runs the page on a virtual clock, so every frame is exact however slow the machine: on a GPU a 30 fps 1080p film takes minutes, on a software renderer much longer, so review with stills and sheets and film once. Other flags go straight into the page: `--explode 1`, `--xray 1`, `--cut section|plan`, `--paint 0` (the line drawing), `--lang ru`, `--labels 0`.

## Review loop

You cannot watch the page; you can look at frames. Never report a house as done without reading stills of the current build.

1. `--still --frame axoL`, the ground frame and `--frame front`: the whole house, three ways.
2. Read each against the checklist and the measured numbers.
3. `--still --focus <part>` for every part: does its close-up face it, are its labels clear of it?
4. `--still --explode 1`: does every part lift clear of the rest?
5. `--sheet`: 12 tiles through the show. No two neighbouring tiles from the same side; the house never leaves the frame.
6. Fix, rebuild, go back to 1. Stop when a full pass finds nothing.

Checklist:

- **The house.** Every part sits on what carries it; nothing floats, nothing passes through anything; glass never overlaps a solid face at the same depth (it flickers).
- **Proportions.** Footprint, eave, ridge and pitch match the numbers written in step 2.
- **The look.** Colours saturated, never pale; every material reads as itself in three tones; ink lines on every edge that matters, fine lines for joints and seams.
- **Labels.** Overview labels (`o: true`) name 6 to 10 things across the whole house; close-up labels name details. A label never covers its own part.
- **Camera.** Every `view` faces its part; the tour reads as one move, not a slideshow.

## three.js traps the examples already hit

- A quad is one-sided: wind it counter-clockwise seen from where it should show, or it vanishes from that side (`box` and the shapes already do this).
- A roof surface and a purlin at the same offset fight: keep structure at least 0.1 m under the roof skin.
- Glass and a solid face at the same depth flicker: set glass 1 to 6 cm in front of a frame, never on it.
- Geometry is merged per part and per material, so thousands of boxes are cheap; thousands of parts are not. Keep to 8 to 13 parts.
