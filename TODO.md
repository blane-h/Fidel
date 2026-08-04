# TODO

## Plan Steps

### Fix: Tune accuracy/correctness logic for the drawing page

#### public/draw.js — Make the local comparison robust and conservative
- [x] Add `normalizeGrid()` that centers ink by bounding box and scales it to a fixed normalized size (position/size invariant).
- [x] Add `dilate()` to grow the reference glyph by 1px so slightly thicker/stroke-offset drawings still overlap.
- [x] Apply normalization + dilation in `localCompare()`.
- [x] Lower `LOW_MATCH_THRESHOLD` to ~0.30 so only obviously-wrong drawings are rejected locally; borderline (incl. correct-but-imperfect) drawings go to Gemini.
- [x] Keep `HIGH_MATCH_THRESHOLD` (~0.72) for confident local accepts.
- [x] Log the similarity score to the browser console for threshold tuning.

#### server.js — Rebalance the Gemini prompt
- [x] Rewrite `RECOGNIZE_PROMPT` to be learner-friendly on penmanship (accept wobble, uneven weight, imperfect proportions, tilt) but strict on identity (reject different fidel, missing/added distinguishing features, unreadable scribbles).
- [x] Ask Gemini to return `match` plus a `confidence` (0–1).
- [x] Parse `confidence` in `generateWithGemini()` and surface it in the API response (keep existing `match` parsing working).

#### Preserved unchanged
- [x] In-memory cache, model fallback, 256px downscaling, 1.2s cooldown, blank/too-small/single-stroke validation.

## Follow-up
- [x] Syntax check (`node --check server.js` and `node --check public/draw.js`).
- [ ] Restart server and test: correct-but-imperfect drawing → correct; similar-looking-but-wrong fidel → rejected; scribble/blank → still rejected locally.
