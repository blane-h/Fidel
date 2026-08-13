# Mobile Safari Viewport Fix Plan

## Problem
On Safari (iOS), the dynamic browser toolbar and bottom tab bar change the available viewport height during scrolling. Elements positioned with fixed pixel values or `100vh` overlap each other because the layout doesn't adapt to Safari's changing viewport.

## Root Causes (from code analysis)

| # | File:Line | Issue | Impact |
|---|-----------|-------|--------|
| 1 | `mobile-styles.css:194-195` | `height: 100dvh` is overridden by `height: 100vh` (later declaration wins) | Page container uses static `vh`, not dynamic `dvh`; height doesn't shrink when Safari toolbars collapse |
| 2 | `mobile-spell.html:5`, `mobile-draw.html:5`, `mobile-study.html:5` | Missing `viewport-fit=cover` in meta viewport | `env(safe-area-inset-*)` returns 0, layout can't extend into safe areas |
| 3 | `mobile-styles.css:1102-1103` | `.mobile-bottom-tab-bar` uses `bottom: 2.05rem` without safe-area compensation | Bottom tab bar overlaps page content when Safari's tab bar is visible |
| 4 | `mobile-styles.css:672` | `#mobileStatusMessage` uses hardcoded `bottom: 340px` | Status message position is wrong on any screen size other than the one it was designed for |
| 5 | `mobile-styles.css:681` | `.mobile-keyboard-wrapper` uses `bottom: 110px` | No safe-area or dynamic toolbar compensation |
| 6 | `mobile-styles.css:386` | `.mobile-card-area` uses `max-height: 50vh` | Uses static `vh` instead of `dvh`; doesn't adapt to Safari's dynamic viewport |

## Fix Plan

### Phase 1: Viewport Units (Critical)

**1a.** Fix `.mobile-page` height declaration order — remove the `100vh` override and use the proper fallback chain:
```css
.mobile-page {
  height: 100vh;          /* fallback for older browsers */
  height: 100svh;         /* standard dynamic small viewport */
  height: 100dvh;         /* supported dynamic viewport height */
}
```

**1b.** Fix `.mobile-card-area` `max-height` from `50vh` to `50dvh`.

### Phase 2: Safe Area Insets (Critical)

**2a.** Add `viewport-fit=cover` to the meta viewport tag in all three mobile HTML files:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

**2b.** Fix `.mobile-bottom-tab-bar` — use `env(safe-area-inset-bottom)` for bottom positioning:
```css
.mobile-bottom-tab-bar {
  bottom: calc(2.05rem + env(safe-area-inset-bottom, 0px));
}
```

**2c.** Fix `.mobile-keyboard-wrapper` — account for bottom tab bar + safe area:
```css
.mobile-keyboard-wrapper {
  bottom: calc(110px + env(safe-area-inset-bottom, 0px));
}
```

**2d.** Fix `#mobileStatusMessage` — replace hardcoded `bottom: 340px` with a relative value that uses `dvh`:
```css
#mobileStatusMessage {
  bottom: calc(100dvh - 340px);  /* position relative to viewport height */
}
```
Or better: use `top`-based positioning relative to the keyboard area instead of fixed bottom offset.

### Phase 3: Dynamic Viewport JS Fallback

**3a.** Add a small JS snippet to set a custom `--vh` CSS variable that tracks `window.innerHeight` in real-time. This provides a JavaScript-based fallback that works even on Safari versions that don't fully support `dvh`:
```js
function setViewportProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setViewportProperty);
window.addEventListener('orientationchange', setViewportProperty);
setViewportProperty();
```
Then use `height: calc(var(--vh, 1vh) * 100)` as an additional fallback.

### Phase 4: Testing Matrix

| Device | Browser Bar State | Expected Behavior |
|--------|------------------|-------------------|
| iPhone SE (390×844) | Bars visible | No overlapping content; bottom tab bar above safe area |
| iPhone SE (390×844) | Bars collapsed | Content expands; bottom tab bar stays positioned |
| iPhone 14 Pro (393×852) | Bars visible | Same as above, different dimensions |
| iPhone 14 Pro (393×852) | Bars collapsed + notched safe area | No overlap with notch or home indicator |
| iPhone 15 Pro Max (430×932) | Bars visible/collapsed | Layout scales proportionally |
| On-screen keyboard visible | Keyboard pushes content | Keyboard wrapper and status message stay above keyboard |

## Implementation Order
1. Add `viewport-fit=cover` to HTML files
2. Fix `100vh`/`100dvh` ordering and fallbacks in CSS
3. Fix `50vh` → `50dvh` on card-area
4. Fix fixed positioning with safe-area insets and `dvh`
5. Add JS viewport-height tracking
6. Verify CSS syntax
