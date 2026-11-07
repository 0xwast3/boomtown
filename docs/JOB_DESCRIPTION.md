# Job description

Copy this file into your project. Tell Claude to read it before every house. When you correct Claude, the correction goes into this file, one line per mistake.

```
You build houses from a reference, in three.js, entirely in code, and raise them part by part in the boomtown terminal.

THE LOOK
- the terminal is fixed: the boomtown header, the frames bar, the clear-glass side panels, the dock; a house never restyles it
- every material painted in three flat tones (lit, x .84, x .58), deep and saturated; never pastel, never washed out
- ink on every edge that matters, fine lines for joints, seams, boards and ribs; lines straight, no wobble, no grain
- glass clear and blue-green with one quiet glint and two or three short reflection strokes
- timber orange, deck boards darker orange, steel near-black, cladding green, concrete cream, roofs dark; pick from the 13 materials, change a COLOR only to deepen it
- the house stands in the meadow: a plinth or platform the planting is laid out round, its own trees, a path to the front door

THE ORDER
1. Measure the reference first: footprint, storey heights, eave, ridge, roof pitch, bay spacing, glazing share per face. Write the numbers down in metres.
2. Write the checklist (docs/CHECKLIST.md) before the first line of code.
3. Plan 8 to 13 parts in the order a builder raises them: ground, structure, roof, envelope and glass, inside, fittings, outside, planting. One thing each.
4. Copy the model.js of the closest example and change the building, keep its helpers and timings.
5. Render the axo, the ground frame and the front at 1920 x 1080.
6. Grade every checklist line yes, partial or no against the reference, not against what you remember building.
7. Stop after round 2 and show me. Nothing gets filmed until I say yes.

THE PARTS
- every part: start and duration on one assembly clock (the whole house in about 8 to 9 s of model time; the terminal plays it in 1 s), an explode vector that lifts it clear, a view {az, el} that faces it, 1 to 3 named anchors
- the plinth and the planting are big parts (framed like the overview); survey marks are a site part
- labels: 6 to 10 at the overview spread over the whole house, the rest only in close-up; a figure (+6.91, H 1100) where a level or size matters
- the texts in English and Russian: a title in lower case, one sentence, a name, a label, a size, a material, a trade, a count and one note per part

THE CAMERA
- the first frame is the ground: the eye 1.6 m up on the meadow, the house filling the view
- the tour: 12 views, frames and parts alternating, never two parts from the same side in a row, from the roof down to the details and back to the ground
- every close-up faces its part from its own side and height: a dormer from its side, a roof from above, a door from low in front
- the camera never stops: one spline through all views, 24 s by the wall clock

THE SHOW
- the house builds in 1 s, then the tour; nothing waits, nothing eases slowly
- interaction is instant: a click flies in under a second, the wheel zooms 14% a notch
```

## Why these lines

- **"Grade against the reference"** keeps the self-check honest. Claude grades its own memory of the build as "yes" otherwise.
- **"Nothing gets filmed until I say yes"** keeps tokens from burning on a film of the wrong house.
- **"Never pastel"** came from a review where the whole house read as a washed-out sketch: "don't make the house's colours pale".
- **"Lines straight, no wobble"** came after a hand-drawn wobble looked like a rendering fault, not a style.
- **"The camera never stops"** came after a tour that parked at every frame: "the zoom thinks too long".
- **"The correction goes into this file"** is how house 5 stops repeating the mistakes of house 1.
