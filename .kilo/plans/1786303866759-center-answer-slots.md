# Plan: Center Slots Precisely at 50% Viewport Height

## Goal
Center both single-row and multi-row answer slots at exactly the vertical middle (50%) of the screen, without changing the keyboard position or causing overlap.

## Current State
- `.mobile-slots-area` uses `flex: 1` + `justify-content: center`
- This centers slots within the expanded area, but that area starts below the word display, so the visual center is below the viewport center
- Multi-row uses `transform: translateY(-2rem)` to raise it, but this makes it too high
- Keyboard uses `position: sticky; bottom: 138px`

## Proposed Solution
Remove `flex: 1` from `.mobile-slots-area` and use margin-based centering instead. Add bottom padding to `.mobile-content` to prevent keyboard overlap.

## Changes

### 1. `public/mobile-styles.css` - `.mobile-slots-area`
Replace:
```css
.mobile-slots-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
}
```
With:
```css
.mobile-slots-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  margin-bottom: auto;
  min-height: 0;
  padding: 1rem 0;
}
```

### 2. `public/mobile-styles.css` - `.mobile-slots-area.multi-row`
Replace:
```css
.mobile-slots-area.multi-row {
  transform: translateY(-2rem);
}
```
With:
```css
.mobile-slots-area.multi-row {
  transform: none;
}
```

### 3. `public/mobile-styles.css` - `.mobile-content`
Add `padding-bottom` to ensure keyboard doesn't overlap:
```css
.mobile-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 1rem;
  gap: 1.5rem;
  overflow: visible;
  min-height: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-bottom: 320px;  /* add this - ensures keyboard has space */
}
```

### 4. `public/mobile-spell.html`
Update cache-busting query string:
```html
<link rel="stylesheet" href="/mobile-styles.css?v=22" />
```

## How It Works
- `.mobile-slots-area` with `margin-top: auto; margin-bottom: auto` takes equal available space above and below, centering it vertically in the parent
- `padding: 1rem 0` gives breathing room
- `.mobile-content` gets large `padding-bottom: 320px` to push the keyboard down and prevent overlap
- Both single-row and multi-row use the same centering mechanism (no transform differences)

## Validation
1. Single-row word should be exactly centered vertically on the page
2. Four-row word should also be centered at 50% viewport height
3. Keyboard should remain visible at the bottom without overlapping slots
4. Desktop view unchanged
