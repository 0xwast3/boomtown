# Prompts

Every prompt in the order you use them. Replace the parts in [brackets].

## 1. The reference picture

If the user has no photo, render or plan, generate one with ChatGPT or any image model:

```
An architectural axonometric render of a [modern A-frame cabin on a timber platform in a forest clearing],
whole building in frame, seen from the front left and a little above.
Clear materials: [glulam ribs, standing-seam black roof, a fully glazed front gable, a stone chimney].
Bright daylight, saturated natural colours, clean straight edges, no people, no text.
```

Or write the brief as numbers instead of a picture: footprint, storeys, eave and ridge, roof type and pitch, materials per face, the signature feature, what stands outside.

## 2. The first build

```
Read SKILL.md and docs/JOB_DESCRIPTION.md. Here is the reference: [picture or brief].
Measure it and write the numbers down, then write the checklist (docs/CHECKLIST.md).
Plan 8 to 13 parts in build order. Copy models/[closest example]/model.js to ./[name]/model.js and build the house.
Render the axo, the ground frame and the front. Grade every checklist line yes, partial or no.
```

## 3. The still loop

```
Loop on [name]:
1. Build it and render --frame axoL, the ground frame and --frame front.
2. Grade every checklist line yes, partial or no, one line each, against the reference.
3. Check the numbers: footprint, eave, ridge, pitch.
4. Fix the no's, then the partials.
Stop after round 2 and show me the stills and the grades. Wait for my notes before round 3.
```

## 4. Close-ups and labels

```
Render --focus for every part and --explode 1. For each part: does the close-up face it from its own side,
does every label sit clear of its part, does the part lift clear when exploded? Fix the views and anchors.
```

## 5. The show and the film

```
Write META.tour: 12 views, frames and parts alternating, never two parts from the same side in a row, ending on f:eye.
Render --sheet and read every tile. Then render the film: --film --fps 30 --out boomtown-out/[name].mp4.
```

## 6. A correction

```
[What is wrong, in one sentence]. Fix it, then add one line to docs/JOB_DESCRIPTION.md and one row to docs/LESSONS.md.
```
