# Fidel Training Page Refactor


## Task
Refactor the training page (draw mode) to be cleaner and more similar to the drawing pages, including using icons.

## Information Gathered
- **train.html** currently uses a `prompt-area` (swap/prev/next/sound text buttons) and a `draw-tools` row with text buttons (✏️, Clear, Correct, Incorrect, Skip).
- **draw.html** is the reference "drawing page": it uses a `draw-controls` row with SVG icon buttons (cycle, trace, sound, shuffle), a `canvas-section` with a drawing frame and canvas arrows, a `status` message, and `study-tools` with Clear/Enter buttons.
- **styles.css** already defines `.draw-controls`, `.draw-controls-icon`, `.draw-word-row`, `.canvas-section`, `.drawing-frame`, `.study-tools`, `.tool-btn` (success/danger/primary), and `.control-btn` styles used by the draw page.
- Available icons: `public/flip-icon.png`, `public/shuffle-icon.png`; draw page uses inline SVGs.

## Plan
1. **train.html** — Restructure the draw-mode section to mirror the draw page layout:
- Replace the `prompt-area` with a `draw-controls` row containing icon buttons (swap ⇄, trace pencil SVG, prev ◀, next ▶, sound speaker SVG).
   - Wrap the prompt (`h2` + hint) in a `draw-word-row` between the prev/next arrows.
   - Move the reference canvas into the `canvas-section` beside the drawing frame.
   - Replace `draw-tools` with a `study-tools` row using Clear / ✓ Correct / ✗ Incorrect / Skip tool buttons.
2. **styles.css** — Add/refine styles so the train draw mode reuses the draw page's `.draw-controls`, `.draw-word-row`, `.canvas-section`, `.drawing-frame`, `.study-tools`, and `.tool-btn` rules. Add a `.reference-frame`/`.reference-label` style for the reference canvas.
3. **train.js** — No logic changes required; element IDs are preserved. Only ensure the new icon buttons keep the same IDs (`swapBtn`, `traceBtn`, `prevBtn`, `nextBtn`, `soundBtn`, `clearBtn`, `correctBtn`, `incorrectBtn`, `skipBtn`, `drawPrompt`, `drawHint`, `referenceCanvas`).

## Dependent Files to be Edited
- `public/train.html`
- `public/styles.css`

## Followup Steps
- Open the train page in a browser to verify the refactored layout renders correctly and all buttons still work.

## Progress
- [x] Review train.html / draw.html / styles.css
- [x] Refactor train.html draw-mode structure
- [x] Update styles.css for the new layout
- [x] Verify in browser
- [x] Make study page card prev/next arrows match draw page canvas arrow size
- [x] Enlarge canvas-arrow button background to fit the larger arrow size
- [x] Backtrack in study/draw page stops at first vowel instead of wrapping
- [x] Backtracking at vowel 0 does not replay the sound
- [x] Fixed study page not rendering (removed duplicate const declaration, removed flipBtn reference to non-existent element, declared missing state vars)
