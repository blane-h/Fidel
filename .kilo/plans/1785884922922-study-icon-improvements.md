# Study Page Icon Improvements

## Problem
- Flip and shuffle buttons in the study page control bar are barely recognizable
- SVG icons do not clearly represent their actions
- CSS contains many duplicated `/* ===== Study Page ===== */` blocks
- `.icon-btn` size (44×44px) conflicts with SVG dimensions (32×32), causing alignment issues
- Inconsistent icons across spell, draw, and study pages

## Plan

### 1. Replace flip and shuffle SVGs with recognizable icons
- **Flip button**: Use the downloaded `/flip-icon.png` image (reverse/flip icon).
- **Shuffle button**: Use the downloaded `/shuffle-icon.png` image (crossing arrows).
- Keep viewBox="0 0 24 24" and set explicit `width="28" height="28"` or similar.
- Ensure `fill="currentColor"` so icons inherit text color.

### 2. Fix `.control-btn` sizing and alignment
- Add explicit `width: 48px; height: 48px;` to `.control-btn` (or `.icon-btn`) so icons have consistent touch targets.
- Add `display: inline-flex; align-items: center; justify-content: center;` to center SVGs.
- Increase SVG size to `width="28" height="28"` for better visibility.

### 3. Clean up duplicate CSS in `styles.css`
- Remove all duplicate `/* ===== Study Page ===== */` blocks (lines 655–743, 914–1020, 1021–1167, 1168–1343, 1344–1513, 1514–1683, 1684–1853, 1854–2000+).
- Keep only the most recent/complete set of study-page rules.
- Verify no orphaned selectors remain.

### 4. Add hover/active visual feedback
- `.control-btn:hover` already exists; ensure it uses a visible background (e.g., `#f0f0f0` or `rgba(0,0,0,0.06)`).
- Add `.control-btn:active` scale or darker background for tactile feedback.

### 5. Propagate icons to other pages
- **Spell page (`index.html`)**: Replace fidel toggle SVG with the same `/flip-icon.png` reverse icon used on study page.
- **Spell page (`index.html`)**: Replace sound button emoji `🔊` with the study page sound SVG.
- **Draw page (`draw.html`)**: Replace sound button emoji `🔊` with the study page sound SVG.
- **Draw page (`draw.html`)**: Replace shuffle button SVG with `/shuffle-icon.png` image.

### 6. Verify in browser
- Confirm flip button clearly shows a reversible/flip action.
- Confirm shuffle button clearly shows crossing arrows.
- Confirm all four control icons (cycle, flip, sound, shuffle) are uniformly sized and aligned.
- Confirm no layout shift or SVG clipping.

## Out of Scope
- Changing overall study page layout or figma-matched icon positions
- Modifying `study.js` behavior
