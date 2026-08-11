# Fix Study Page Card Flip Animation

## Problem
On the Study page (`mobile-study.html`), when the flashcard is flipped (via the CSS `rotateY(180deg)` transition on `.mobile-card-inner`), mobile browsers briefly render the left half of the card as blank before the right half. This is a GPU compositing/rendering artifact common in mobile WebKit.

## Root Cause
The `.mobile-card` outer container carries unnecessary 3D and transition properties (`transform-style: preserve-3d` and `transition: transform 0.6s`) even though it never transforms itself. Combined with `display: flex`, this can cause the browser to create sub-optimal compositing layers during the child's 3D rotation, leading to the progressive "half blank" tearing.

## Plan
Edit `public/mobile-styles.css`:

1. **`.mobile-card`** — remove the unused `transform-style: preserve-3d` and `transition: transform 0.6s`. The outer card does not animate; only `.mobile-card-inner` does.
2. **`.mobile-card-face`** — add the vendor-prefixed `-webkit-backface-visibility: hidden` so Safari applies backface culling consistently during the rotation.
3. **`.mobile-card-inner`** — add `will-change: transform` to promote the flipping element to its own compositing layer, which eliminates tiled/partial rendering artifacts.

## File & Exact Changes
- **File**: `public/mobile-styles.css`

Before:
```css
.mobile-card {
  width: 100%;
  max-width: 300px;
  aspect-ratio: 3 / 4;
  background: #fff;
  border: 2px solid #ccc;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s;
}
```

After:
```css
.mobile-card {
  width: 100%;
  max-width: 300px;
  aspect-ratio: 3 / 4;
  background: #fff;
  border: 2px solid #ccc;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
}
```

Before:
```css
.mobile-card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
```

After:
```css
.mobile-card-face {
  position: absolute;
  inset: 0;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
```

Before:
```css
.mobile-card-inner {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s;
}
```

After:
```css
.mobile-card-inner {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s;
  will-change: transform;
}
```

## Validation
1. Open the mobile Study page on a mobile device or emulator.
2. Tap the flashcard to flip it.
3. Verify the entire card rotates smoothly with no blank sections appearing.
4. Verify the desktop `study.html` page is unaffected (it uses `styles.css`, not `mobile-styles.css`).

## Notes
- No JavaScript changes required.
- No new dependencies.
- The desktop study page (`styles.css`) uses a similar but separate flip setup and is not affected by this change.
