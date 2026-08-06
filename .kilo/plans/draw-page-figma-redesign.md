# Draw Page Layout Refinement

## Problem
- Draw page has too much vertical whitespace
- Canvas is not vertically centered on screen
- Shuffle, sound, and trace icons are too far from the displayed word
- Need more padding between icon row and canvas
- Trace icon needs to be horizontally mirrored

## Plan

### 1. Adjust draw page spacing and centering
- Reduce `.draw-page` padding and grid gap further
- Add `flex: 1` and `min-height: 0` to `.canvas-section` so it expands to fill available vertical space
- Use `align-items: center` on `.canvas-section` to vertically center the canvas within that expanded area

### 2. Tighten icon spacing around the word
- Reduce `.draw-controls` gap between icon groups
- Reduce `.draw-controls-right` gap between sound and trace icons
- Keep the existing grouped layout: shuffle (left), flip+word (center), sound+trace (right)

### 3. Add padding between controls and canvas
- Increase `.canvas-section` top/bottom padding to create visual separation
- Keep canvas arrows positioned on left/right of the drawing frame

### 4. Update responsive breakpoints
- Ensure mobile layout remains usable with tighter spacing
- Reduce canvas max-width on mobile if needed

### 5. Trace icon horizontal mirror
- Apply CSS `transform: scaleX(-1)` to the trace button SVG
- This mirrors the pencil/edit icon across the Y-axis
- Add selector `#traceBtn svg { transform: scaleX(-1); }` or `.trace-icon-flipped` class

## Open Questions
- None

## Out of Scope
- Changing button functionality
- Modifying draw.js logic
- Altering study page
