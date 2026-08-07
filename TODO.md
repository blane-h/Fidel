# TODO - Fix Enter button on Draw page

## Problem
Commit `b08c435` restructured `public/draw.html` and removed 3 DOM elements
that `public/draw.js` still references (`#drawHint`, `#statusMessage`,
`#completionMessage`). When Enter is clicked, `submitDrawing()` throws a
null-reference TypeError, so the correctness check never completes.

## Steps
- [x] 1. Identify removed elements (`drawHint`, `statusMessage`, `completionMessage`)
- [x] 2. Add `<p id="drawHint" class="prompt-hint" hidden></p>` into `.draw-word-row`
- [x] 3. Add `<p id="statusMessage" class="status"></p>` between `canvas-section` and `study-tools`
- [x] 4. Add `<div id="completionMessage" class="completion-message" hidden></div>` after `study-header`
- [x] 5. Verify: all 17 element IDs referenced in `draw.js` exist in `draw.html`

