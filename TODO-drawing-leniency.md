 # TODO — Make drawing correctness more lenient (shape-tolerant)

## public/draw.js — Local comparison changes
- [x] Dilate BOTH the drawing and the reference before comparing (stroke-thickness tolerant).
- [x] Add a Chamfer distance-based shape similarity (`distanceTransform` + `distanceSimilarity`).
- [x] Accept a match if pixel overlap is high OR distance similarity is high.
- [x] Reject only if BOTH metrics are clearly low.
- [x] Keep ambiguous cases going to Gemini for strict identity checks.

## README.md
- [x] Update threshold / behavior documentation to reflect the lenient-but-identity-safe logic.

## Follow-up
- [x] Syntax check (`node --check public/draw.js`).
- [ ] Restart server and test: correct-but-imperfect drawing → correct; different-but-similar fidel → rejected; blank/scribble → still rejected locally.
