# Study Page Mobile Vertical Centering

## Goal
In mobile view only, shift all elements on the Study page downward so the content appears more vertically centered between the top of the screen and the bottom navigation tabs. Do not move or modify the bottom navigation tabs.

## Current State
- `mobile-study.html` uses `<main class="mobile-page">` with no extra page-specific class.
- `mobile-draw.html` uses `<main class="mobile-page mobile-draw-page">`.
- `mobile-spell.html` uses `<main class="mobile-page mobile-spell-page">`.
- In `mobile-styles.css`, both `.mobile-page.mobile-draw-page` and `.mobile-page.mobile-spell-page` set `padding-top: 2rem`.
- The Study page currently has no top padding override, so it inherits `.mobile-page { padding: 0.5rem 0; }` and starts content almost immediately below the header.

## Plan
1. **Edit `public/mobile-study.html`**
   - Add `mobile-study-page` to the `<main>` element's class list.
   - Change `<main class="mobile-page">` to `<main class="mobile-page mobile-study-page">`.

2. **Edit `public/mobile-styles.css`**
   - Add a new rule after the existing draw/spell page rules:
     ```css
     .mobile-page.mobile-study-page {
       padding-top: 2rem;
     }
     ```
   - This matches the pattern already used by the Draw and Spell pages and shifts the Study page content downward to feel more vertically centered.

## Validation
- Open `mobile-study.html` in a mobile viewport (DevTools device emulation).
- Verify the consonant section, controls row, flashcard, and bottom nav are all shifted downward by ~1.5rem compared to current.
- Verify the fixed `.mobile-bottom-tab-bar` is unchanged.
- Verify Draw and Spell pages are unaffected.
- Verify scrolling still works when content overflows.

## Notes
- No JavaScript changes are required.
- The `2rem` value is consistent with the existing Draw/Spell pages. If the design calls for a more pronounced shift, this value can be increased (e.g., `2.5rem` or `3rem`).
